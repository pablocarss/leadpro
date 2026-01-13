import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  isJidGroup,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import * as QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { storageService } from './storage.service'
import { addAutomationJob, addAIAssistantJob } from '@/lib/queue'
import path from 'path'
import fs from 'fs'
import pino from 'pino'
import Long from 'long'

interface WhatsappConnection {
  socket: WASocket
  sessionId: string
  historyDays: number
  syncGroups: boolean
}

interface SyncSettings {
  syncContacts: boolean
  syncHistory: boolean
  syncGroups: boolean
  historyDays: number
}

const logger = pino({
  level: process.env.NODE_ENV === 'development' ? 'warn' : 'silent',
})

// Helper to convert timestamp to number (handles Long objects from protobuf)
function toNumber(value: number | Long | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (Long.isLong(value)) return value.toNumber()
  return Number(value) || 0
}

class WhatsappService {
  private connections: Map<string, WhatsappConnection> = new Map()
  private sessionsPath: string
  private syncQueue: Map<string, Promise<void>> = new Map()

  constructor() {
    this.sessionsPath = path.join(process.cwd(), '.whatsapp-sessions')
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true })
    }
  }

  async createSession(sessionId: string, settings?: SyncSettings): Promise<{ qrCode?: string; status: string }> {
    try {
      // Clean up existing connection if any
      const existingConnection = this.connections.get(sessionId)
      if (existingConnection) {
        console.log(`[WhatsApp ${sessionId}] Cleaning up existing connection`)
        try {
          existingConnection.socket.end(undefined)
        } catch {
          // Ignore cleanup errors
        }
        this.connections.delete(sessionId)
      }

      const sessionPath = path.join(this.sessionsPath, sessionId)

      if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true })
      }

      const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
      const { version } = await fetchLatestBaileysVersion()

      // Get settings from database or use provided settings
      let historyDays = settings?.historyDays ?? 7
      let syncGroups = settings?.syncGroups ?? false
      if (!settings) {
        const existingSession = await prisma.whatsappSession.findUnique({
          where: { id: sessionId },
        })
        if (existingSession) {
          historyDays = existingSession.historyDays
          syncGroups = existingSession.syncGroups
        }
      }

      console.log(`[WhatsApp ${sessionId}] Creating socket with version ${version.join('.')}, syncGroups: ${syncGroups}`)

      const socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        browser: ['LeadPro CRM', 'Chrome', '120.0.0'],
        logger,
        generateHighQualityLinkPreview: false,
        // Enable history sync when syncHistory is true
        syncFullHistory: settings?.syncHistory ?? true,
        // Connection settings
        markOnlineOnConnect: true,
        defaultQueryTimeoutMs: 60000,
      })

      this.connections.set(sessionId, { socket, sessionId, historyDays, syncGroups })

      return new Promise((resolve) => {
        socket.ev.on('connection.update', async (update) => {
          const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update

          console.log(`[WhatsApp ${sessionId}] Connection update:`, {
            connection,
            hasQr: !!qr,
            isNewLogin,
            receivedPendingNotifications
          })

          try {
            // Handle connecting state
            if (connection === 'connecting') {
              console.log(`[WhatsApp ${sessionId}] Connecting...`)
              await prisma.whatsappSession.update({
                where: { id: sessionId },
                data: { status: 'CONNECTING' },
              }).catch(() => {})
            }

            if (qr) {
              const qrCodeDataUrl = await QRCode.toDataURL(qr)

              await prisma.whatsappSession.update({
                where: { id: sessionId },
                data: {
                  status: 'QR_CODE',
                  qrCode: qrCodeDataUrl,
                },
              })

              console.log(`[WhatsApp ${sessionId}] QR Code generated`)
              resolve({ qrCode: qrCodeDataUrl, status: 'QR_CODE' })
            }

            if (connection === 'close') {
              const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
              const shouldReconnect = statusCode !== DisconnectReason.loggedOut

              console.log(`[WhatsApp ${sessionId}] Connection closed, statusCode: ${statusCode}, shouldReconnect: ${shouldReconnect}`)

              if (shouldReconnect) {
                await prisma.whatsappSession.update({
                  where: { id: sessionId },
                  data: { status: 'CONNECTING' },
                })

                this.connections.delete(sessionId)
                setTimeout(() => this.createSession(sessionId, settings), 5000)
              } else {
                await prisma.whatsappSession.update({
                  where: { id: sessionId },
                  data: {
                    status: 'DISCONNECTED',
                    qrCode: null,
                    phone: null,
                  },
                })

                this.connections.delete(sessionId)
                this.deleteSessionFiles(sessionId)
              }
            }

            if (connection === 'open') {
              console.log(`[WhatsApp ${sessionId}] Connection OPEN! User:`, socket.user)

              const phone = socket.user?.id?.split(':')[0] || null

              // Sync contacts and history after connection
              const session = await prisma.whatsappSession.findUnique({
                where: { id: sessionId },
              })

              const shouldSync = session?.syncContacts || session?.syncHistory

              await prisma.whatsappSession.update({
                where: { id: sessionId },
                data: {
                  status: 'CONNECTED',
                  qrCode: null,
                  phone,
                  lastConnected: new Date(),
                  isSyncing: shouldSync || false,
                  syncProgress: shouldSync ? 'Iniciando sincronização...' : null,
                },
              })

              console.log(`[WhatsApp ${sessionId}] Status updated to CONNECTED, phone: ${phone}`)

              // Clean old messages based on historyDays setting
              await this.cleanOldMessages(sessionId, historyDays)

              if (session) {
                // Update connection with latest historyDays from database
                const conn = this.connections.get(sessionId)
                if (conn) {
                  conn.historyDays = session.historyDays
                }

                if (session.syncContacts) {
                  await prisma.whatsappSession.update({
                    where: { id: sessionId },
                    data: { syncProgress: 'Sincronizando contatos...' },
                  })
                  this.syncContacts(sessionId).catch(console.error)
                }
                if (session.syncHistory) {
                  await prisma.whatsappSession.update({
                    where: { id: sessionId },
                    data: { syncProgress: 'Aguardando histórico do WhatsApp...' },
                  })
                  this.syncHistory(sessionId, session.historyDays).catch(console.error)

                  // Set a timeout to mark sync as complete if no history is received
                  // This handles cases where there's no history to sync
                  setTimeout(async () => {
                    const currentSession = await prisma.whatsappSession.findUnique({
                      where: { id: sessionId },
                    })
                    if (currentSession?.isSyncing && currentSession?.syncProgress?.includes('Aguardando')) {
                      await prisma.whatsappSession.update({
                        where: { id: sessionId },
                        data: { isSyncing: false, syncProgress: null },
                      })
                      console.log(`[WhatsApp ${sessionId}] Sync timeout reached, marking as complete`)
                    }
                  }, 30000) // 30 seconds timeout
                }

                // If no sync needed, mark as not syncing
                if (!shouldSync) {
                  await prisma.whatsappSession.update({
                    where: { id: sessionId },
                    data: { isSyncing: false, syncProgress: null },
                  })
                }
              }

              resolve({ status: 'CONNECTED' })
            }
          } catch (error) {
            console.error(`[WhatsApp ${sessionId}] Error in connection.update:`, error)
          }
        })

        socket.ev.on('creds.update', saveCreds)

        socket.ev.on('messages.upsert', async (m) => {
          await this.handleIncomingMessages(sessionId, m)
        })

        // Handle contacts sync from WhatsApp
        socket.ev.on('contacts.upsert', async (contacts) => {
          await this.handleContactsSync(sessionId, contacts)
        })

        // Handle chats sync (conversations list)
        socket.ev.on('chats.upsert', async (chats) => {
          console.log(`Received ${chats.length} chats for session ${sessionId}`)
        })

        // Handle history sync
        socket.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
          // Get settings from connection object (already loaded)
          const conn = this.connections.get(sessionId)
          const configuredDays = conn?.historyDays || historyDays
          const shouldSyncGroups = conn?.syncGroups || syncGroups

          // Calculate cutoff timestamp based on configured days
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - configuredDays)
          cutoffDate.setHours(0, 0, 0, 0) // Start of the day X days ago
          const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000)

          console.log(`History sync: ${messages.length} messages received, filtering to last ${configuredDays} days (since ${cutoffDate.toISOString()}), syncGroups: ${shouldSyncGroups}`)

          // Mark as syncing
          await prisma.whatsappSession.update({
            where: { id: sessionId },
            data: {
              isSyncing: true,
              syncProgress: `Sincronizando ${messages.length} mensagens...`,
            },
          })

          // Sync contacts from history
          if (contacts.length > 0) {
            await this.handleContactsSync(sessionId, contacts)
          }

          // Sync messages from history (filtered by days and groups)
          let syncedMessages = 0
          let skippedMessages = 0
          let skippedGroups = 0
          const totalMessages = messages.length

          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]

            // Skip group messages if syncGroups is disabled
            if (msg.key?.remoteJid && isJidGroup(msg.key.remoteJid) && !shouldSyncGroups) {
              skippedGroups++
              continue
            }

            // Filter by date - messageTimestamp can be number or Long
            const msgTimestamp = toNumber(msg.messageTimestamp)

            if (msgTimestamp > 0 && msgTimestamp < cutoffTimestamp) {
              skippedMessages++
              continue // Skip messages older than configured days
            }

            // Save message directly (bypass type check)
            await this.saveHistoryMessage(sessionId, msg, socket)
            syncedMessages++

            // Update progress every 50 messages
            if (syncedMessages % 50 === 0) {
              await prisma.whatsappSession.update({
                where: { id: sessionId },
                data: {
                  syncProgress: `Sincronizando mensagens... ${i + 1}/${totalMessages}`,
                },
              })
            }
          }

          // Mark sync as complete
          await prisma.whatsappSession.update({
            where: { id: sessionId },
            data: {
              isSyncing: false,
              syncProgress: null,
              lastHistorySync: new Date(),
            },
          })

          console.log(`History sync complete: ${syncedMessages} messages synced, ${skippedMessages} skipped (older than ${configuredDays} days), ${skippedGroups} group messages skipped`)
        })

        socket.ev.on('messages.update', async (updates) => {
          for (const update of updates) {
            if (update.update.status) {
              // Message status update (delivered, read, etc.)
              try {
                await prisma.whatsappMessage.updateMany({
                  where: { messageId: update.key.id },
                  data: { isRead: update.update.status >= 3 },
                })
              } catch {
                // Ignore errors
              }
            }
          }
        })
      })
    } catch (error) {
      console.error('Error creating WhatsApp session:', error)

      await prisma.whatsappSession.update({
        where: { id: sessionId },
        data: { status: 'ERROR' },
      })

      throw error
    }
  }

  private async handleIncomingMessages(
    sessionId: string,
    { messages, type }: { messages: proto.IWebMessageInfo[]; type: string }
  ) {
    console.log(`[WhatsApp ${sessionId}] Received ${messages.length} messages, type: ${type}`)

    if (type !== 'notify') {
      console.log(`[WhatsApp ${sessionId}] Skipping non-notify messages`)
      return
    }

    const connection = this.connections.get(sessionId)

    // Verify socket is available
    if (!connection) {
      console.error(`[WhatsApp ${sessionId}] ERRO: Connection não encontrada no map`)
      return
    }

    if (!connection.socket) {
      console.error(`[WhatsApp ${sessionId}] ERRO: Socket não disponível na connection`)
      return
    }

    console.log(`[WhatsApp ${sessionId}] Socket disponível, processando mensagens...`)

    for (const msg of messages) {
      const fromMe = msg.key?.fromMe === true
      console.log(`[WhatsApp ${sessionId}] Processing message from: ${msg.key?.remoteJid}, id: ${msg.key?.id}, fromMe: ${fromMe}`)

      if (!msg.key?.remoteJid) continue
      if (msg.key.remoteJid === 'status@broadcast') continue
      // Skip newsletters (WhatsApp Channels) - media cannot be downloaded
      if (msg.key.remoteJid.includes('@newsletter')) continue

      // Skip messages sent by me - they are already saved when sent
      if (fromMe) {
        console.log(`[WhatsApp ${sessionId}] Skipping own message (fromMe=true)`)
        continue
      }

      const chatId = msg.key.remoteJid

      // Skip groups if syncGroups is disabled
      if (isJidGroup(chatId) && !connection?.syncGroups) {
        console.log(`[WhatsApp ${sessionId}] Skipping group message (syncGroups disabled)`)
        continue
      }

      // Skip messages without actual content (msg.message)
      if (!msg.message) {
        console.log(`[WhatsApp ${sessionId}] Skipping message without content`)
        continue
      }

      // Extract message content (socket is guaranteed to exist at this point)
      const messageContent = await this.extractMessageContent(msg, connection.socket)

      // Skip if no content could be extracted
      if (!messageContent && !msg.message) {
        console.log(`[WhatsApp ${sessionId}] Skipping message - no content extracted`)
        continue
      }

      const timestamp = toNumber(msg.messageTimestamp)
      const messageDate = timestamp > 0 ? new Date(timestamp * 1000) : new Date()
      const body = messageContent?.text || ''

      // Skip empty messages (no text and no media)
      if (!body && !messageContent?.mediaType) {
        console.log(`[WhatsApp ${sessionId}] Skipping empty message (no body, no media)`)
        continue
      }

      // Save message directly to database
      try {
        await prisma.whatsappMessage.upsert({
          where: { messageId: msg.key.id || '' },
          create: {
            messageId: msg.key.id || undefined,
            chatId,
            from: chatId,
            to: 'me',
            body,
            mediaUrl: messageContent?.mediaUrl,
            mediaType: messageContent?.mediaType,
            mediaMimeType: messageContent?.mediaMimeType,
            mediaDuration: messageContent?.mediaDuration,
            mediaFileName: messageContent?.mediaFileName,
            isFromMe: false,
            timestamp: messageDate,
            sessionId,
          },
          update: {},
        })

        console.log(`[WhatsApp ${sessionId}] Message saved: ${msg.key.id}, body: ${body.substring(0, 50)}...`)

        // Check AI assistant first (if enabled, it will respond)
        const aiHandled = await this.checkAndTriggerAIAssistant(sessionId, chatId, body)

        // Only run automations if AI didn't handle
        if (!aiHandled) {
          await this.checkAndTriggerAutomations(sessionId, chatId, body)
        }
      } catch (error) {
        // Silently ignore duplicate errors
        if (!(error instanceof Error && error.message.includes('Unique constraint'))) {
          console.error(`[WhatsApp ${sessionId}] Error saving message:`, error)
        }
      }
    }
  }

  /**
   * Check if AI assistant is enabled and trigger it to respond
   * Returns true if AI assistant will handle the message
   */
  private async checkAndTriggerAIAssistant(
    sessionId: string,
    chatId: string,
    messageBody: string
  ): Promise<boolean> {
    try {
      // Find AI assistant config for this session
      const config = await prisma.aIAssistantConfig.findUnique({
        where: { whatsappSessionId: sessionId },
      })

      // If no config or not enabled, return false
      if (!config || !config.isEnabled) {
        return false
      }

      // Skip empty messages
      if (!messageBody || messageBody.trim().length === 0) {
        return false
      }

      console.log(`[AI Assistant] Triggering for session ${sessionId}, chat ${chatId}`)

      // Add job to queue for async processing
      await addAIAssistantJob({
        sessionId,
        chatId,
        messageBody,
        configId: config.id,
      })

      return true
    } catch (error) {
      console.error('Error checking AI assistant:', error)
      return false
    }
  }

  private async checkAndTriggerAutomations(sessionId: string, chatId: string, messageBody: string) {
    try {
      // Find active automations for this session
      const automations = await prisma.automation.findMany({
        where: {
          whatsappSessionId: sessionId,
          isActive: true,
        },
      })

      for (const automation of automations) {
        let shouldTrigger = false

        switch (automation.trigger) {
          case 'ALL_MESSAGES':
            shouldTrigger = true
            break
          case 'KEYWORD':
            if (automation.triggerValue && messageBody.toLowerCase().includes(automation.triggerValue.toLowerCase())) {
              shouldTrigger = true
            }
            break
          case 'NEW_CONVERSATION':
            // Check if this is a new conversation
            const existingMessages = await prisma.whatsappMessage.count({
              where: { sessionId, chatId },
            })
            shouldTrigger = existingMessages <= 1
            break
        }

        if (shouldTrigger) {
          await addAutomationJob({
            automationId: automation.id,
            chatId,
            sessionId,
            trigger: automation.trigger,
            messageBody,
          })
        }
      }
    } catch (error) {
      console.error('Error checking automations:', error)
    }
  }

  private async saveHistoryMessage(
    sessionId: string,
    msg: proto.IWebMessageInfo,
    socket?: WASocket
  ) {
    try {
      if (!msg.key?.remoteJid) return

      // Skip status broadcasts
      if (msg.key.remoteJid === 'status@broadcast') return

      // Skip newsletters (WhatsApp Channels) - media cannot be downloaded
      if (msg.key.remoteJid.includes('@newsletter')) return

      // History messages might not have msg.message directly
      // They can have the message content in different places
      if (!socket) {
        console.error(`[History] ERRO: Socket não disponível para baixar mídia`)
      }
      const messageContent = await this.extractMessageContent(msg, socket)

      const chatId = msg.key.remoteJid
      const isFromMe = msg.key.fromMe || false
      const from = isFromMe ? 'me' : chatId
      const to = isFromMe ? chatId : 'me'

      // Convert timestamp properly (handles Long objects from protobuf)
      const timestamp = toNumber(msg.messageTimestamp)
      const messageDate = timestamp > 0 ? new Date(timestamp * 1000) : new Date()

      // Get message body - either from extracted content or key info
      const body = messageContent?.text || ''

      // Use upsert to avoid duplicates
      await prisma.whatsappMessage.upsert({
        where: { messageId: msg.key.id || '' },
        create: {
          messageId: msg.key.id || undefined,
          chatId,
          from,
          to,
          body,
          mediaUrl: messageContent?.mediaUrl,
          mediaType: messageContent?.mediaType,
          mediaMimeType: messageContent?.mediaMimeType,
          mediaDuration: messageContent?.mediaDuration,
          mediaFileName: messageContent?.mediaFileName,
          isFromMe,
          timestamp: messageDate,
          sessionId,
        },
        update: {},
      })
    } catch (error) {
      // Silently ignore duplicate errors
      if (!(error instanceof Error && error.message.includes('Unique constraint'))) {
        console.error('Error saving message:', error)
      }
    }
  }

  private async extractMessageContent(
    msg: proto.IWebMessageInfo,
    socket?: WASocket
  ): Promise<{
    text?: string
    mediaUrl?: string
    mediaType?: string
    mediaMimeType?: string
    mediaDuration?: number
    mediaFileName?: string
  } | null> {
    const message = msg.message

    if (!message) return null

    if (message.conversation) {
      return { text: message.conversation }
    }

    if (message.extendedTextMessage) {
      return { text: message.extendedTextMessage.text || '' }
    }

    // Handle image messages
    if (message.imageMessage) {
      const mediaUrl = await this.downloadAndStoreMedia(msg, socket, 'image', 'jpg')
      return {
        text: message.imageMessage.caption || '',
        mediaType: 'image',
        mediaMimeType: message.imageMessage.mimetype || 'image/jpeg',
        mediaUrl,
      }
    }

    // Handle video messages
    if (message.videoMessage) {
      const mediaUrl = await this.downloadAndStoreMedia(msg, socket, 'video', 'mp4')
      return {
        text: message.videoMessage.caption || '',
        mediaType: 'video',
        mediaMimeType: message.videoMessage.mimetype || 'video/mp4',
        mediaDuration: message.videoMessage.seconds || undefined,
        mediaUrl,
      }
    }

    // Handle audio messages (including voice notes)
    if (message.audioMessage) {
      const isPtt = message.audioMessage.ptt || false
      const mediaUrl = await this.downloadAndStoreMedia(msg, socket, isPtt ? 'ptt' : 'audio', 'ogg')
      return {
        text: isPtt ? '' : '',
        mediaType: isPtt ? 'ptt' : 'audio',
        mediaMimeType: message.audioMessage.mimetype || 'audio/ogg; codecs=opus',
        mediaDuration: message.audioMessage.seconds || undefined,
        mediaUrl,
      }
    }

    // Handle document messages
    if (message.documentMessage) {
      const fileName = message.documentMessage.fileName || 'document'
      const ext = fileName.split('.').pop() || 'bin'
      const mediaUrl = await this.downloadAndStoreMedia(msg, socket, 'document', ext)
      return {
        text: fileName,
        mediaType: 'document',
        mediaMimeType: message.documentMessage.mimetype || 'application/octet-stream',
        mediaFileName: fileName,
        mediaUrl,
      }
    }

    // Handle sticker messages
    if (message.stickerMessage) {
      const mediaUrl = await this.downloadAndStoreMedia(msg, socket, 'sticker', 'webp')
      return {
        text: '',
        mediaType: 'sticker',
        mediaMimeType: 'image/webp',
        mediaUrl,
      }
    }

    if (message.contactMessage) {
      return { text: `[Contato: ${message.contactMessage.displayName}]`, mediaType: 'contact' }
    }

    if (message.locationMessage) {
      const lat = message.locationMessage.degreesLatitude
      const lng = message.locationMessage.degreesLongitude
      return { text: `[Localização: ${lat}, ${lng}]`, mediaType: 'location' }
    }

    // Handle reaction messages
    if (message.reactionMessage) {
      const emoji = message.reactionMessage.text || ''
      return { text: emoji ? `[Reação: ${emoji}]` : '[Reação removida]', mediaType: 'reaction' }
    }

    // Handle button response messages
    if (message.buttonsResponseMessage) {
      return { text: message.buttonsResponseMessage.selectedDisplayText || '[Resposta de botão]', mediaType: 'button_response' }
    }

    // Handle list response messages
    if (message.listResponseMessage) {
      return { text: message.listResponseMessage.title || '[Resposta de lista]', mediaType: 'list_response' }
    }

    // Handle template button reply
    if (message.templateButtonReplyMessage) {
      return { text: message.templateButtonReplyMessage.selectedDisplayText || '[Resposta de template]', mediaType: 'template_response' }
    }

    // Handle poll messages
    if (message.pollCreationMessage) {
      return { text: `[Enquete: ${message.pollCreationMessage.name}]`, mediaType: 'poll' }
    }

    // Handle poll update messages
    if (message.pollUpdateMessage) {
      return { text: '[Voto em enquete]', mediaType: 'poll_vote' }
    }

    // Handle live location
    if (message.liveLocationMessage) {
      return { text: '[Localização ao vivo]', mediaType: 'live_location' }
    }

    // Handle view once messages (ephemeral)
    if (message.viewOnceMessage || message.viewOnceMessageV2) {
      const innerMessage = message.viewOnceMessage?.message || message.viewOnceMessageV2?.message
      if (innerMessage?.imageMessage) {
        return { text: '[Foto visualização única]', mediaType: 'view_once_image' }
      }
      if (innerMessage?.videoMessage) {
        return { text: '[Vídeo visualização única]', mediaType: 'view_once_video' }
      }
      return { text: '[Mídia visualização única]', mediaType: 'view_once' }
    }

    // Handle protocol messages (edits, revokes, etc.)
    if (message.protocolMessage) {
      const type = message.protocolMessage.type
      if (type === 0) {
        return { text: '[Mensagem apagada]', mediaType: 'deleted' }
      }
      if (type === 14) {
        const editedMsg = (message.protocolMessage.editedMessage as proto.IWebMessageInfo | undefined)?.message
        if (editedMsg?.conversation) {
          return { text: editedMsg.conversation }
        }
        if (editedMsg?.extendedTextMessage?.text) {
          return { text: editedMsg.extendedTextMessage.text }
        }
      }
      // Skip other protocol messages
      return null
    }

    // Handle contact array messages
    if (message.contactsArrayMessage) {
      const contacts = message.contactsArrayMessage.contacts || []
      return { text: `[${contacts.length} contatos compartilhados]`, mediaType: 'contacts' }
    }

    // Fallback: try to get any text from known fields
    const messageKeys = Object.keys(message)
    console.log(`[WhatsApp] Unhandled message type, keys: ${messageKeys.join(', ')}`)

    // Return null for truly empty/unrecognized messages
    return null
  }

  private async downloadAndStoreMedia(
    msg: proto.IWebMessageInfo,
    socket: WASocket | undefined,
    mediaType: string = 'file',
    extension: string = 'bin'
  ): Promise<string | undefined> {
    const messageId = msg.key?.id || `${Date.now()}`

    // Validate inputs
    if (!socket) {
      console.error(`[Media ${messageId}] ERRO: Socket não disponível`)
      return undefined
    }

    if (!msg.key) {
      console.error(`[Media ${messageId}] ERRO: Message key não disponível`)
      return undefined
    }

    if (!msg.message) {
      console.error(`[Media ${messageId}] ERRO: Message content não disponível`)
      return undefined
    }

    console.log(`[Media ${messageId}] Iniciando download de ${mediaType}...`)

    try {
      // Download media from WhatsApp servers
      // Cast to expected type since we've already validated msg.key exists
      const buffer = await downloadMediaMessage(
        msg as Parameters<typeof downloadMediaMessage>[0],
        'buffer',
        {},
        {
          logger,
          reuploadRequest: socket.updateMediaMessage,
        }
      )

      // Validate buffer
      if (!buffer) {
        console.error(`[Media ${messageId}] ERRO: Buffer vazio após download`)
        return undefined
      }

      if (!(buffer instanceof Buffer) && !Buffer.isBuffer(buffer)) {
        // Try to convert to buffer if it's a Uint8Array or similar
        const convertedBuffer = Buffer.from(buffer as ArrayBuffer)
        if (!convertedBuffer || convertedBuffer.length === 0) {
          console.error(`[Media ${messageId}] ERRO: Não foi possível converter para Buffer`)
          return undefined
        }
        console.log(`[Media ${messageId}] Buffer convertido: ${convertedBuffer.length} bytes`)

        // Upload to MinIO
        const mediaUrl = await storageService.uploadWhatsAppMedia(
          convertedBuffer,
          messageId,
          mediaType,
          extension
        )
        console.log(`[Media ${messageId}] Upload concluído: ${mediaUrl}`)
        return mediaUrl
      }

      console.log(`[Media ${messageId}] Download concluído: ${buffer.length} bytes`)

      // Upload to MinIO
      const mediaUrl = await storageService.uploadWhatsAppMedia(
        buffer as Buffer,
        messageId,
        mediaType,
        extension
      )

      console.log(`[Media ${messageId}] Upload concluído: ${mediaUrl}`)
      return mediaUrl
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`[Media ${messageId}] ERRO no download/upload de ${mediaType}:`, errorMessage)

      // Log stack trace for debugging
      if (error instanceof Error && error.stack) {
        console.error(`[Media ${messageId}] Stack:`, error.stack)
      }

      return undefined
    }
  }

  private async downloadProfilePicture(socket: WASocket, jid: string): Promise<string | undefined> {
    try {
      const ppUrl = await socket.profilePictureUrl(jid, 'image')
      if (!ppUrl) return undefined

      // Fetch the image
      const response = await fetch(ppUrl)
      if (!response.ok) return undefined

      const buffer = Buffer.from(await response.arrayBuffer())
      const contactId = jid.split('@')[0]

      const avatarUrl = await storageService.uploadProfilePicture(buffer, contactId)
      return avatarUrl
    } catch (error) {
      // Profile picture might not be available
      return undefined
    }
  }

  private async handleContactsSync(sessionId: string, contacts: { id: string; name?: string | null; notify?: string | null }[]) {
    const session = await prisma.whatsappSession.findUnique({
      where: { id: sessionId },
      include: { integration: true },
    })

    if (!session || !session.syncContacts) return

    const connection = this.connections.get(sessionId)
    const userId = session.integration.userId
    let syncedCount = 0

    for (const contact of contacts) {
      try {
        const jid = contact.id

        // Skip groups, broadcasts, and invalid jids
        if (!jid || isJidGroup(jid) || jid === 'status@broadcast' || jid.includes('newsletter')) continue

        const phone = jid.split('@')[0]
        if (!phone || phone.length < 8) continue

        // Get contact name
        const name = contact.notify || contact.name || phone

        // Try to download profile picture
        let avatar: string | undefined
        if (connection?.socket) {
          avatar = await this.downloadProfilePicture(connection.socket, jid)
        }

        // Check if contact already exists
        const existingContact = await prisma.contact.findFirst({
          where: {
            OR: [
              { whatsappJid: jid },
              { phone },
            ],
            userId,
          },
        })

        if (!existingContact) {
          await prisma.contact.create({
            data: {
              name,
              phone,
              avatar,
              whatsappJid: jid,
              whatsappSessionId: sessionId,
              syncedFromWhatsapp: true,
              userId,
            },
          })
          syncedCount++
        } else {
          // Update existing contact with WhatsApp info
          await prisma.contact.update({
            where: { id: existingContact.id },
            data: {
              ...(name !== phone && existingContact.name === existingContact.phone && { name }),
              ...(avatar && !existingContact.avatar && { avatar }),
              whatsappJid: jid,
              whatsappSessionId: sessionId,
            },
          })
        }
      } catch (error) {
        console.error('Error syncing contact:', error)
      }
    }

    if (syncedCount > 0) {
      console.log(`Synced ${syncedCount} contacts for session ${sessionId}`)

      // Update last sync time
      await prisma.whatsappSession.update({
        where: { id: sessionId },
        data: { lastContactSync: new Date() },
      })
    }

    return syncedCount
  }

  async sendMessage(sessionId: string, to: string, message: string): Promise<{ messageId: string }> {
    let connection = this.connections.get(sessionId)

    // Try to restore session if not connected in memory but exists in database
    if (!connection) {
      const session = await prisma.whatsappSession.findUnique({
        where: { id: sessionId },
      })

      if (session && session.status === 'CONNECTED') {
        // Session exists in DB as connected, try to restore
        try {
          await this.restoreSession(sessionId)
          // Wait a moment for connection
          await new Promise(resolve => setTimeout(resolve, 2000))
          connection = this.connections.get(sessionId)
        } catch {
          // Update status to disconnected
          await prisma.whatsappSession.update({
            where: { id: sessionId },
            data: { status: 'DISCONNECTED' },
          })
        }
      }

      if (!connection) {
        throw new Error('Sessão não conectada. Por favor, reconecte via QR Code.')
      }
    }

    try {
      const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`

      const result = await connection.socket.sendMessage(jid, { text: message })

      // Save sent message
      await prisma.whatsappMessage.create({
        data: {
          messageId: result?.key?.id,
          chatId: jid,
          from: 'me',
          to: jid,
          body: message,
          isFromMe: true,
          sessionId,
        },
      })

      return { messageId: result?.key?.id || '' }
    } catch (error) {
      console.error('Error sending message:', error)
      throw error
    }
  }

  async syncContacts(sessionId: string): Promise<number> {
    const connection = this.connections.get(sessionId)
    if (!connection) throw new Error('Sessão não conectada')

    const session = await prisma.whatsappSession.findUnique({
      where: { id: sessionId },
      include: { integration: true },
    })

    if (!session) throw new Error('Sessão não encontrada')

    const userId = session.integration.userId
    let syncedCount = 0

    try {
      // Get ALL unique chats from messages
      const chats = await prisma.whatsappMessage.findMany({
        where: { sessionId },
        select: { chatId: true },
        distinct: ['chatId'],
      })

      console.log(`Found ${chats.length} unique chats to sync contacts from`)

      for (const chat of chats) {
        const jid = chat.chatId

        // Skip groups, broadcasts, and newsletters
        if (isJidGroup(jid) || jid === 'status@broadcast' || jid.includes('newsletter')) continue

        const phone = jid.split('@')[0]
        if (!phone || phone.length < 8) continue

        // Check if contact already exists
        const existingContact = await prisma.contact.findFirst({
          where: {
            whatsappJid: jid,
            userId,
          },
        })

        if (!existingContact) {
          // Try to download profile picture
          let avatar: string | undefined
          try {
            avatar = await this.downloadProfilePicture(connection.socket, jid)
          } catch {
            // Ignore profile picture errors
          }

          // Get contact name - use phone as fallback
          const name = phone

          await prisma.contact.create({
            data: {
              name,
              phone,
              avatar,
              whatsappJid: jid,
              whatsappSessionId: sessionId,
              syncedFromWhatsapp: true,
              userId,
            },
          })
          syncedCount++
        } else if (!existingContact.whatsappJid) {
          // Update existing contact with WhatsApp JID
          await prisma.contact.update({
            where: { id: existingContact.id },
            data: {
              whatsappJid: jid,
              whatsappSessionId: sessionId,
            },
          })
        }
      }

      // Update last sync time
      await prisma.whatsappSession.update({
        where: { id: sessionId },
        data: { lastContactSync: new Date() },
      })

      return syncedCount
    } catch (error) {
      console.error('Error syncing contacts:', error)
      throw error
    }
  }

  async syncHistory(sessionId: string, days: number = 7): Promise<number> {
    const connection = this.connections.get(sessionId)
    if (!connection) throw new Error('Sessão não conectada')

    try {
      // History is synced automatically when messages come in through the event listener
      // This function just updates the sync timestamp and returns the current count
      const count = await prisma.whatsappMessage.count({
        where: { sessionId },
      })

      // Update last sync time
      await prisma.whatsappSession.update({
        where: { id: sessionId },
        data: {
          lastHistorySync: new Date(),
          historyDays: days,
        },
      })

      return count
    } catch (error) {
      console.error('Error syncing history:', error)
      throw error
    }
  }

  async ensureConnected(sessionId: string): Promise<boolean> {
    // Check if already connected in memory
    if (this.connections.has(sessionId)) {
      return true
    }

    // Check database status and try to restore
    const session = await prisma.whatsappSession.findUnique({
      where: { id: sessionId },
    })

    if (!session) return false

    // If session was marked as connected, try to restore
    if (session.status === 'CONNECTED' || session.status === 'CONNECTING') {
      console.log(`[WhatsApp ${sessionId}] Session not in memory, restoring...`)
      try {
        await this.restoreSession(sessionId)
        // Wait for connection
        await new Promise(resolve => setTimeout(resolve, 3000))
        return this.connections.has(sessionId)
      } catch (error) {
        console.error(`[WhatsApp ${sessionId}] Failed to restore:`, error)
        return false
      }
    }

    return false
  }

  async getChats(sessionId: string): Promise<Array<{
    chatId: string
    name: string
    avatar: string | null
    lastMessage: string
    lastMessageTime: Date
    unreadCount: number
    isGroup: boolean
  }>> {
    // Ensure session is connected
    await this.ensureConnected(sessionId)

    // Get chats from database
    const chatsData = await prisma.whatsappMessage.groupBy({
      by: ['chatId'],
      where: { sessionId },
      _max: { timestamp: true },
      _count: { id: true },
    })

    const chats = []

    for (const chat of chatsData) {
      const lastMessage = await prisma.whatsappMessage.findFirst({
        where: { sessionId, chatId: chat.chatId },
        orderBy: { timestamp: 'desc' },
      })

      const unreadCount = await prisma.whatsappMessage.count({
        where: {
          sessionId,
          chatId: chat.chatId,
          isFromMe: false,
          isRead: false,
        },
      })

      // Try to get contact info from database
      let name = chat.chatId.split('@')[0]
      let avatar: string | null = null
      const contact = await prisma.contact.findFirst({
        where: { whatsappJid: chat.chatId },
      })
      if (contact) {
        name = contact.name
        avatar = contact.avatar
      }

      chats.push({
        chatId: chat.chatId,
        name,
        avatar,
        lastMessage: lastMessage?.body || '',
        lastMessageTime: lastMessage?.timestamp || new Date(),
        unreadCount,
        isGroup: isJidGroup(chat.chatId) ?? false,
      })
    }

    // Sort by last message time
    chats.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime())

    return chats
  }

  async markAsRead(sessionId: string, chatId: string): Promise<void> {
    const connection = this.connections.get(sessionId)

    // Mark messages as read in database
    await prisma.whatsappMessage.updateMany({
      where: {
        sessionId,
        chatId,
        isFromMe: false,
        isRead: false,
      },
      data: { isRead: true },
    })

    // Send read receipt to WhatsApp
    if (connection) {
      try {
        const messages = await prisma.whatsappMessage.findMany({
          where: {
            sessionId,
            chatId,
            isFromMe: false,
          },
          orderBy: { timestamp: 'desc' },
          take: 1,
        })

        if (messages.length > 0 && messages[0].messageId) {
          await connection.socket.readMessages([
            { remoteJid: chatId, id: messages[0].messageId, participant: undefined },
          ])
        }
      } catch {
        // Ignore read receipt errors
      }
    }
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId)

    if (connection) {
      await connection.socket.logout()
      this.connections.delete(sessionId)
    }

    await prisma.whatsappSession.update({
      where: { id: sessionId },
      data: {
        status: 'DISCONNECTED',
        qrCode: null,
        phone: null,
      },
    })

    this.deleteSessionFiles(sessionId)
  }

  private deleteSessionFiles(sessionId: string): void {
    const sessionPath = path.join(this.sessionsPath, sessionId)

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true })
    }
  }

  async cleanOldMessages(sessionId: string, days: number): Promise<number> {
    try {
      // Calculate cutoff date
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      cutoffDate.setHours(0, 0, 0, 0) // Start of the day X days ago

      // Delete messages older than the cutoff date
      const result = await prisma.whatsappMessage.deleteMany({
        where: {
          sessionId,
          timestamp: {
            lt: cutoffDate,
          },
        },
      })

      if (result.count > 0) {
        console.log(`Cleaned ${result.count} old messages (older than ${days} days) for session ${sessionId}`)
      }

      return result.count
    } catch (error) {
      console.error('Error cleaning old messages:', error)
      return 0
    }
  }

  getSocket(sessionId: string): WASocket | undefined {
    return this.connections.get(sessionId)?.socket
  }

  async downloadMediaForMessage(
    messageId: string,
    sessionId: string,
    mediaType: string,
    fileName?: string
  ): Promise<string | undefined> {
    const connection = this.connections.get(sessionId)
    if (!connection) return undefined

    try {
      // This method would need to re-fetch the message from WhatsApp
      // For now, we return undefined as the media should be downloaded at receive time
      console.log(`[WhatsApp ${sessionId}] Attempting to download media for message ${messageId}`)
      return undefined
    } catch (error) {
      console.error('Error downloading media:', error)
      return undefined
    }
  }

  async getSessionStatus(sessionId: string): Promise<string> {
    const connection = this.connections.get(sessionId)

    if (!connection) {
      return 'DISCONNECTED'
    }

    return 'CONNECTED'
  }

  isSessionConnected(sessionId: string): boolean {
    return this.connections.has(sessionId)
  }

  async restoreSession(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.sessionsPath, sessionId)

    if (fs.existsSync(sessionPath)) {
      const session = await prisma.whatsappSession.findUnique({
        where: { id: sessionId },
      })

      if (session) {
        await this.createSession(sessionId, {
          syncContacts: session.syncContacts,
          syncHistory: session.syncHistory,
          syncGroups: session.syncGroups,
          historyDays: session.historyDays,
        })
      }
    }
  }

  async restoreAllSessions(): Promise<void> {
    const sessions = await prisma.whatsappSession.findMany({
      where: {
        status: { in: ['CONNECTED', 'CONNECTING'] },
      },
    })

    for (const session of sessions) {
      try {
        await this.restoreSession(session.id)
      } catch (error) {
        console.error(`Error restoring session ${session.id}:`, error)
      }
    }
  }
}

export const whatsappService = new WhatsappService()

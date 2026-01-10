import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidGroup,
  jidNormalizedUser,
  downloadMediaMessage,
  getContentType,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import * as QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { storageService } from './storage.service'
import path from 'path'
import fs from 'fs'
import pino from 'pino'
import Long from 'long'

interface WhatsappConnection {
  socket: WASocket
  sessionId: string
  historyDays: number
}

interface SyncSettings {
  syncContacts: boolean
  syncHistory: boolean
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

      // Get history days from settings or database
      let historyDays = settings?.historyDays ?? 7
      if (!settings) {
        const existingSession = await prisma.whatsappSession.findUnique({
          where: { id: sessionId },
        })
        if (existingSession) {
          historyDays = existingSession.historyDays
        }
      }

      console.log(`[WhatsApp ${sessionId}] Creating socket with version ${version.join('.')}`)

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

      this.connections.set(sessionId, { socket, sessionId, historyDays })

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
          // Get historyDays from connection object (already loaded)
          const conn = this.connections.get(sessionId)
          const configuredDays = conn?.historyDays || historyDays

          // Calculate cutoff timestamp based on configured days
          const cutoffDate = new Date()
          cutoffDate.setDate(cutoffDate.getDate() - configuredDays)
          cutoffDate.setHours(0, 0, 0, 0) // Start of the day X days ago
          const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000)

          console.log(`History sync: ${messages.length} messages received, filtering to last ${configuredDays} days (since ${cutoffDate.toISOString()})`)

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

          // Sync messages from history (filtered by days)
          let syncedMessages = 0
          let skippedMessages = 0
          const totalMessages = messages.length

          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i]
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

          console.log(`History sync complete: ${syncedMessages} messages synced, ${skippedMessages} skipped (older than ${configuredDays} days)`)
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

    for (const msg of messages) {
      console.log(`[WhatsApp ${sessionId}] Processing message from: ${msg.key?.remoteJid}, id: ${msg.key?.id}`)
      await this.saveHistoryMessage(sessionId, msg, connection?.socket)
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

      // History messages might not have msg.message directly
      // They can have the message content in different places
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
      return { text: '[Localização]', mediaType: 'location' }
    }

    return null
  }

  private async downloadAndStoreMedia(
    msg: proto.IWebMessageInfo,
    socket?: WASocket,
    mediaType: string = 'file',
    extension: string = 'bin'
  ): Promise<string | undefined> {
    if (!socket || !msg.key) return undefined

    try {
      const buffer = await downloadMediaMessage(
        msg as { key: typeof msg.key } & proto.IWebMessageInfo,
        'buffer',
        {},
        {
          logger,
          reuploadRequest: socket.updateMediaMessage,
        }
      )

      if (!buffer || !(buffer instanceof Buffer)) {
        console.error('Failed to download media: buffer is empty')
        return undefined
      }

      const messageId = msg.key?.id || `${Date.now()}`
      const mediaUrl = await storageService.uploadWhatsAppMedia(
        buffer,
        messageId,
        mediaType,
        extension
      )

      return mediaUrl
    } catch (error) {
      console.error('Error downloading media:', error)
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

  getSocket(sessionId: string): WASocket | undefined {
    return this.connections.get(sessionId)?.socket
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

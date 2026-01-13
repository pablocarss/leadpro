import { Worker, Job } from 'bullmq'
import { connection } from './connection'
import { QUEUE_NAMES } from './queues'
import type {
  WhatsAppMessageJobData,
  WhatsAppSendJobData,
  WebChatMessageJobData,
  AutomationJobData,
  NotificationJobData,
  MediaDownloadJobData,
  AIAssistantJobData,
  JobResult,
} from './types'
import { prisma } from '@/lib/prisma'

// WhatsApp Message Worker - processes incoming messages
async function processWhatsAppMessage(job: Job<WhatsAppMessageJobData>): Promise<JobResult> {
  const { sessionId, chatId, from, to, body, isFromMe, timestamp, mediaUrl, mediaType, mediaMimeType, mediaDuration, mediaFileName, messageId } = job.data

  try {
    // Save message to database
    await prisma.whatsappMessage.upsert({
      where: { messageId: messageId || '' },
      create: {
        messageId,
        chatId,
        from,
        to,
        body,
        mediaUrl,
        mediaType,
        mediaMimeType,
        mediaDuration,
        mediaFileName,
        isFromMe,
        timestamp: new Date(timestamp),
        sessionId,
      },
      update: {},
    })

    // Log activity if it's an incoming message
    if (!isFromMe) {
      const session = await prisma.whatsappSession.findUnique({
        where: { id: sessionId },
        include: { integration: true },
      })

      if (session) {
        // Find contact by WhatsApp JID
        const contact = await prisma.contact.findFirst({
          where: { whatsappJid: chatId },
        })

        if (contact) {
          await prisma.activity.create({
            data: {
              type: 'WHATSAPP_MESSAGE',
              description: `Mensagem recebida: ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`,
              userId: session.integration.userId,
              contactId: contact.id,
              metadata: { chatId, mediaType },
            },
          })
        }
      }
    }

    return { success: true, message: 'Message processed successfully' }
  } catch (error) {
    console.error('Error processing WhatsApp message:', error)
    throw error
  }
}

// WhatsApp Send Worker - sends outgoing messages
async function processWhatsAppSend(job: Job<WhatsAppSendJobData>): Promise<JobResult> {
  const { sessionId, to, message } = job.data

  try {
    // Import whatsappService dynamically to avoid circular dependencies
    const { whatsappService } = await import('@/services/whatsapp.service')

    const result = await whatsappService.sendMessage(sessionId, to, message)

    return { success: true, message: 'Message sent successfully', data: result }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    throw error
  }
}

// WebChat Message Worker
async function processWebChatMessage(job: Job<WebChatMessageJobData>): Promise<JobResult> {
  const { sessionId, content, isFromVisitor, operatorId } = job.data

  try {
    // Create the message
    const message = await prisma.webChatMessage.create({
      data: {
        sessionId,
        content,
        isFromVisitor,
        operatorId,
      },
    })

    // Update session last activity
    await prisma.webChatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    })

    return { success: true, message: 'WebChat message processed', data: message }
  } catch (error) {
    console.error('Error processing WebChat message:', error)
    throw error
  }
}

// Automation Worker
async function processAutomation(job: Job<AutomationJobData>): Promise<JobResult> {
  const { automationId, chatId, sessionId, trigger, messageBody, variables } = job.data

  try {
    const automation = await prisma.automation.findUnique({
      where: { id: automationId },
    })

    if (!automation || !automation.isActive) {
      return { success: false, message: 'Automation not found or inactive' }
    }

    // Create or update execution
    const execution = await prisma.automationExecution.upsert({
      where: {
        id: `${automationId}-${chatId}`,
      },
      create: {
        automationId,
        chatId,
        status: 'RUNNING',
        variables: (variables || {}) as object,
      },
      update: {
        status: 'RUNNING',
        variables: (variables || {}) as object,
      },
    })

    // Process automation nodes
    const nodes = automation.nodes as unknown[]
    const edges = automation.edges as unknown[]

    console.log(`Processing automation ${automationId} for chat ${chatId}`, {
      trigger,
      messageBody,
      nodesCount: Array.isArray(nodes) ? nodes.length : 0,
      edgesCount: Array.isArray(edges) ? edges.length : 0,
    })

    // Mark as completed
    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    return { success: true, message: 'Automation executed successfully' }
  } catch (error) {
    console.error('Error processing automation:', error)
    throw error
  }
}

// Notification Worker
async function processNotification(job: Job<NotificationJobData>): Promise<JobResult> {
  const { type, title, body, data, webhookUrl } = job.data

  try {
    switch (type) {
      case 'webhook':
        if (webhookUrl) {
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, data }),
          })
        }
        break

      case 'email':
        // TODO: Implement email sending
        console.log('Email notification:', { title, body })
        break

      case 'push':
        // TODO: Implement push notification
        console.log('Push notification:', { title, body })
        break
    }

    return { success: true, message: 'Notification sent successfully' }
  } catch (error) {
    console.error('Error processing notification:', error)
    throw error
  }
}

// AI Assistant Worker - generates AI responses for incoming messages
async function processAIAssistant(job: Job<AIAssistantJobData>): Promise<JobResult> {
  const { sessionId, chatId, messageBody, configId } = job.data

  try {
    // Import AI service dynamically to avoid circular dependencies
    const { aiAssistantService } = await import('@/services/ai.service')
    const { addWhatsAppSendJob } = await import('./jobs')

    console.log(`Processing AI assistant for session ${sessionId}, chat ${chatId}`)

    // Generate AI response
    const response = await aiAssistantService.generateResponse(sessionId, chatId, messageBody)

    if (response) {
      // Send the response via WhatsApp
      await addWhatsAppSendJob({
        sessionId,
        to: chatId,
        message: response,
      })

      console.log(`AI response sent to ${chatId}`)
      return { success: true, message: 'AI response generated and sent', data: { response } }
    }

    return { success: false, message: 'AI response was empty or assistant is disabled' }
  } catch (error) {
    console.error('Error processing AI assistant:', error)
    throw error
  }
}

// Media Download Worker - downloads media asynchronously
async function processMediaDownload(job: Job<MediaDownloadJobData>): Promise<JobResult> {
  const { messageId, sessionId, mediaType, mediaMimeType, mediaFileName } = job.data

  try {
    // Get the message from database
    const message = await prisma.whatsappMessage.findUnique({
      where: { id: messageId },
    })

    if (!message) {
      return { success: false, message: 'Message not found' }
    }

    // If already has mediaUrl, skip
    if (message.mediaUrl) {
      return { success: true, message: 'Media already downloaded' }
    }

    // Import whatsappService dynamically
    const { whatsappService } = await import('@/services/whatsapp.service')

    // Get the socket for this session
    const socket = whatsappService.getSocket(sessionId)
    if (!socket) {
      throw new Error('Session not connected')
    }

    // Download media using the service
    const mediaUrl = await whatsappService.downloadMediaForMessage(
      message.messageId || '',
      sessionId,
      mediaType,
      mediaFileName || undefined
    )

    if (mediaUrl) {
      // Update message with media URL
      await prisma.whatsappMessage.update({
        where: { id: messageId },
        data: {
          mediaUrl,
          mediaMimeType: mediaMimeType || undefined,
        },
      })

      return { success: true, message: 'Media downloaded successfully', data: { mediaUrl } }
    }

    return { success: false, message: 'Failed to download media' }
  } catch (error) {
    console.error('Error downloading media:', error)
    throw error
  }
}

// Worker instances
let workers: Worker[] = []

// Start all workers
export function startWorkers() {
  console.log('Starting queue workers...')

  const whatsappMessageWorker = new Worker(
    QUEUE_NAMES.WHATSAPP_MESSAGE,
    processWhatsAppMessage,
    { connection, concurrency: 5 }
  )

  const whatsappSendWorker = new Worker(
    QUEUE_NAMES.WHATSAPP_SEND,
    processWhatsAppSend,
    { connection, concurrency: 3 }
  )

  const webchatMessageWorker = new Worker(
    QUEUE_NAMES.WEBCHAT_MESSAGE,
    processWebChatMessage,
    { connection, concurrency: 5 }
  )

  const automationWorker = new Worker(
    QUEUE_NAMES.AUTOMATION,
    processAutomation,
    { connection, concurrency: 2 }
  )

  const notificationWorker = new Worker(
    QUEUE_NAMES.NOTIFICATION,
    processNotification,
    { connection, concurrency: 5 }
  )

  const mediaDownloadWorker = new Worker(
    QUEUE_NAMES.WHATSAPP_MEDIA,
    processMediaDownload,
    { connection, concurrency: 3 }
  )

  const aiAssistantWorker = new Worker(
    QUEUE_NAMES.AI_ASSISTANT,
    processAIAssistant,
    { connection, concurrency: 2 } // Limit concurrency for AI API rate limits
  )

  workers = [
    whatsappMessageWorker,
    whatsappSendWorker,
    webchatMessageWorker,
    automationWorker,
    notificationWorker,
    mediaDownloadWorker,
    aiAssistantWorker,
  ]

  // Add event listeners for all workers
  workers.forEach((worker) => {
    worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed on ${worker.name}`)
    })

    worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed on ${worker.name}:`, err)
    })

    worker.on('error', (err) => {
      console.error(`Worker ${worker.name} error:`, err)
    })
  })

  console.log('Queue workers started successfully')
  return workers
}

// Stop all workers
export async function stopWorkers() {
  console.log('Stopping queue workers...')
  await Promise.all(workers.map((worker) => worker.close()))
  workers = []
  console.log('Queue workers stopped')
}

// Get worker status
export function getWorkersStatus() {
  return workers.map((worker) => ({
    name: worker.name,
    isRunning: worker.isRunning(),
    isPaused: worker.isPaused(),
  }))
}

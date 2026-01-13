import {
  whatsappMessageQueue,
  whatsappSendQueue,
  whatsappMediaQueue,
  webchatMessageQueue,
  automationQueue,
  notificationQueue,
  aiAssistantQueue,
} from './queues'
import type {
  WhatsAppMessageJobData,
  WhatsAppSendJobData,
  WebChatMessageJobData,
  AutomationJobData,
  NotificationJobData,
  MediaDownloadJobData,
  AIAssistantJobData,
} from './types'

// Add WhatsApp incoming message to queue
export async function addWhatsAppMessageJob(data: WhatsAppMessageJobData) {
  return whatsappMessageQueue.add('process-message', data, {
    priority: 1,
  })
}

// Add WhatsApp send message to queue
export async function addWhatsAppSendJob(data: WhatsAppSendJobData) {
  return whatsappSendQueue.add('send-message', data, {
    priority: 1,
  })
}

// Add WebChat message to queue
export async function addWebChatMessageJob(data: WebChatMessageJobData) {
  return webchatMessageQueue.add('process-message', data, {
    priority: 1,
  })
}

// Add automation job to queue
export async function addAutomationJob(data: AutomationJobData, delay?: number) {
  return automationQueue.add('execute-automation', data, {
    priority: 2,
    delay,
  })
}

// Add notification job to queue
export async function addNotificationJob(data: NotificationJobData) {
  return notificationQueue.add('send-notification', data, {
    priority: 3,
  })
}

// Add media download job to queue
export async function addMediaDownloadJob(data: MediaDownloadJobData) {
  return whatsappMediaQueue.add('download-media', data, {
    priority: 2,
  })
}

// Add AI assistant job to queue
export async function addAIAssistantJob(data: AIAssistantJobData) {
  return aiAssistantQueue.add('generate-response', data, {
    priority: 1, // High priority for real-time responses
  })
}

// Bulk add jobs
export async function addWhatsAppMessageJobsBulk(jobs: WhatsAppMessageJobData[]) {
  const bulkJobs = jobs.map((data) => ({
    name: 'process-message',
    data,
    opts: { priority: 1 },
  }))
  return whatsappMessageQueue.addBulk(bulkJobs)
}

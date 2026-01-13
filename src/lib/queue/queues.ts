import { Queue } from 'bullmq'
import { connection } from './connection'

// Queue names
export const QUEUE_NAMES = {
  WHATSAPP_MESSAGE: 'whatsapp-message',
  WHATSAPP_SEND: 'whatsapp-send',
  WHATSAPP_MEDIA: 'whatsapp-media',
  WEBCHAT_MESSAGE: 'webchat-message',
  AUTOMATION: 'automation',
  NOTIFICATION: 'notification',
  AI_ASSISTANT: 'ai-assistant',
} as const

// Queue options
const defaultQueueOptions = {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600, // 7 days
    },
  },
}

// Create queues
export const whatsappMessageQueue = new Queue(QUEUE_NAMES.WHATSAPP_MESSAGE, defaultQueueOptions)
export const whatsappSendQueue = new Queue(QUEUE_NAMES.WHATSAPP_SEND, defaultQueueOptions)
export const whatsappMediaQueue = new Queue(QUEUE_NAMES.WHATSAPP_MEDIA, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 5,
    backoff: {
      type: 'exponential' as const,
      delay: 2000,
    },
  },
})
export const webchatMessageQueue = new Queue(QUEUE_NAMES.WEBCHAT_MESSAGE, defaultQueueOptions)
export const automationQueue = new Queue(QUEUE_NAMES.AUTOMATION, defaultQueueOptions)
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, defaultQueueOptions)
export const aiAssistantQueue = new Queue(QUEUE_NAMES.AI_ASSISTANT, {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    attempts: 2, // AI calls can be expensive, limit retries
    backoff: {
      type: 'exponential' as const,
      delay: 3000,
    },
  },
})

// Get all queues
export const getAllQueues = () => [
  whatsappMessageQueue,
  whatsappSendQueue,
  whatsappMediaQueue,
  webchatMessageQueue,
  automationQueue,
  notificationQueue,
  aiAssistantQueue,
]

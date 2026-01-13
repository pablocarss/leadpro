// Queue system exports
export { connection, getRedisConnection } from './connection'
export {
  QUEUE_NAMES,
  whatsappMessageQueue,
  whatsappSendQueue,
  whatsappMediaQueue,
  webchatMessageQueue,
  automationQueue,
  notificationQueue,
  aiAssistantQueue,
  getAllQueues,
} from './queues'
export {
  addWhatsAppMessageJob,
  addWhatsAppSendJob,
  addWebChatMessageJob,
  addAutomationJob,
  addNotificationJob,
  addMediaDownloadJob,
  addAIAssistantJob,
  addWhatsAppMessageJobsBulk,
} from './jobs'
export {
  startWorkers,
  stopWorkers,
  getWorkersStatus,
} from './workers'
export type {
  WhatsAppMessageJobData,
  WhatsAppSendJobData,
  WebChatMessageJobData,
  AutomationJobData,
  NotificationJobData,
  MediaDownloadJobData,
  AIAssistantJobData,
  JobResult,
} from './types'

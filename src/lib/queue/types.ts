// WhatsApp Message Job Types
export interface WhatsAppMessageJobData {
  sessionId: string
  messageId?: string
  chatId: string
  from: string
  to: string
  body: string
  mediaUrl?: string
  mediaType?: string
  mediaMimeType?: string
  mediaDuration?: number
  mediaFileName?: string
  isFromMe: boolean
  timestamp: Date
}

export interface WhatsAppSendJobData {
  sessionId: string
  to: string
  message: string
  mediaUrl?: string
  mediaType?: 'image' | 'video' | 'audio' | 'document'
}

// WebChat Message Job Types
export interface WebChatMessageJobData {
  sessionId: string
  content: string
  isFromVisitor: boolean
  operatorId?: string
  visitorId?: string
}

// Automation Job Types
export interface AutomationJobData {
  automationId: string
  chatId: string
  sessionId: string
  trigger: string
  messageBody?: string
  variables?: Record<string, unknown>
}

// Notification Job Types
export interface NotificationJobData {
  type: 'email' | 'push' | 'webhook'
  userId?: string
  title: string
  body: string
  data?: Record<string, unknown>
  webhookUrl?: string
}

// Media Download Job Types
export interface MediaDownloadJobData {
  messageId: string
  sessionId: string
  mediaType: string
  mediaMimeType?: string
  mediaFileName?: string
}

// AI Assistant Job Types
export interface AIAssistantJobData {
  sessionId: string
  chatId: string
  messageBody: string
  configId: string
}

// Job result types
export interface JobResult {
  success: boolean
  message?: string
  data?: unknown
}

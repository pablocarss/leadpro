import { AIProvider } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

// ==================== TYPES ====================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIOptions {
  model: string
  temperature: number
  maxTokens: number
}

interface AIProviderInterface {
  generateResponse(messages: ChatMessage[], options: AIOptions): Promise<string>
  validateApiKey(): Promise<boolean>
}

// ==================== PROVIDER IMPLEMENTATIONS ====================

/**
 * OpenAI Provider (ChatGPT)
 */
class OpenAIProvider implements AIProviderInterface {
  private apiKey: string
  private baseUrl = 'https://api.openai.com/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateResponse(messages: ChatMessage[], options: AIOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * Anthropic Provider (Claude)
 */
class AnthropicProvider implements AIProviderInterface {
  private apiKey: string
  private baseUrl = 'https://api.anthropic.com/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateResponse(messages: ChatMessage[], options: AIOptions): Promise<string> {
    // Anthropic uses a different format - system prompt is separate
    const systemMessage = messages.find(m => m.role === 'system')
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens,
        system: systemMessage?.content || '',
        messages: chatMessages,
        temperature: options.temperature,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return data.content[0]?.text || ''
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Anthropic doesn't have a simple validation endpoint, try a minimal request
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * DeepSeek Provider
 */
class DeepSeekProvider implements AIProviderInterface {
  private apiKey: string
  private baseUrl = 'https://api.deepseek.com/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateResponse(messages: ChatMessage[], options: AIOptions): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: messages,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`DeepSeek API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || ''
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * Google Gemini Provider
 */
class GeminiProvider implements AIProviderInterface {
  private apiKey: string
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generateResponse(messages: ChatMessage[], options: AIOptions): Promise<string> {
    // Gemini uses a different format
    const systemMessage = messages.find(m => m.role === 'system')
    const chatMessages = messages.filter(m => m.role !== 'system')

    // Convert to Gemini format
    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `${this.baseUrl}/models/${options.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
          generationConfig: {
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`
      )
      return response.ok
    } catch {
      return false
    }
  }
}

// ==================== PROVIDER FACTORY ====================

class AIProviderFactory {
  static getProvider(type: AIProvider, apiKey: string): AIProviderInterface {
    switch (type) {
      case 'OPENAI':
        return new OpenAIProvider(apiKey)
      case 'ANTHROPIC':
        return new AnthropicProvider(apiKey)
      case 'DEEPSEEK':
        return new DeepSeekProvider(apiKey)
      case 'GEMINI':
        return new GeminiProvider(apiKey)
      default:
        throw new Error(`Unknown AI provider: ${type}`)
    }
  }
}

// ==================== MODEL CONFIGURATIONS ====================

export const PROVIDER_MODELS = {
  OPENAI: [
    { id: 'gpt-4o', name: 'GPT-4o (Recomendado)', default: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Mais rápido)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (Econômico)' },
  ],
  ANTHROPIC: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recomendado)', default: true },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Mais rápido)' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Mais capaz)' },
  ],
  DEEPSEEK: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat (Recomendado)', default: true },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (Avançado)' },
  ],
  GEMINI: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Recomendado)', default: true },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' },
  ],
}

export function getDefaultModel(provider: AIProvider): string {
  const models = PROVIDER_MODELS[provider]
  const defaultModel = models.find(m => m.default) || models[0]
  return defaultModel.id
}

// ==================== MAIN AI SERVICE ====================

class AIAssistantService {
  /**
   * Generate a response using the configured AI provider
   */
  async generateResponse(
    sessionId: string,
    chatId: string,
    incomingMessage: string
  ): Promise<string | null> {
    // Get AI configuration for this session
    const config = await prisma.aIAssistantConfig.findUnique({
      where: { whatsappSessionId: sessionId },
    })

    if (!config || !config.isEnabled) {
      return null
    }

    try {
      // Get conversation history for context
      const context = await this.getConversationContext(
        sessionId,
        chatId,
        config.contextMessages
      )

      // Build messages array for AI
      const messages: ChatMessage[] = [
        { role: 'system', content: config.systemPrompt },
        ...context,
        { role: 'user', content: incomingMessage },
      ]

      // Get appropriate provider
      const decryptedKey = decrypt(config.apiKey)
      const provider = AIProviderFactory.getProvider(config.provider, decryptedKey)

      // Generate response
      const response = await provider.generateResponse(messages, {
        model: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      })

      return response
    } catch (error) {
      console.error('AI Assistant error:', error)
      throw error
    }
  }

  /**
   * Get conversation history from database
   */
  async getConversationContext(
    sessionId: string,
    chatId: string,
    limit: number
  ): Promise<ChatMessage[]> {
    const messages = await prisma.whatsappMessage.findMany({
      where: { sessionId, chatId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      select: {
        body: true,
        isFromMe: true,
        timestamp: true,
      },
    })

    // Reverse to chronological order and map to chat format
    return messages.reverse().map(msg => ({
      role: msg.isFromMe ? 'assistant' : 'user',
      content: msg.body,
    }))
  }

  /**
   * Test AI configuration with a sample message
   */
  async testConfiguration(
    provider: AIProvider,
    model: string,
    apiKey: string,
    systemPrompt: string,
    temperature: number,
    testMessage: string
  ): Promise<{ success: boolean; response?: string; error?: string }> {
    try {
      const aiProvider = AIProviderFactory.getProvider(provider, apiKey)

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: testMessage },
      ]

      const response = await aiProvider.generateResponse(messages, {
        model,
        temperature,
        maxTokens: 500, // Limit for test
      })

      return { success: true, response }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }
    }
  }

  /**
   * Validate API key for a provider
   */
  async validateApiKey(provider: AIProvider, apiKey: string): Promise<boolean> {
    try {
      const aiProvider = AIProviderFactory.getProvider(provider, apiKey)
      return await aiProvider.validateApiKey()
    } catch {
      return false
    }
  }

  /**
   * Check if AI assistant is enabled for a session
   */
  async isEnabledForSession(sessionId: string): Promise<boolean> {
    const config = await prisma.aIAssistantConfig.findUnique({
      where: { whatsappSessionId: sessionId },
      select: { isEnabled: true },
    })
    return config?.isEnabled ?? false
  }

  /**
   * Get configuration for a session
   */
  async getConfig(sessionId: string) {
    return prisma.aIAssistantConfig.findUnique({
      where: { whatsappSessionId: sessionId },
    })
  }
}

// Export singleton instance
export const aiAssistantService = new AIAssistantService()

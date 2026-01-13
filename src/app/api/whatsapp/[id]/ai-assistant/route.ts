import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { encrypt, decrypt, maskApiKey, isEncrypted } from '@/lib/encryption'
import { PROVIDER_MODELS, getDefaultModel } from '@/services/ai.service'

const createSchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'GEMINI']),
  model: z.string().min(1),
  apiKey: z.string().min(1),
  systemPrompt: z.string().min(10, 'O prompt do sistema deve ter pelo menos 10 caracteres'),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(100).max(4096).default(1024),
  contextMessages: z.number().min(1).max(50).default(10),
  isEnabled: z.boolean().default(false),
})

const updateSchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'GEMINI']).optional(),
  model: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  systemPrompt: z.string().min(10).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(100).max(4096).optional(),
  contextMessages: z.number().min(1).max(50).optional(),
  isEnabled: z.boolean().optional(),
})

// GET - Fetch AI assistant config for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: sessionId } = await params

    // Verify session belongs to user
    const session = await prisma.whatsappSession.findFirst({
      where: {
        id: sessionId,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    // Get AI config
    const config = await prisma.aIAssistantConfig.findUnique({
      where: { whatsappSessionId: sessionId },
    })

    if (!config) {
      return NextResponse.json({
        exists: false,
        providerModels: PROVIDER_MODELS,
      })
    }

    // Return config with masked API key
    return NextResponse.json({
      exists: true,
      config: {
        id: config.id,
        provider: config.provider,
        model: config.model,
        apiKeyMasked: maskApiKey(decrypt(config.apiKey)),
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        contextMessages: config.contextMessages,
        isEnabled: config.isEnabled,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
      providerModels: PROVIDER_MODELS,
    })
  } catch (error) {
    console.error('Error fetching AI config:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// POST - Create AI assistant config
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: sessionId } = await params
    const body = await request.json()
    const data = createSchema.parse(body)

    // Verify session belongs to user
    const session = await prisma.whatsappSession.findFirst({
      where: {
        id: sessionId,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    // Check if config already exists
    const existing = await prisma.aIAssistantConfig.findUnique({
      where: { whatsappSessionId: sessionId },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Configuração já existe. Use PUT para atualizar.' },
        { status: 409 }
      )
    }

    // Create config with encrypted API key
    const config = await prisma.aIAssistantConfig.create({
      data: {
        whatsappSessionId: sessionId,
        provider: data.provider,
        model: data.model,
        apiKey: encrypt(data.apiKey),
        systemPrompt: data.systemPrompt,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        contextMessages: data.contextMessages,
        isEnabled: data.isEnabled,
      },
    })

    return NextResponse.json({
      message: 'Configuração criada com sucesso',
      config: {
        id: config.id,
        provider: config.provider,
        model: config.model,
        apiKeyMasked: maskApiKey(data.apiKey),
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        contextMessages: config.contextMessages,
        isEnabled: config.isEnabled,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Error creating AI config:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// PUT - Update AI assistant config
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: sessionId } = await params
    const body = await request.json()
    const data = updateSchema.parse(body)

    // Verify session belongs to user
    const session = await prisma.whatsappSession.findFirst({
      where: {
        id: sessionId,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    // Check if config exists
    const existing = await prisma.aIAssistantConfig.findUnique({
      where: { whatsappSessionId: sessionId },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Configuração não encontrada. Use POST para criar.' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}

    if (data.provider !== undefined) updateData.provider = data.provider
    if (data.model !== undefined) updateData.model = data.model
    if (data.apiKey !== undefined) updateData.apiKey = encrypt(data.apiKey)
    if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt
    if (data.temperature !== undefined) updateData.temperature = data.temperature
    if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens
    if (data.contextMessages !== undefined) updateData.contextMessages = data.contextMessages
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled

    // Update config
    const config = await prisma.aIAssistantConfig.update({
      where: { whatsappSessionId: sessionId },
      data: updateData,
    })

    return NextResponse.json({
      message: 'Configuração atualizada com sucesso',
      config: {
        id: config.id,
        provider: config.provider,
        model: config.model,
        apiKeyMasked: maskApiKey(decrypt(config.apiKey)),
        systemPrompt: config.systemPrompt,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        contextMessages: config.contextMessages,
        isEnabled: config.isEnabled,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Error updating AI config:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

// DELETE - Remove AI assistant config
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id: sessionId } = await params

    // Verify session belongs to user
    const session = await prisma.whatsappSession.findFirst({
      where: {
        id: sessionId,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    // Check if config exists
    const existing = await prisma.aIAssistantConfig.findUnique({
      where: { whatsappSessionId: sessionId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Configuração não encontrada' }, { status: 404 })
    }

    // Delete config
    await prisma.aIAssistantConfig.delete({
      where: { whatsappSessionId: sessionId },
    })

    return NextResponse.json({ message: 'Configuração removida com sucesso' })
  } catch (error) {
    console.error('Error deleting AI config:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

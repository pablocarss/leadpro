import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { aiAssistantService } from '@/services/ai.service'
import { AIProvider } from '@prisma/client'
import { decrypt } from '@/lib/encryption'

const testSchema = z.object({
  provider: z.enum(['OPENAI', 'ANTHROPIC', 'DEEPSEEK', 'GEMINI']),
  model: z.string().min(1),
  apiKey: z.string().optional(), // Optional - can use stored key
  systemPrompt: z.string().min(10),
  temperature: z.number().min(0).max(2),
  testMessage: z.string().min(1, 'Digite uma mensagem de teste'),
})

// POST - Test AI configuration
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
    const data = testSchema.parse(body)

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

    // Get API key - use provided or fetch from stored config
    let apiKey = data.apiKey

    if (!apiKey || apiKey === 'use-existing') {
      // Try to get stored API key
      const existingConfig = await prisma.aIAssistantConfig.findUnique({
        where: { whatsappSessionId: sessionId },
      })

      if (!existingConfig) {
        return NextResponse.json({
          error: 'Informe a API Key para testar'
        }, { status: 400 })
      }

      apiKey = decrypt(existingConfig.apiKey)
    }

    // Test the configuration
    const result = await aiAssistantService.testConfiguration(
      data.provider as AIProvider,
      data.model,
      apiKey,
      data.systemPrompt,
      data.temperature,
      data.testMessage
    )

    if (result.success) {
      return NextResponse.json({
        success: true,
        response: result.response,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
      }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('Error testing AI config:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

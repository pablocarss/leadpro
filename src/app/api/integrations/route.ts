import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createIntegrationSchema = z.object({
  name: z.string().min(2),
  type: z.enum(['WHATSAPP_OFFICIAL', 'WHATSAPP_BAILEYS', 'EMAIL_SMTP', 'TELEGRAM', 'INSTAGRAM']),
  config: z.any().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const integrations = await prisma.integration.findMany({
      where: { userId: user.userId },
      include: {
        whatsappSessions: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
            lastConnected: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(integrations)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createIntegrationSchema.parse(body)

    const existingIntegration = await prisma.integration.findUnique({
      where: {
        userId_type: {
          userId: user.userId,
          type: validatedData.type,
        },
      },
    })

    if (existingIntegration) {
      return NextResponse.json({ error: 'Integração já existe' }, { status: 400 })
    }

    const integration = await prisma.integration.create({
      data: {
        name: validatedData.name,
        type: validatedData.type,
        config: validatedData.config,
        userId: user.userId,
      },
    })

    return NextResponse.json(integration, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

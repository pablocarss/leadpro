import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { whatsappService } from '@/services/whatsapp.service'

const createSessionSchema = z.object({
  name: z.string().min(2),
  integrationId: z.string().cuid(),
  syncContacts: z.boolean().default(false),
  syncHistory: z.boolean().default(false),
  historyDays: z.number().min(1).max(30).default(7),
})

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('integrationId')

    const sessions = await prisma.whatsappSession.findMany({
      where: {
        integration: {
          userId: user.userId,
          ...(integrationId && { id: integrationId }),
        },
      },
      include: {
        integration: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        _count: {
          select: { messages: true, contacts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(sessions)
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
    const validatedData = createSessionSchema.parse(body)

    const integration = await prisma.integration.findFirst({
      where: {
        id: validatedData.integrationId,
        userId: user.userId,
      },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 })
    }

    const session = await prisma.whatsappSession.create({
      data: {
        name: validatedData.name,
        integrationId: validatedData.integrationId,
        status: 'CONNECTING',
        syncContacts: validatedData.syncContacts,
        syncHistory: validatedData.syncHistory,
        historyDays: validatedData.historyDays,
      },
    })

    // Start Baileys session in background
    whatsappService.createSession(session.id, {
      syncContacts: validatedData.syncContacts,
      syncHistory: validatedData.syncHistory,
      historyDays: validatedData.historyDays,
    }).catch(console.error)

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

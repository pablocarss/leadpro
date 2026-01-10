import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { whatsappService } from '@/services/whatsapp.service'

const sendMessageSchema = z.object({
  to: z.string().min(10),
  message: z.string().min(1),
})

const markReadSchema = z.object({
  chatId: z.string(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const chatId = searchParams.get('chatId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const session = await prisma.whatsappSession.findFirst({
      where: {
        id,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    const where = {
      sessionId: id,
      ...(chatId && { chatId }),
    }

    const [messages, total] = await Promise.all([
      prisma.whatsappMessage.findMany({
        where,
        orderBy: { timestamp: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.whatsappMessage.count({ where }),
    ])

    return NextResponse.json({
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { to, message } = sendMessageSchema.parse(body)

    const session = await prisma.whatsappSession.findFirst({
      where: {
        id,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    if (session.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'Sessão não está conectada' }, { status: 400 })
    }

    const result = await whatsappService.sendMessage(id, to, message)

    return NextResponse.json({
      message: 'Mensagem enviada com sucesso',
      messageId: result.messageId,
    })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { chatId } = markReadSchema.parse(body)

    const session = await prisma.whatsappSession.findFirst({
      where: {
        id,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    await whatsappService.markAsRead(id, chatId)

    return NextResponse.json({ message: 'Mensagens marcadas como lidas' })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

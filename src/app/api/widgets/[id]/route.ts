import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateWidgetSchema = z.object({
  name: z.string().min(2).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  position: z.enum(['left', 'right']).optional(),
  welcomeMessage: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const widget = await prisma.webChatWidget.findFirst({
      where: { id, userId: user.userId },
      include: {
        sessions: {
          orderBy: { updatedAt: 'desc' },
          take: 20,
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            _count: { select: { messages: true } },
          },
        },
      },
    })

    if (!widget) {
      return NextResponse.json({ error: 'Widget não encontrado' }, { status: 404 })
    }

    return NextResponse.json(widget)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateWidgetSchema.parse(body)

    const existing = await prisma.webChatWidget.findFirst({
      where: { id, userId: user.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Widget não encontrado' }, { status: 404 })
    }

    const widget = await prisma.webChatWidget.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(widget)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.webChatWidget.findFirst({
      where: { id, userId: user.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Widget não encontrado' }, { status: 404 })
    }

    await prisma.webChatWidget.delete({ where: { id } })

    return NextResponse.json({ message: 'Widget excluído com sucesso' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

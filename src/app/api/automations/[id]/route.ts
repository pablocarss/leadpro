import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateAutomationSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  trigger: z.enum(['KEYWORD', 'NEW_CONVERSATION', 'ALL_MESSAGES', 'BUTTON_REPLY', 'SCHEDULE']).optional(),
  triggerValue: z.string().optional(),
  whatsappSessionId: z.string().nullable().optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
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

    const automation = await prisma.automation.findFirst({
      where: {
        id,
        userId: user.userId,
      },
      include: {
        whatsappSession: {
          select: {
            id: true,
            name: true,
            phone: true,
            status: true,
          },
        },
        executions: {
          take: 10,
          orderBy: { startedAt: 'desc' },
        },
      },
    })

    if (!automation) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 })
    }

    return NextResponse.json(automation)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PUT(
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
    const validatedData = updateAutomationSchema.parse(body)

    const existingAutomation = await prisma.automation.findFirst({
      where: {
        id,
        userId: user.userId,
      },
    })

    if (!existingAutomation) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 })
    }

    const automation = await prisma.automation.update({
      where: { id },
      data: validatedData,
      include: {
        whatsappSession: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    })

    return NextResponse.json(automation)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const existingAutomation = await prisma.automation.findFirst({
      where: {
        id,
        userId: user.userId,
      },
    })

    if (!existingAutomation) {
      return NextResponse.json({ error: 'Automação não encontrada' }, { status: 404 })
    }

    await prisma.automation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

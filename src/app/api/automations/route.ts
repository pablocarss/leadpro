import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createAutomationSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  trigger: z.enum(['KEYWORD', 'NEW_CONVERSATION', 'ALL_MESSAGES', 'BUTTON_REPLY', 'SCHEDULE']).default('KEYWORD'),
  triggerValue: z.string().optional(),
  whatsappSessionId: z.string().optional(),
  nodes: z.array(z.any()).default([]),
  edges: z.array(z.any()).default([]),
})

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const whatsappSessionId = searchParams.get('whatsappSessionId')

    const automations = await prisma.automation.findMany({
      where: {
        userId: user.userId,
        ...(whatsappSessionId && { whatsappSessionId }),
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
        _count: {
          select: { executions: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(automations)
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
    const validatedData = createAutomationSchema.parse(body)

    // Create initial nodes if empty
    const initialNodes = validatedData.nodes.length > 0 ? validatedData.nodes : [
      {
        id: 'start',
        type: 'startNode',
        position: { x: 250, y: 50 },
        data: { label: 'Início' },
      },
    ]

    const automation = await prisma.automation.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        trigger: validatedData.trigger,
        triggerValue: validatedData.triggerValue,
        whatsappSessionId: validatedData.whatsappSessionId,
        userId: user.userId,
        nodes: initialNodes,
        edges: validatedData.edges,
      },
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

    return NextResponse.json(automation, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

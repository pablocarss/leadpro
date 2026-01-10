import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createWidgetSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  position: z.enum(['left', 'right']).optional(),
  welcomeMessage: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
})

const updateWidgetSchema = z.object({
  name: z.string().min(2).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  position: z.enum(['left', 'right']).optional(),
  welcomeMessage: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const widgets = await prisma.webChatWidget.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { sessions: true } },
      },
    })

    return NextResponse.json({ data: widgets })
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
    const validatedData = createWidgetSchema.parse(body)

    const widget = await prisma.webChatWidget.create({
      data: {
        name: validatedData.name,
        primaryColor: validatedData.primaryColor || '#3B82F6',
        position: validatedData.position || 'right',
        welcomeMessage: validatedData.welcomeMessage || 'Olá! Como posso ajudar?',
        allowedDomains: validatedData.allowedDomains || [],
        userId: user.userId,
      },
    })

    return NextResponse.json(widget, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

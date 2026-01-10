import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateIntegrationSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(['CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR']).optional(),
  config: z.any().optional(),
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

    const integration = await prisma.integration.findFirst({
      where: { id, userId: user.userId },
      include: {
        whatsappSessions: true,
      },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 })
    }

    return NextResponse.json(integration)
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
    const validatedData = updateIntegrationSchema.parse(body)

    const integration = await prisma.integration.findFirst({
      where: { id, userId: user.userId },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 })
    }

    const updatedIntegration = await prisma.integration.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(updatedIntegration)
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

    const integration = await prisma.integration.findFirst({
      where: { id, userId: user.userId },
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integração não encontrada' }, { status: 404 })
    }

    await prisma.integration.delete({ where: { id } })

    return NextResponse.json({ message: 'Integração excluída com sucesso' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

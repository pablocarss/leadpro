import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updatePipelineSchema } from '@/validators'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
      include: {
        stages: { orderBy: { order: 'asc' } },
        leads: {
          include: {
            stage: true,
            contact: true,
            lead: true,
            movements: {
              include: {
                fromStage: true,
                toStage: true,
                user: { select: { id: true, name: true } },
              },
              orderBy: { movedAt: 'desc' },
              take: 5,
            },
          },
        },
        _count: { select: { leads: true } },
      },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    return NextResponse.json(pipeline)
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
    const validatedData = updatePipelineSchema.parse(body)

    // Verificar se a pipeline existe e pertence ao usuário
    const existing = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    // Se for definida como padrão, remover padrão das outras
    if (validatedData.isDefault) {
      await prisma.pipeline.updateMany({
        where: { userId: user.userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const pipeline = await prisma.pipeline.update({
      where: { id },
      data: validatedData,
      include: {
        stages: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json(pipeline)
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

    const existing = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    await prisma.pipeline.delete({ where: { id } })

    return NextResponse.json({ message: 'Pipeline excluída com sucesso' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

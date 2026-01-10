import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createStageSchema } from '@/validators'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId: id },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { leads: true } },
      },
    })

    return NextResponse.json({ data: stages })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = createStageSchema.parse(body)

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    const stage = await prisma.pipelineStage.create({
      data: {
        name: validatedData.name,
        color: validatedData.color || '#6B7280',
        order: validatedData.order,
        isWon: validatedData.isWon || false,
        isLost: validatedData.isLost || false,
        pipelineId: id,
      },
    })

    return NextResponse.json(stage, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

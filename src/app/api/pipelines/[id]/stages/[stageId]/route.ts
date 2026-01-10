import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateStageSchema } from '@/validators'

type RouteParams = { params: Promise<{ id: string; stageId: string }> }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id, stageId } = await params
    const body = await request.json()
    const validatedData = updateStageSchema.parse(body)

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    // Verificar se o estágio existe
    const existing = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId: id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    }

    const stage = await prisma.pipelineStage.update({
      where: { id: stageId },
      data: validatedData,
    })

    return NextResponse.json(stage)
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

    const { id, stageId } = await params

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    // Verificar se o estágio existe
    const existing = await prisma.pipelineStage.findFirst({
      where: { id: stageId, pipelineId: id },
      include: { _count: { select: { leads: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    }

    // Verificar se há leads no estágio
    if (existing._count.leads > 0) {
      return NextResponse.json(
        { error: 'Não é possível excluir um estágio que contém leads' },
        { status: 400 }
      )
    }

    await prisma.pipelineStage.delete({ where: { id: stageId } })

    return NextResponse.json({ message: 'Estágio excluído com sucesso' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

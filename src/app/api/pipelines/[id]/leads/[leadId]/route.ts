import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updatePipelineLeadSchema } from '@/validators'

type RouteParams = { params: Promise<{ id: string; leadId: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id, leadId } = await params

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    const pipelineLead = await prisma.pipelineLead.findFirst({
      where: { id: leadId, pipelineId: id },
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
        },
      },
    })

    if (!pipelineLead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    return NextResponse.json(pipelineLead)
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

    const { id, leadId } = await params
    const body = await request.json()
    const validatedData = updatePipelineLeadSchema.parse(body)

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    // Verificar se o lead existe
    const existing = await prisma.pipelineLead.findFirst({
      where: { id: leadId, pipelineId: id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    // Se estiver mudando de estágio, verificar se o novo estágio existe
    if (validatedData.stageId && validatedData.stageId !== existing.stageId) {
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: validatedData.stageId, pipelineId: id },
      })

      if (!stage) {
        return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
      }
    }

    const pipelineLead = await prisma.pipelineLead.update({
      where: { id: leadId },
      data: validatedData,
      include: {
        stage: true,
        contact: true,
        lead: true,
      },
    })

    return NextResponse.json(pipelineLead)
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

    const { id, leadId } = await params

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    const existing = await prisma.pipelineLead.findFirst({
      where: { id: leadId, pipelineId: id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    await prisma.pipelineLead.delete({ where: { id: leadId } })

    return NextResponse.json({ message: 'Lead excluído com sucesso' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

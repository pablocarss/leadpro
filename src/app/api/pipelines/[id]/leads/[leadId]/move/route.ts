import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { moveLeadSchema } from '@/validators'

type RouteParams = { params: Promise<{ id: string; leadId: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id, leadId } = await params
    const body = await request.json()
    const validatedData = moveLeadSchema.parse(body)

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    // Verificar se o lead existe
    const pipelineLead = await prisma.pipelineLead.findFirst({
      where: { id: leadId, pipelineId: id },
      include: { stage: true },
    })

    if (!pipelineLead) {
      return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
    }

    // Verificar se o estágio de destino existe
    const toStage = await prisma.pipelineStage.findFirst({
      where: { id: validatedData.toStageId, pipelineId: id },
    })

    if (!toStage) {
      return NextResponse.json({ error: 'Estágio de destino não encontrado' }, { status: 404 })
    }

    // Não mover se já está no mesmo estágio
    if (pipelineLead.stageId === validatedData.toStageId) {
      return NextResponse.json({ error: 'Lead já está neste estágio' }, { status: 400 })
    }

    // Atualizar o lead e criar registro de movimento
    const [updatedLead] = await prisma.$transaction([
      prisma.pipelineLead.update({
        where: { id: leadId },
        data: {
          stageId: validatedData.toStageId,
          wonAt: toStage.isWon ? new Date() : null,
          lostAt: toStage.isLost ? new Date() : null,
        },
        include: {
          stage: true,
          contact: true,
          lead: true,
        },
      }),
      prisma.stageMovement.create({
        data: {
          pipelineLeadId: leadId,
          fromStageId: pipelineLead.stageId,
          toStageId: validatedData.toStageId,
          reason: validatedData.reason,
          userId: user.userId,
        },
      }),
    ])

    return NextResponse.json(updatedLead)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

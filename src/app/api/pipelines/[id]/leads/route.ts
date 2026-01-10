import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPipelineLeadSchema } from '@/validators'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId') || undefined

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    const leads = await prisma.pipelineLead.findMany({
      where: {
        pipelineId: id,
        ...(stageId && { stageId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        stage: true,
        contact: true,
        lead: true,
      },
    })

    return NextResponse.json({ data: leads })
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
    const validatedData = createPipelineLeadSchema.parse(body)

    // Verificar se a pipeline existe e pertence ao usuário
    const pipeline = await prisma.pipeline.findFirst({
      where: { id, userId: user.userId },
    })

    if (!pipeline) {
      return NextResponse.json({ error: 'Pipeline não encontrada' }, { status: 404 })
    }

    // Verificar se o estágio existe e pertence à pipeline
    const stage = await prisma.pipelineStage.findFirst({
      where: { id: validatedData.stageId, pipelineId: id },
    })

    if (!stage) {
      return NextResponse.json({ error: 'Estágio não encontrado' }, { status: 404 })
    }

    const pipelineLead = await prisma.pipelineLead.create({
      data: {
        title: validatedData.title,
        value: validatedData.value,
        notes: validatedData.notes,
        pipelineId: id,
        stageId: validatedData.stageId,
        contactId: validatedData.contactId,
        leadId: validatedData.leadId,
      },
      include: {
        stage: true,
        contact: true,
        lead: true,
      },
    })

    // Registrar movimento inicial
    await prisma.stageMovement.create({
      data: {
        pipelineLeadId: pipelineLead.id,
        toStageId: validatedData.stageId,
        userId: user.userId,
        reason: 'Lead adicionado à pipeline',
      },
    })

    return NextResponse.json(pipelineLead, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

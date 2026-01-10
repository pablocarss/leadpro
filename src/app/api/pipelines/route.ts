import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createPipelineSchema } from '@/validators'

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const includeStages = searchParams.get('includeStages') === 'true'
    const includeLeads = searchParams.get('includeLeads') === 'true'

    const pipelines = await prisma.pipeline.findMany({
      where: { userId: user.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      include: {
        stages: includeStages ? { orderBy: { order: 'asc' } } : false,
        leads: includeLeads ? {
          include: {
            stage: true,
            contact: true,
            lead: true,
          }
        } : false,
        _count: {
          select: { leads: true, stages: true }
        }
      },
    })

    return NextResponse.json({ data: pipelines })
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
    const validatedData = createPipelineSchema.parse(body)

    // Se for definida como padrão, remover padrão das outras
    if (validatedData.isDefault) {
      await prisma.pipeline.updateMany({
        where: { userId: user.userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const pipeline = await prisma.pipeline.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        color: validatedData.color || '#3B82F6',
        isDefault: validatedData.isDefault || false,
        userId: user.userId,
        stages: validatedData.stages ? {
          create: validatedData.stages.map((stage, index) => ({
            name: stage.name,
            color: stage.color || '#6B7280',
            order: stage.order ?? index,
            isWon: stage.isWon || false,
            isLost: stage.isLost || false,
          }))
        } : {
          create: [
            { name: 'Novo', color: '#6B7280', order: 0 },
            { name: 'Qualificação', color: '#3B82F6', order: 1 },
            { name: 'Proposta', color: '#8B5CF6', order: 2 },
            { name: 'Negociação', color: '#F59E0B', order: 3 },
            { name: 'Ganho', color: '#10B981', order: 4, isWon: true },
            { name: 'Perdido', color: '#EF4444', order: 5, isLost: true },
          ]
        }
      },
      include: {
        stages: { orderBy: { order: 'asc' } },
      },
    })

    return NextResponse.json(pipeline, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

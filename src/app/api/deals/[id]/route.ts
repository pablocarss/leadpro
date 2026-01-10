import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { updateDealSchema } from '@/validators'

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

    const deal = await prisma.deal.findFirst({
      where: { id, userId: user.userId },
      include: { contact: true, company: true, notes: true, tasks: true },
    })

    if (!deal) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    return NextResponse.json(deal)
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
    const validatedData = updateDealSchema.parse(body)

    const updateData: Record<string, unknown> = { ...validatedData }
    if (validatedData.expectedCloseDate) {
      updateData.expectedCloseDate = new Date(validatedData.expectedCloseDate)
    }
    if (validatedData.closedAt) {
      updateData.closedAt = new Date(validatedData.closedAt)
    }

    const deal = await prisma.deal.updateMany({
      where: { id, userId: user.userId },
      data: updateData,
    })

    if (deal.count === 0) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    const updatedDeal = await prisma.deal.findUnique({
      where: { id },
      include: { contact: true, company: true },
    })
    return NextResponse.json(updatedDeal)
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

    const deal = await prisma.deal.deleteMany({
      where: { id, userId: user.userId },
    })

    if (deal.count === 0) {
      return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Negócio excluído com sucesso' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

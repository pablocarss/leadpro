import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addWebChatMessageJob } from '@/lib/queue'
import { z } from 'zod'

const createMessageSchema = z.object({
  content: z.string().min(1, 'Mensagem não pode estar vazia'),
  visitorId: z.string().optional(), // Necessário se for mensagem do visitante
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

type RouteParams = { params: Promise<{ id: string }> }

// GET - Buscar mensagens (público ou autenticado)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const visitorId = searchParams.get('visitorId')
    const since = searchParams.get('since')

    const session = await prisma.webChatSession.findUnique({
      where: { id },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Se não tiver visitorId, precisa de autenticação
    if (!visitorId) {
      const user = getUserFromRequest(request)
      if (!user) {
        return NextResponse.json(
          { error: 'Não autorizado' },
          { status: 401, headers: corsHeaders }
        )
      }
    } else if (session.visitorId !== visitorId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 403, headers: corsHeaders }
      )
    }

    const messages = await prisma.webChatMessage.findMany({
      where: {
        sessionId: id,
        ...(since && { createdAt: { gt: new Date(since) } }),
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ messages }, { headers: corsHeaders })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500, headers: corsHeaders }
    )
  }
}

// POST - Enviar mensagem (público ou autenticado)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = createMessageSchema.parse(body)

    const session = await prisma.webChatSession.findUnique({
      where: { id },
      include: { widget: true },
    })

    if (!session) {
      return NextResponse.json(
        { error: 'Sessão não encontrada' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Determinar se é mensagem do visitante ou do operador
    let isFromVisitor = true
    let operatorId: string | null = null

    if (validatedData.visitorId) {
      // Mensagem do visitante
      if (session.visitorId !== validatedData.visitorId) {
        return NextResponse.json(
          { error: 'Não autorizado' },
          { status: 403, headers: corsHeaders }
        )
      }
    } else {
      // Mensagem do operador - requer autenticação
      const user = getUserFromRequest(request)
      if (!user) {
        return NextResponse.json(
          { error: 'Não autorizado' },
          { status: 401, headers: corsHeaders }
        )
      }
      isFromVisitor = false
      operatorId = user.userId
    }

    const message = await prisma.webChatMessage.create({
      data: {
        sessionId: id,
        content: validatedData.content,
        isFromVisitor,
        operatorId,
      },
    })

    // Atualizar última atividade da sessão
    await prisma.webChatSession.update({
      where: { id },
      data: { updatedAt: new Date() },
    })

    // Add to queue for additional processing (notifications, etc.)
    try {
      await addWebChatMessageJob({
        sessionId: id,
        content: validatedData.content,
        isFromVisitor,
        operatorId: operatorId || undefined,
        visitorId: validatedData.visitorId,
      })
    } catch {
      // Queue error should not fail the request
      console.error('Error adding webchat message to queue')
    }

    return NextResponse.json(message, { status: 201, headers: corsHeaders })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: corsHeaders }
      )
    }
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

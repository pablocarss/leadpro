import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSessionSchema = z.object({
  widgetId: z.string().cuid('ID do widget inválido'),
  visitorId: z.string().min(1, 'ID do visitante é obrigatório'),
  visitorName: z.string().optional(),
  visitorEmail: z.string().email().optional().nullable(),
  pageUrl: z.string().url().optional(),
  userAgent: z.string().optional(),
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// API pública - não requer autenticação
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createSessionSchema.parse(body)

    // Verificar se o widget existe e está ativo
    const widget = await prisma.webChatWidget.findFirst({
      where: { id: validatedData.widgetId, isActive: true },
    })

    if (!widget) {
      return NextResponse.json(
        { error: 'Widget não encontrado ou inativo' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Verificar se já existe uma sessão ativa para este visitante
    let session = await prisma.webChatSession.findFirst({
      where: {
        widgetId: validatedData.widgetId,
        visitorId: validatedData.visitorId,
        status: 'OPEN',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!session) {
      // Criar nova sessão
      session = await prisma.webChatSession.create({
        data: {
          widgetId: validatedData.widgetId,
          visitorId: validatedData.visitorId,
          visitorName: validatedData.visitorName,
          visitorEmail: validatedData.visitorEmail,
          pageUrl: validatedData.pageUrl,
          userAgent: validatedData.userAgent,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        },
        include: {
          messages: true,
        },
      })

      // Adicionar mensagem de boas-vindas
      await prisma.webChatMessage.create({
        data: {
          sessionId: session.id,
          content: widget.welcomeMessage,
          isFromVisitor: false,
        },
      })

      // Recarregar sessão com mensagens
      session = await prisma.webChatSession.findUnique({
        where: { id: session.id },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      })
    }

    return NextResponse.json(session, { headers: corsHeaders })
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

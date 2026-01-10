import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ widgetId: string }> }

// API pública - não requer autenticação
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { widgetId } = await params

    const widget = await prisma.webChatWidget.findFirst({
      where: { id: widgetId, isActive: true },
      select: {
        id: true,
        name: true,
        primaryColor: true,
        position: true,
        welcomeMessage: true,
        allowedDomains: true,
      },
    })

    if (!widget) {
      return NextResponse.json({ error: 'Widget não encontrado' }, { status: 404 })
    }

    // Verificar domínio de origem
    const origin = request.headers.get('origin') || ''
    if (widget.allowedDomains.length > 0) {
      const originHost = origin.replace(/^https?:\/\//, '').split('/')[0]
      const isAllowed = widget.allowedDomains.some((domain) => {
        const domainHost = domain.replace(/^https?:\/\//, '').split('/')[0]
        return originHost === domainHost || originHost.endsWith(`.${domainHost}`)
      })

      if (!isAllowed && originHost !== 'localhost' && !originHost.startsWith('localhost:')) {
        return NextResponse.json({ error: 'Domínio não autorizado' }, { status: 403 })
      }
    }

    return NextResponse.json(widget, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}

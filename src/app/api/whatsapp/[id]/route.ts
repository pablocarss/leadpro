import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { whatsappService } from '@/services/whatsapp.service'

const updateSessionSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(['CONNECTED', 'DISCONNECTED', 'CONNECTING', 'QR_CODE', 'ERROR']).optional(),
  phone: z.string().optional().nullable(),
  syncContacts: z.boolean().optional(),
  syncHistory: z.boolean().optional(),
  syncGroups: z.boolean().optional(),
  historyDays: z.number().min(1).max(30).optional(),
})

const actionSchema = z.object({
  action: z.enum(['reconnect', 'disconnect', 'sync_contacts', 'sync_history']),
  historyDays: z.number().min(1).max(30).optional(),
})

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

    const session = await prisma.whatsappSession.findFirst({
      where: {
        id,
        integration: { userId: user.userId },
      },
      include: {
        integration: true,
        _count: {
          select: { messages: true, contacts: true },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    return NextResponse.json(session)
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
    const validatedData = updateSessionSchema.parse(body)

    const session = await prisma.whatsappSession.findFirst({
      where: {
        id,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    // If historyDays changed, clean old messages
    if (validatedData.historyDays !== undefined && validatedData.historyDays !== session.historyDays) {
      await whatsappService.cleanOldMessages(id, validatedData.historyDays)
    }

    const updatedSession = await prisma.whatsappSession.update({
      where: { id },
      data: {
        ...validatedData,
        ...(validatedData.status === 'CONNECTED' && { lastConnected: new Date() }),
      },
    })

    return NextResponse.json(updatedSession)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function PATCH(
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
    const { action, historyDays } = actionSchema.parse(body)

    const session = await prisma.whatsappSession.findFirst({
      where: {
        id,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    if (action === 'reconnect') {
      await prisma.whatsappSession.update({
        where: { id },
        data: { status: 'CONNECTING' },
      })

      whatsappService.createSession(id, {
        syncContacts: session.syncContacts,
        syncHistory: session.syncHistory,
        syncGroups: session.syncGroups,
        historyDays: session.historyDays,
      }).catch(console.error)

      return NextResponse.json({ message: 'Reconectando...' })
    }

    if (action === 'disconnect') {
      await whatsappService.disconnectSession(id)
      return NextResponse.json({ message: 'Desconectado com sucesso' })
    }

    if (action === 'sync_contacts') {
      if (session.status !== 'CONNECTED') {
        return NextResponse.json({ error: 'Sessão não está conectada' }, { status: 400 })
      }

      const count = await whatsappService.syncContacts(id)
      return NextResponse.json({ message: `${count} contatos sincronizados` })
    }

    if (action === 'sync_history') {
      if (session.status !== 'CONNECTED') {
        return NextResponse.json({ error: 'Sessão não está conectada' }, { status: 400 })
      }

      const days = historyDays || session.historyDays
      const count = await whatsappService.syncHistory(id, days)
      return NextResponse.json({ message: `${count} mensagens sincronizadas` })
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
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

    const session = await prisma.whatsappSession.findFirst({
      where: {
        id,
        integration: { userId: user.userId },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 })
    }

    // Disconnect session if connected
    if (whatsappService.isSessionConnected(id)) {
      await whatsappService.disconnectSession(id)
    }

    await prisma.whatsappSession.delete({ where: { id } })

    return NextResponse.json({ message: 'Sessão excluída com sucesso' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

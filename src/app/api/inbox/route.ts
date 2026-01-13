import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const channel = searchParams.get('channel') || 'all' // all, whatsapp, webchat

    // Buscar conversas do WhatsApp
    let whatsappConversations: Array<{
      id: string
      channel: 'whatsapp'
      name: string
      avatar: string | null
      lastMessage: string
      lastMessageTime: Date
      unreadCount: number
      sessionId: string
      chatId: string
    }> = []

    if (channel === 'all' || channel === 'whatsapp') {
      // Buscar sessões de WhatsApp do usuário
      const integrations = await prisma.integration.findMany({
        where: { userId: user.userId },
        include: {
          whatsappSessions: {
            where: { status: 'CONNECTED' },
          },
        },
      })

      const sessionIds = integrations.flatMap((i) => i.whatsappSessions.map((s) => s.id))

      if (sessionIds.length > 0) {
        // Buscar últimas mensagens agrupadas por chat
        const latestMessages = await prisma.whatsappMessage.findMany({
          where: { sessionId: { in: sessionIds } },
          orderBy: { timestamp: 'desc' },
          distinct: ['chatId'],
          take: 50,
        })

        // Buscar contagem de não lidas e montar conversas
        for (const msg of latestMessages) {
          const unreadCount = await prisma.whatsappMessage.count({
            where: {
              sessionId: msg.sessionId,
              chatId: msg.chatId,
              isFromMe: false,
              isRead: false,
            },
          })

          // Tentar encontrar contato
          const contact = await prisma.contact.findFirst({
            where: {
              userId: user.userId,
              whatsappJid: msg.chatId,
            },
          })

          const phoneNumber = msg.chatId.replace('@s.whatsapp.net', '').replace('@g.us', '')

          // Generate media preview text based on media type
          let lastMessage = msg.body
          if (!lastMessage && msg.mediaType) {
            const mediaLabels: Record<string, string> = {
              image: 'Imagem',
              video: 'Vídeo',
              audio: 'Áudio',
              ptt: 'Áudio',
              document: 'Documento',
              sticker: 'Sticker',
              contact: 'Contato',
              contacts: 'Contatos',
              location: 'Localização',
              poll: 'Enquete',
            }
            lastMessage = mediaLabels[msg.mediaType] || 'Mídia'
          }

          whatsappConversations.push({
            id: `wa_${msg.sessionId}_${msg.chatId}`,
            channel: 'whatsapp',
            name: contact?.name || phoneNumber,
            avatar: contact?.avatar || null,
            lastMessage: lastMessage || '',
            lastMessageTime: msg.timestamp,
            unreadCount,
            sessionId: msg.sessionId,
            chatId: msg.chatId,
          })
        }
      }
    }

    // Buscar conversas do WebChat
    let webchatConversations: Array<{
      id: string
      channel: 'webchat'
      name: string
      avatar: string | null
      lastMessage: string
      lastMessageTime: Date
      unreadCount: number
      sessionId: string
      widgetName: string
    }> = []

    if (channel === 'all' || channel === 'webchat') {
      const widgets = await prisma.webChatWidget.findMany({
        where: { userId: user.userId },
        include: {
          sessions: {
            where: { status: 'OPEN' },
            orderBy: { updatedAt: 'desc' },
            take: 50,
            include: {
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      })

      for (const widget of widgets) {
        for (const session of widget.sessions) {
          const unreadCount = await prisma.webChatMessage.count({
            where: {
              sessionId: session.id,
              isFromVisitor: true,
              isRead: false,
            },
          })

          const lastMsg = session.messages[0]

          webchatConversations.push({
            id: `wc_${session.id}`,
            channel: 'webchat',
            name: session.visitorName || `Visitante`,
            avatar: null,
            lastMessage: lastMsg?.content || 'Nova conversa',
            lastMessageTime: lastMsg?.createdAt || session.createdAt,
            unreadCount,
            sessionId: session.id,
            widgetName: widget.name,
          })
        }
      }
    }

    // Combinar e ordenar por última mensagem
    const allConversations = [...whatsappConversations, ...webchatConversations]
      .sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())

    // Calcular totais
    const totalUnread = allConversations.reduce((acc, c) => acc + c.unreadCount, 0)
    const whatsappUnread = whatsappConversations.reduce((acc, c) => acc + c.unreadCount, 0)
    const webchatUnread = webchatConversations.reduce((acc, c) => acc + c.unreadCount, 0)

    return NextResponse.json({
      conversations: allConversations,
      counts: {
        total: allConversations.length,
        whatsapp: whatsappConversations.length,
        webchat: webchatConversations.length,
      },
      unread: {
        total: totalUnread,
        whatsapp: whatsappUnread,
        webchat: webchatUnread,
      },
    })
  } catch (error) {
    console.error('Inbox error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

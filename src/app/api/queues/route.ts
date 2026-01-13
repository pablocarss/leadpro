import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { getAllQueues, getWorkersStatus } from '@/lib/queue'

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const queues = getAllQueues()
    const workers = getWorkersStatus()

    const queueStats = await Promise.all(
      queues.map(async (queue) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ])

        return {
          name: queue.name,
          waiting,
          active,
          completed,
          failed,
          delayed,
        }
      })
    )

    return NextResponse.json({
      queues: queueStats,
      workers,
    })
  } catch (error) {
    console.error('Error getting queue stats:', error)
    return NextResponse.json({ error: 'Erro ao buscar estatísticas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { action, queueName } = body

    const queues = getAllQueues()
    const queue = queues.find((q) => q.name === queueName)

    if (!queue) {
      return NextResponse.json({ error: 'Fila não encontrada' }, { status: 404 })
    }

    switch (action) {
      case 'pause':
        await queue.pause()
        return NextResponse.json({ message: 'Fila pausada' })

      case 'resume':
        await queue.resume()
        return NextResponse.json({ message: 'Fila retomada' })

      case 'clean':
        const grace = body.grace || 0
        const limit = body.limit || 1000
        const cleanType = body.cleanType || 'completed'
        await queue.clean(grace, limit, cleanType)
        return NextResponse.json({ message: 'Fila limpa' })

      case 'drain':
        await queue.drain()
        return NextResponse.json({ message: 'Fila drenada' })

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error managing queue:', error)
    return NextResponse.json({ error: 'Erro ao gerenciar fila' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { CreateLeadUseCase, ListLeadsUseCase } from '@/use-cases/lead'
import { LeadRepository } from '@/repositories/lead.repository'
import { createLeadSchema, leadFiltersSchema } from '@/validators'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filters = leadFiltersSchema.parse({
      status: searchParams.get('status') || undefined,
      source: searchParams.get('source') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') ? Number(searchParams.get('page')) : undefined,
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    })

    const leadRepository = new LeadRepository()
    const listLeadsUseCase = new ListLeadsUseCase(leadRepository)

    const result = await listLeadsUseCase.execute(user.userId, filters)

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
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
    const validatedData = createLeadSchema.parse(body)

    const leadRepository = new LeadRepository()
    const createLeadUseCase = new CreateLeadUseCase(leadRepository)

    const lead = await createLeadUseCase.execute(user.userId, validatedData)

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

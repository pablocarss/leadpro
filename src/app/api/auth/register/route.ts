import { NextRequest, NextResponse } from 'next/server'
import { RegisterUseCase } from '@/use-cases/auth'
import { UserRepository } from '@/repositories/user.repository'
import { createUserSchema } from '@/validators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    const userRepository = new UserRepository()
    const registerUseCase = new RegisterUseCase(userRepository)

    const user = await registerUseCase.execute(validatedData)

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

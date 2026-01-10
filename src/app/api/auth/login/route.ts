import { NextRequest, NextResponse } from 'next/server'
import { LoginUseCase } from '@/use-cases/auth'
import { UserRepository } from '@/repositories/user.repository'
import { loginSchema } from '@/validators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = loginSchema.parse(body)

    const userRepository = new UserRepository()
    const loginUseCase = new LoginUseCase(userRepository)

    const result = await loginUseCase.execute(validatedData)

    const response = NextResponse.json(result, { status: 200 })

    response.cookies.set('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

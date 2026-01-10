import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { UserRepository } from '@/repositories/user.repository'
import { LoginDTO, AuthResponseDTO } from '@/types/dtos'

export class LoginUseCase {
  constructor(private userRepository: UserRepository) {}

  async execute(data: LoginDTO): Promise<AuthResponseDTO> {
    const user = await this.userRepository.findByEmail(data.email)

    if (!user) {
      throw new Error('Credenciais inválidas')
    }

    if (!user.isActive) {
      throw new Error('Usuário desativado')
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password)

    if (!isPasswordValid) {
      throw new Error('Credenciais inválidas')
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.NEXTAUTH_SECRET || 'secret',
      { expiresIn: '7d' }
    )

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    }
  }
}

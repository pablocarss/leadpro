import { UserRole } from '@prisma/client'

export interface CreateUserDTO {
  name: string
  email: string
  password: string
  role?: UserRole
}

export interface UpdateUserDTO {
  name?: string
  email?: string
  password?: string
  avatar?: string
  role?: UserRole
  isActive?: boolean
}

export interface UserResponseDTO {
  id: string
  name: string
  email: string
  avatar: string | null
  role: UserRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface LoginDTO {
  email: string
  password: string
}

export interface AuthResponseDTO {
  user: UserResponseDTO
  token: string
}

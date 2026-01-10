import { User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CreateUserDTO, UpdateUserDTO } from '@/types/dtos'
import { IBaseRepository, PaginatedResult, PaginationParams } from './base.repository'

export interface IUserRepository extends IBaseRepository<User, CreateUserDTO, UpdateUserDTO> {
  findByEmail(email: string): Promise<User | null>
}

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    })
  }

  async findAll(params?: PaginationParams): Promise<PaginatedResult<User>> {
    const page = params?.page ?? 1
    const limit = params?.limit ?? 10
    const skip = (page - 1) * limit

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ])

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async create(data: CreateUserDTO): Promise<User> {
    return prisma.user.create({
      data,
    })
  }

  async update(id: string, data: UpdateUserDTO): Promise<User> {
    return prisma.user.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id },
    })
  }
}

export const userRepository = new UserRepository()

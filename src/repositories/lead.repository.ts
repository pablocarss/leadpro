import { Lead, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CreateLeadDTO, UpdateLeadDTO, LeadFiltersDTO } from '@/types/dtos'
import { IBaseRepository, PaginatedResult } from './base.repository'

export interface ILeadRepository extends IBaseRepository<Lead, CreateLeadDTO & { userId: string }, UpdateLeadDTO> {
  findAllByUser(userId: string, filters?: LeadFiltersDTO): Promise<PaginatedResult<Lead>>
}

export class LeadRepository implements ILeadRepository {
  async findById(id: string): Promise<Lead | null> {
    return prisma.lead.findUnique({
      where: { id },
      include: {
        company: true,
        notes: true,
        tasks: true,
      },
    })
  }

  async findAllByUser(userId: string, filters?: LeadFiltersDTO): Promise<PaginatedResult<Lead>> {
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 10
    const skip = (page - 1) * limit

    const where: Prisma.LeadWhereInput = {
      userId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.source && { source: filters.source }),
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
      ...(filters?.startDate && filters?.endDate && {
        createdAt: {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        },
      }),
    }

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: true,
        },
      }),
      prisma.lead.count({ where }),
    ])

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  async findAll(): Promise<PaginatedResult<Lead>> {
    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count(),
    ])

    return {
      data,
      total,
      page: 1,
      limit: total,
      totalPages: 1,
    }
  }

  async create(data: CreateLeadDTO & { userId: string }): Promise<Lead> {
    return prisma.lead.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        source: data.source,
        status: data.status,
        value: data.value,
        description: data.description,
        userId: data.userId,
        companyId: data.companyId,
      },
    })
  }

  async update(id: string, data: UpdateLeadDTO): Promise<Lead> {
    return prisma.lead.update({
      where: { id },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await prisma.lead.delete({
      where: { id },
    })
  }
}

export const leadRepository = new LeadRepository()

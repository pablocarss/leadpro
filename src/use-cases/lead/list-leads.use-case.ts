import { LeadRepository } from '@/repositories/lead.repository'
import { LeadFiltersDTO, LeadResponseDTO } from '@/types/dtos'
import { PaginatedResult } from '@/repositories/base.repository'

export class ListLeadsUseCase {
  constructor(private leadRepository: LeadRepository) {}

  async execute(userId: string, filters?: LeadFiltersDTO): Promise<PaginatedResult<LeadResponseDTO>> {
    const result = await this.leadRepository.findAllByUser(userId, filters)

    return {
      ...result,
      data: result.data.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        status: lead.status,
        value: lead.value ? Number(lead.value) : null,
        description: lead.description,
        userId: lead.userId,
        companyId: lead.companyId,
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
      })),
    }
  }
}

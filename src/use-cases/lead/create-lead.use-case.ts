import { LeadRepository } from '@/repositories/lead.repository'
import { CreateLeadDTO, LeadResponseDTO } from '@/types/dtos'

export class CreateLeadUseCase {
  constructor(private leadRepository: LeadRepository) {}

  async execute(userId: string, data: CreateLeadDTO): Promise<LeadResponseDTO> {
    const lead = await this.leadRepository.create({
      ...data,
      userId,
    })

    return {
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
    }
  }
}

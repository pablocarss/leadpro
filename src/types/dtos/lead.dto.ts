import { LeadSource, LeadStatus } from '@prisma/client'

export interface CreateLeadDTO {
  name: string
  email?: string | null
  phone?: string | null
  source?: LeadSource
  status?: LeadStatus
  value?: number | null
  description?: string | null
  companyId?: string | null
}

export interface UpdateLeadDTO {
  name?: string
  email?: string
  phone?: string
  source?: LeadSource
  status?: LeadStatus
  value?: number
  description?: string
  companyId?: string
}

export interface LeadResponseDTO {
  id: string
  name: string
  email: string | null
  phone: string | null
  source: LeadSource
  status: LeadStatus
  value: number | null
  description: string | null
  userId: string
  companyId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface LeadFiltersDTO {
  status?: LeadStatus
  source?: LeadSource
  search?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

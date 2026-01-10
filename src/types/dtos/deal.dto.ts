import { DealStage } from '@prisma/client'

export interface CreateDealDTO {
  title: string
  value: number
  stage?: DealStage
  probability?: number
  expectedCloseDate?: Date
  description?: string
  contactId?: string
  companyId?: string
}

export interface UpdateDealDTO {
  title?: string
  value?: number
  stage?: DealStage
  probability?: number
  expectedCloseDate?: Date
  closedAt?: Date
  description?: string
  contactId?: string
  companyId?: string
}

export interface DealResponseDTO {
  id: string
  title: string
  value: number
  stage: DealStage
  probability: number
  expectedCloseDate: Date | null
  closedAt: Date | null
  description: string | null
  userId: string
  contactId: string | null
  companyId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface DealFiltersDTO {
  stage?: DealStage
  search?: string
  minValue?: number
  maxValue?: number
  contactId?: string
  companyId?: string
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}

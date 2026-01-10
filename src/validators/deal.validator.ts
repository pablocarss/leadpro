import { z } from 'zod'
import { DealStage } from '@prisma/client'

export const createDealSchema = z.object({
  title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres'),
  value: z.number().positive('Valor deve ser positivo'),
  stage: z.nativeEnum(DealStage).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  description: z.string().optional().nullable(),
  contactId: z.string().cuid('ID do contato inválido').optional().nullable(),
  companyId: z.string().cuid('ID da empresa inválido').optional().nullable(),
})

export const updateDealSchema = z.object({
  title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres').optional(),
  value: z.number().positive('Valor deve ser positivo').optional(),
  stage: z.nativeEnum(DealStage).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  closedAt: z.string().datetime().optional().nullable(),
  description: z.string().optional().nullable(),
  contactId: z.string().cuid('ID do contato inválido').optional().nullable(),
  companyId: z.string().cuid('ID da empresa inválido').optional().nullable(),
})

export const dealFiltersSchema = z.object({
  stage: z.nativeEnum(DealStage).optional(),
  search: z.string().optional(),
  minValue: z.number().positive().optional(),
  maxValue: z.number().positive().optional(),
  contactId: z.string().cuid().optional(),
  companyId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
})

export type CreateDealInput = z.infer<typeof createDealSchema>
export type UpdateDealInput = z.infer<typeof updateDealSchema>
export type DealFiltersInput = z.infer<typeof dealFiltersSchema>

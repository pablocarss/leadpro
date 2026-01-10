import { z } from 'zod'
import { LeadSource, LeadStatus } from '@prisma/client'

export const createLeadSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.nativeEnum(LeadSource).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  value: z.number().positive('Valor deve ser positivo').optional().nullable(),
  description: z.string().optional().nullable(),
  companyId: z.string().cuid('ID da empresa inválido').optional().nullable(),
})

export const updateLeadSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.nativeEnum(LeadSource).optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  value: z.number().positive('Valor deve ser positivo').optional().nullable(),
  description: z.string().optional().nullable(),
  companyId: z.string().cuid('ID da empresa inválido').optional().nullable(),
})

export const leadFiltersSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  search: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type LeadFiltersInput = z.infer<typeof leadFiltersSchema>

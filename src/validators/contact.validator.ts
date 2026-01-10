import { z } from 'zod'

export const createContactSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  avatar: z.string().url('URL inválida').optional().nullable(),
  companyId: z.string().cuid('ID da empresa inválido').optional().nullable(),
})

export const updateContactSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  email: z.string().email('Email inválido').optional().nullable(),
  phone: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  avatar: z.string().url('URL inválida').optional().nullable(),
  companyId: z.string().cuid('ID da empresa inválido').optional().nullable(),
  isActive: z.boolean().optional(),
})

export const contactFiltersSchema = z.object({
  search: z.string().optional(),
  companyId: z.string().cuid().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
})

export type CreateContactInput = z.infer<typeof createContactSchema>
export type UpdateContactInput = z.infer<typeof updateContactSchema>
export type ContactFiltersInput = z.infer<typeof contactFiltersSchema>

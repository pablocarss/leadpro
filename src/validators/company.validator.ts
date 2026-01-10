import { z } from 'zod'

export const createCompanySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  website: z.string().url('URL inválida').optional().nullable(),
  industry: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  logo: z.string().url('URL inválida').optional().nullable(),
})

export const updateCompanySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  website: z.string().url('URL inválida').optional().nullable(),
  industry: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().nullable(),
  logo: z.string().url('URL inválida').optional().nullable(),
  isActive: z.boolean().optional(),
})

export const companyFiltersSchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type CompanyFiltersInput = z.infer<typeof companyFiltersSchema>

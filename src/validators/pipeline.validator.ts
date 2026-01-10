import { z } from 'zod'

export const createPipelineSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um hexadecimal válido').optional(),
  isDefault: z.boolean().optional(),
  stages: z.array(z.object({
    name: z.string().min(1, 'Nome do estágio é obrigatório'),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    order: z.number().int().min(0),
    isWon: z.boolean().optional(),
    isLost: z.boolean().optional(),
  })).optional(),
})

export const updatePipelineSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor deve ser um hexadecimal válido').optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const createStageSchema = z.object({
  name: z.string().min(1, 'Nome do estágio é obrigatório'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  order: z.number().int().min(0),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
})

export const updateStageSchema = z.object({
  name: z.string().min(1, 'Nome do estágio é obrigatório').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  order: z.number().int().min(0).optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
})

export const createPipelineLeadSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  stageId: z.string().cuid('ID do estágio inválido'),
  value: z.number().positive('Valor deve ser positivo').optional().nullable(),
  notes: z.string().optional().nullable(),
  contactId: z.string().cuid('ID do contato inválido').optional().nullable(),
  leadId: z.string().cuid('ID do lead inválido').optional().nullable(),
})

export const updatePipelineLeadSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório').optional(),
  stageId: z.string().cuid('ID do estágio inválido').optional(),
  value: z.number().positive('Valor deve ser positivo').optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const moveLeadSchema = z.object({
  toStageId: z.string().cuid('ID do estágio de destino inválido'),
  reason: z.string().optional().nullable(),
})

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>
export type CreateStageInput = z.infer<typeof createStageSchema>
export type UpdateStageInput = z.infer<typeof updateStageSchema>
export type CreatePipelineLeadInput = z.infer<typeof createPipelineLeadSchema>
export type UpdatePipelineLeadInput = z.infer<typeof updatePipelineLeadSchema>
export type MoveLeadInput = z.infer<typeof moveLeadSchema>

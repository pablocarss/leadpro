import { z } from 'zod'
import { Priority, TaskStatus } from '@prisma/client'

export const createTaskSchema = z.object({
  title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres'),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  leadId: z.string().cuid('ID do lead inválido').optional().nullable(),
  contactId: z.string().cuid('ID do contato inválido').optional().nullable(),
  dealId: z.string().cuid('ID do negócio inválido').optional().nullable(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(2, 'Título deve ter pelo menos 2 caracteres').optional(),
  description: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.nativeEnum(Priority).optional(),
  status: z.nativeEnum(TaskStatus).optional(),
  completedAt: z.string().datetime().optional().nullable(),
  leadId: z.string().cuid('ID do lead inválido').optional().nullable(),
  contactId: z.string().cuid('ID do contato inválido').optional().nullable(),
  dealId: z.string().cuid('ID do negócio inválido').optional().nullable(),
})

export const taskFiltersSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  search: z.string().optional(),
  leadId: z.string().cuid().optional(),
  contactId: z.string().cuid().optional(),
  dealId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type TaskFiltersInput = z.infer<typeof taskFiltersSchema>

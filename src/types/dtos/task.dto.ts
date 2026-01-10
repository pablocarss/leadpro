import { Priority, TaskStatus } from '@prisma/client'

export interface CreateTaskDTO {
  title: string
  description?: string
  dueDate?: Date
  priority?: Priority
  status?: TaskStatus
  leadId?: string
  contactId?: string
  dealId?: string
}

export interface UpdateTaskDTO {
  title?: string
  description?: string
  dueDate?: Date
  priority?: Priority
  status?: TaskStatus
  completedAt?: Date
  leadId?: string
  contactId?: string
  dealId?: string
}

export interface TaskResponseDTO {
  id: string
  title: string
  description: string | null
  dueDate: Date | null
  priority: Priority
  status: TaskStatus
  completedAt: Date | null
  userId: string
  leadId: string | null
  contactId: string | null
  dealId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface TaskFiltersDTO {
  status?: TaskStatus
  priority?: Priority
  search?: string
  leadId?: string
  contactId?: string
  dealId?: string
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
}

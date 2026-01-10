export interface CreateContactDTO {
  name: string
  email?: string
  phone?: string
  position?: string
  avatar?: string
  companyId?: string
}

export interface UpdateContactDTO {
  name?: string
  email?: string
  phone?: string
  position?: string
  avatar?: string
  companyId?: string
  isActive?: boolean
}

export interface ContactResponseDTO {
  id: string
  name: string
  email: string | null
  phone: string | null
  position: string | null
  avatar: string | null
  isActive: boolean
  userId: string
  companyId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ContactFiltersDTO {
  search?: string
  companyId?: string
  isActive?: boolean
  page?: number
  limit?: number
}

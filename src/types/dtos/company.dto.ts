export interface CreateCompanyDTO {
  name: string
  website?: string
  industry?: string
  size?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  phone?: string
  email?: string
  logo?: string
}

export interface UpdateCompanyDTO {
  name?: string
  website?: string
  industry?: string
  size?: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  phone?: string
  email?: string
  logo?: string
  isActive?: boolean
}

export interface CompanyResponseDTO {
  id: string
  name: string
  website: string | null
  industry: string | null
  size: string | null
  address: string | null
  city: string | null
  state: string | null
  country: string | null
  zipCode: string | null
  phone: string | null
  email: string | null
  logo: string | null
  isActive: boolean
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface CompanyFiltersDTO {
  search?: string
  industry?: string
  isActive?: boolean
  page?: number
  limit?: number
}

import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import { UserRole } from '@prisma/client'

export interface TokenPayload {
  userId: string
  email: string
  role: UserRole
}

export function verifyToken(token: string): TokenPayload {
  const secret = process.env.NEXTAUTH_SECRET || 'secret'
  return jwt.verify(token, secret) as TokenPayload
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  const cookieToken = request.cookies.get('token')?.value
  return cookieToken || null
}

export function getUserFromRequest(request: NextRequest): TokenPayload | null {
  try {
    const token = getTokenFromRequest(request)
    if (!token) return null
    return verifyToken(token)
  } catch {
    return null
  }
}

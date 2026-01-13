import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

/**
 * Get encryption key from environment variable
 * Key must be 64 hex characters (32 bytes)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY

  if (!key) {
    // Generate a default key for development (NOT for production!)
    console.warn('ENCRYPTION_KEY not set. Using default key for development.')
    return Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex')
  }

  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32')
  }

  return Buffer.from(key, 'hex')
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: iv:tag:encrypted (all in hex)
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  // Return format: iv:tag:encrypted
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 * Expects format: iv:tag:encrypted (all in hex)
 */
export function decrypt(encryptedData: string): string {
  const parts = encryptedData.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format')
  }

  const [ivHex, tagHex, encrypted] = parts

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Mask an API key for display purposes
 * Shows first 4 and last 4 characters: "sk-ab...xyz1"
 */
export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) {
    return '••••••••'
  }

  const first = key.substring(0, 4)
  const last = key.substring(key.length - 4)

  return `${first}...${last}`
}

/**
 * Check if a string is already encrypted (has the expected format)
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':')

  if (parts.length !== 3) return false

  const [iv, tag, encrypted] = parts

  // Check if all parts are valid hex strings with expected lengths
  return (
    iv.length === IV_LENGTH * 2 &&
    tag.length === TAG_LENGTH * 2 &&
    encrypted.length > 0 &&
    /^[0-9a-fA-F]+$/.test(iv) &&
    /^[0-9a-fA-F]+$/.test(tag) &&
    /^[0-9a-fA-F]+$/.test(encrypted)
  )
}

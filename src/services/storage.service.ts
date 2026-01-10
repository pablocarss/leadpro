import * as Minio from 'minio'
import { Readable } from 'stream'

class StorageService {
  private client: Minio.Client
  private bucket: string
  private initialized: boolean = false
  private initPromise: Promise<void> | null = null

  constructor() {
    this.client = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'leadpro',
      secretKey: process.env.MINIO_SECRET_KEY || 'leadpro123',
    })
    this.bucket = process.env.MINIO_BUCKET || 'leadpro'
  }

  private async ensureBucket(): Promise<void> {
    if (this.initialized) return

    // Avoid multiple concurrent initializations
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this.doInitialize()
    return this.initPromise
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log('Initializing MinIO storage...')
      console.log(`MinIO endpoint: ${process.env.MINIO_ENDPOINT || 'localhost'}:${process.env.MINIO_PORT || '9000'}`)

      const exists = await this.client.bucketExists(this.bucket)

      if (!exists) {
        console.log(`Creating bucket: ${this.bucket}`)
        await this.client.makeBucket(this.bucket)

        // Set bucket policy to allow public read with CORS
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject', 's3:GetObjectVersion'],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        }
        await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy))
        console.log(`Bucket ${this.bucket} created with public read policy`)
      } else {
        console.log(`Bucket ${this.bucket} already exists`)
      }

      this.initialized = true
    } catch (error) {
      console.error('Error initializing MinIO storage:', error)
      this.initPromise = null
      throw error
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      await this.client.listBuckets()
      return true
    } catch {
      return false
    }
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    contentType: string,
    folder: string = 'uploads'
  ): Promise<string> {
    await this.ensureBucket()

    const objectName = `${folder}/${Date.now()}-${fileName}`

    try {
      await this.client.putObject(
        this.bucket,
        objectName,
        buffer,
        buffer.length,
        {
          'Content-Type': contentType,
          'x-amz-acl': 'public-read',
        }
      )

      const url = this.getPublicUrl(objectName)
      console.log(`Uploaded file: ${url}`)
      return url
    } catch (error) {
      console.error('Error uploading file:', error)
      throw error
    }
  }

  async uploadFromStream(
    stream: Readable,
    fileName: string,
    contentType: string,
    folder: string = 'uploads'
  ): Promise<string> {
    await this.ensureBucket()

    const objectName = `${folder}/${Date.now()}-${fileName}`

    try {
      await this.client.putObject(
        this.bucket,
        objectName,
        stream,
        undefined,
        {
          'Content-Type': contentType,
          'x-amz-acl': 'public-read',
        }
      )

      return this.getPublicUrl(objectName)
    } catch (error) {
      console.error('Error uploading from stream:', error)
      throw error
    }
  }

  async uploadProfilePicture(buffer: Buffer, contactId: string): Promise<string> {
    console.log(`Uploading profile picture for contact: ${contactId}`)
    return this.uploadFile(buffer, `${contactId}.jpg`, 'image/jpeg', 'profile-pictures')
  }

  async uploadWhatsAppMedia(
    buffer: Buffer,
    messageId: string,
    mediaType: string,
    extension: string
  ): Promise<string> {
    const contentTypes: Record<string, string> = {
      image: 'image/jpeg',
      video: 'video/mp4',
      audio: 'audio/ogg',
      ptt: 'audio/ogg',
      document: 'application/octet-stream',
      sticker: 'image/webp',
    }

    const contentType = contentTypes[mediaType] || 'application/octet-stream'
    const folder = `whatsapp/${mediaType}s`

    console.log(`Uploading WhatsApp media: ${mediaType} - ${messageId}`)
    return this.uploadFile(buffer, `${messageId}.${extension}`, contentType, folder)
  }

  getPublicUrl(objectName: string): string {
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http'
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost'
    const port = process.env.MINIO_PORT || '9000'

    // For local development, always use localhost
    if (endpoint === 'localhost' || endpoint === 'minio' || endpoint === '127.0.0.1') {
      return `${protocol}://localhost:${port}/${this.bucket}/${objectName}`
    }

    return `${protocol}://${endpoint}:${port}/${this.bucket}/${objectName}`
  }

  async deleteFile(objectName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectName)
    } catch (error) {
      console.error('Error deleting file:', error)
    }
  }

  async getFileStream(objectName: string): Promise<Readable> {
    return this.client.getObject(this.bucket, objectName)
  }

  async listFiles(prefix: string = ''): Promise<string[]> {
    const files: string[] = []
    const stream = this.client.listObjects(this.bucket, prefix, true)

    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        if (obj.name) files.push(obj.name)
      })
      stream.on('error', reject)
      stream.on('end', () => resolve(files))
    })
  }
}

export const storageService = new StorageService()

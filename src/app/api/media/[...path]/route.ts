import { NextRequest, NextResponse } from 'next/server'

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost'
const MINIO_PORT = process.env.MINIO_PORT || '9002'
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'leadpro'
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const mediaPath = path.join('/')

    // Build MinIO URL
    const protocol = MINIO_USE_SSL ? 'https' : 'http'
    const minioUrl = `${protocol}://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}/${mediaPath}`

    console.log(`[Media Proxy] Fetching: ${minioUrl}`)

    // Fetch from MinIO
    const response = await fetch(minioUrl)

    if (!response.ok) {
      console.error(`[Media Proxy] Error: ${response.status} for ${minioUrl}`)
      return NextResponse.json(
        { error: 'Media not found' },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const contentLength = response.headers.get('content-length')
    const buffer = await response.arrayBuffer()

    // Return with CORS headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength || String(buffer.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    })
  } catch (error) {
    console.error('Error proxying media:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media' },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  })
}

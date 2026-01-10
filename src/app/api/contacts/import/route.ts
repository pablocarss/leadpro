import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('userId')?.value

    if (!userId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    }

    // Read the file
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Get the first sheet
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, string>[]

    if (data.length === 0) {
      return NextResponse.json({ error: 'Arquivo vazio ou formato inválido' }, { status: 400 })
    }

    // Map columns - try to find common column names
    const columnMappings = {
      name: ['name', 'nome', 'Nome', 'NAME', 'full_name', 'fullname', 'contact', 'contato'],
      email: ['email', 'Email', 'EMAIL', 'e-mail', 'E-mail', 'mail'],
      phone: ['phone', 'telefone', 'Telefone', 'TELEFONE', 'Phone', 'PHONE', 'celular', 'Celular', 'mobile', 'whatsapp', 'WhatsApp'],
      position: ['position', 'cargo', 'Cargo', 'CARGO', 'job', 'Job', 'title', 'Title'],
      company: ['company', 'empresa', 'Empresa', 'EMPRESA', 'organization', 'Organization'],
    }

    const findColumn = (row: Record<string, string>, mappings: string[]): string | null => {
      for (const mapping of mappings) {
        if (row[mapping] !== undefined && row[mapping] !== '') {
          return row[mapping]
        }
      }
      return null
    }

    let imported = 0
    let skipped = 0
    let errors: string[] = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]

      try {
        const name = findColumn(row, columnMappings.name)
        const email = findColumn(row, columnMappings.email)
        const phone = findColumn(row, columnMappings.phone)
        const position = findColumn(row, columnMappings.position)
        const companyName = findColumn(row, columnMappings.company)

        if (!name && !phone && !email) {
          skipped++
          continue
        }

        // Clean phone number - remove all non-digits
        const cleanPhone = phone?.replace(/\D/g, '') || null

        // Check if contact already exists by phone or email
        const existingContact = await prisma.contact.findFirst({
          where: {
            userId,
            OR: [
              ...(cleanPhone ? [{ phone: cleanPhone }] : []),
              ...(email ? [{ email }] : []),
            ],
          },
        })

        if (existingContact) {
          skipped++
          continue
        }

        // Find or create company if provided
        let companyId: string | undefined
        if (companyName) {
          const existingCompany = await prisma.company.findFirst({
            where: { name: companyName, userId },
          })

          if (existingCompany) {
            companyId = existingCompany.id
          } else {
            const newCompany = await prisma.company.create({
              data: { name: companyName, userId },
            })
            companyId = newCompany.id
          }
        }

        // Create the contact
        await prisma.contact.create({
          data: {
            name: name || cleanPhone || email || 'Sem nome',
            email: email || null,
            phone: cleanPhone || null,
            position: position || null,
            companyId: companyId || null,
            userId,
            syncedFromWhatsapp: false,
          },
        })

        imported++
      } catch (error) {
        errors.push(`Linha ${i + 2}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 10), // Return first 10 errors only
      total: data.length,
    })
  } catch (error) {
    console.error('Error importing contacts:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao importar contatos' },
      { status: 500 }
    )
  }
}

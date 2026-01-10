import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    // Create template data
    const templateData = [
      {
        Nome: 'João Silva',
        Email: 'joao@email.com',
        Telefone: '5511999999999',
        Cargo: 'Gerente',
        Empresa: 'Empresa ABC',
      },
      {
        Nome: 'Maria Santos',
        Email: 'maria@email.com',
        Telefone: '5521988888888',
        Cargo: 'Diretora',
        Empresa: 'Empresa XYZ',
      },
    ]

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(templateData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Nome
      { wch: 30 }, // Email
      { wch: 20 }, // Telefone
      { wch: 20 }, // Cargo
      { wch: 25 }, // Empresa
    ]

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contatos')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return the file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="modelo_contatos.xlsx"',
      },
    })
  } catch (error) {
    console.error('Error generating template:', error)
    return NextResponse.json({ error: 'Erro ao gerar template' }, { status: 500 })
  }
}

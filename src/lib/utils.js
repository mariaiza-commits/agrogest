import React from 'react'

export const fmt = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value ?? 0)

export const fmtNum = (value, decimals = 0) =>
  Number(value ?? 0).toFixed(decimals)

export const fmtDate = (dateStr) => {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export const today = () => new Date().toISOString().split('T')[0]

export const statusBadge = (status) => {
  const map = {
    pendente:  { cls: 'badge-amber', label: 'Pendente' },
    recebido:  { cls: 'badge-green', label: 'Recebido' },
    pago:      { cls: 'badge-green', label: 'Pago' },
    atrasado:  { cls: 'badge-red',   label: 'Atrasado' },
    cancelado: { cls: 'badge-gray',  label: 'Cancelado' },
  }
  return map[status] ?? { cls: 'badge-gray', label: status }
}

export const statusLoteBadge = (status) => {
  const map = {
    ativo:      { cls: 'badge-green', label: 'Ativo' },
    em_repouso: { cls: 'badge-amber', label: 'Em repouso' },
    colhido:    { cls: 'badge-teal',  label: 'Colhido' },
    inativo:    { cls: 'badge-gray',  label: 'Inativo' },
  }
  return map[status] ?? { cls: 'badge-gray', label: status }
}

export const categLabel = (cat) => {
  const map = {
    mao_de_obra: 'Mão de obra', insumos: 'Insumos',
    irrigacao: 'Irrigação', maquinario: 'Maquinário',
    transporte: 'Transporte', outros: 'Outros',
  }
  return map[cat] ?? cat
}

// ─── EXPORTAÇÃO EXCEL ────────────────────────────────────────
export async function exportarExcel(dados, colunas, nomeArquivo) {
  if (!dados?.length) return

  const XLSX = await import('xlsx')

  let rows, headers
  if (colunas) {
    headers = colunas.map(c => c.label)
    rows = dados.map(row => colunas.map(c => c.accessor ? c.accessor(row) : (row[c.key] ?? '')))
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 2, 14) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    XLSX.writeFile(wb, `${nomeArquivo}_${today()}.xlsx`)
  } else {
    const ws = XLSX.utils.json_to_sheet(dados)
    const keys = Object.keys(dados[0] ?? {})
    ws['!cols'] = keys.map(k => ({ wch: Math.max(k.length + 2, 14) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    XLSX.writeFile(wb, `${nomeArquivo}_${today()}.xlsx`)
  }
}

// ─── EXPORTAÇÃO PDF ─────────────────────────────────────────
export async function exportarPDF(dados, colunas, titulo, nomeArquivo) {
  if (!dados?.length) return

  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Cabeçalho
  doc.setFontSize(16)
  doc.setTextColor(39, 80, 10) // --green-dark
  doc.text('AgroGestão', 14, 14)
  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)
  doc.text(titulo, 14, 21)
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 27)

  let head, body
  if (colunas) {
    head = [colunas.map(c => c.label)]
    body = dados.map(row => colunas.map(c => c.accessor ? c.accessor(row) : (row[c.key] ?? '')))
  } else {
    const keys = Object.keys(dados[0] ?? {})
    head = [keys]
    body = dados.map(row => keys.map(k => row[k] ?? ''))
  }

  autoTable(doc, {
    head,
    body,
    startY: 32,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [59, 109, 17], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 243, 238] },
    margin: { left: 14, right: 14 },
  })

  doc.save(`${nomeArquivo}_${today()}.pdf`)
}

// ─── BOTÃO EXPORTAR (Excel + PDF) ───────────────────────────
export function BtnExportar({ dados, colunas, nome, titulo }) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)

  if (!dados?.length) return null

  async function handleExcel() {
    setOpen(false); setLoading(true)
    await exportarExcel(dados, colunas, nome)
    setLoading(false)
  }

  async function handlePDF() {
    setOpen(false); setLoading(true)
    await exportarPDF(dados, colunas, titulo || nome, nome)
    setLoading(false)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-sm"
        onClick={() => !loading && setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: loading ? 0.6 : 1 }}
      >
        {loading ? 'Gerando...' : '↓ Exportar'}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: 4,
            background: 'white', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: 'var(--shadow)', zIndex: 100,
            minWidth: 140, overflow: 'hidden',
          }}>
            <button onClick={handleExcel}
              style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              📊 Excel (.xlsx)
            </button>
            <button onClick={handlePDF}
              style={{ width: '100%', padding: '9px 14px', border: 'none', background: 'none',
                cursor: 'pointer', textAlign: 'left', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-50)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              📄 PDF
            </button>
          </div>
        </>
      )}
    </div>
  )
}


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
  // Importa SheetJS dinamicamente
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')

  const cabecalho = colunas.map(c => c.label)
  const linhas = dados.map(row =>
    colunas.map(c => {
      const val = c.accessor ? c.accessor(row) : row[c.key]
      return val ?? ''
    })
  )

  const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Dados')
  XLSX.writeFile(wb, `${nomeArquivo}_${today()}.xlsx`)
}

// Botão de exportar reutilizável
export function BtnExportar({ dados, colunas, nome }) {
  return (
    <button
      className="btn btn-sm"
      style={{ gap: 4 }}
      onClick={() => exportarExcel(dados, colunas, nome)}
      disabled={!dados?.length}
    >
      ↓ Excel
    </button>
  )
}

// Script de backup — rode com: node backup.js
// Salva todos os dados do banco em um arquivo Excel

const https = require('https')
const fs = require('fs')

const SUPABASE_URL = 'https://juqvvdnybhwelctlhdlr.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Su9Dy3TOVaeYZuiLK1Uerg_nrSUXgCb'

const TABELAS = [
  'lotes', 'setores', 'culturas', 'cargas', 'carga_itens',
  'vendas', 'custos', 'clients', 'suppliers', 'contas_financeiras',
  'atividades_lote', 'variedades_cadastradas', 'setor_variedades'
]

function buscar(tabela) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${tabela}?select=*&limit=10000`)
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      }
    }
    https.get(opts, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch(e) { resolve([]) }
      })
    }).on('error', reject)
  })
}

function toCSV(rows) {
  if (!rows || rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const header = cols.join(',')
  const lines = rows.map(r => cols.map(c => {
    const v = r[c] ?? ''
    const s = String(v).replace(/"/g, '""')
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s
  }).join(','))
  return [header, ...lines].join('\n')
}

async function backup() {
  const data = new Date()
  const nome = `backup_agrogestao_${data.toISOString().split('T')[0]}.sql`
  const csvDir = `backup_${data.toISOString().split('T')[0]}`
  
  if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir)
  
  console.log('🌱 Iniciando backup AgroGestão...')
  
  for (const tabela of TABELAS) {
    try {
      const rows = await buscar(tabela)
      if (Array.isArray(rows) && rows.length > 0) {
        const csv = toCSV(rows)
        fs.writeFileSync(`${csvDir}/${tabela}.csv`, csv, 'utf8')
        console.log(`  ✅ ${tabela}: ${rows.length} registros`)
      } else {
        console.log(`  ⚪ ${tabela}: vazio`)
      }
    } catch(e) {
      console.log(`  ❌ ${tabela}: erro - ${e.message}`)
    }
  }
  
  console.log(`\n✅ Backup salvo na pasta: ${csvDir}`)
  console.log('📁 Guarde essa pasta em um local seguro (Google Drive, HD externo, etc.)')
}

backup()

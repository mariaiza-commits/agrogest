import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'

// ─── HELPERS ────────────────────────────────────────────────
const cor  = v => v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-muted)'
const pct  = (v, t) => t > 0 ? ((v / t) * 100).toFixed(1) + '%' : '—'

// ─── BADGE DE STATUS ────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    atrasado: { bg: '#fee2e2', color: '#991b1b', label: '🔴 Atrasado' },
    hoje:     { bg: '#fef3c7', color: '#92400e', label: '🟡 Hoje' },
    urgente:  { bg: '#fff7ed', color: '#c2410c', label: '🟠 Urgente' },
    proximo:  { bg: '#f0fdf4', color: '#166534', label: '🟢 Em breve' },
    ok:       { bg: '#f8fafc', color: '#64748b', label: '⚪ OK' },
  }
  const s = map[status] ?? map.ok
  return (
    <span style={{ fontSize: 11, background: s.bg, color: s.color, borderRadius: 4, padding: '2px 7px', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

// ─── CARD SECÇÃO ────────────────────────────────────────────
function Secao({ icon, titulo, badge, children, cor: corBorda = 'var(--border)' }) {
  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${corBorda}`, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{titulo}</span>
        {badge}
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )
}

// ─── KPI MINI ────────────────────────────────────────────────
function KpiMini({ label, value, color = 'var(--text)', sub }) {
  return (
    <div style={{ flex: 1, minWidth: 120, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, fontFamily: 'var(--font-display)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── BARRA HORIZONTAL ────────────────────────────────────────
function BarraH({ value, max, color = 'var(--green)', label, sub }) {
  const w = max > 0 ? Math.min(value / max * 100, 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{ minWidth: 80, fontWeight: 600, fontSize: 13 }}>{label}</div>
      <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 4, height: 22, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: w + '%', height: '100%', background: color, borderRadius: 4, transition: 'width .4s', display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
          {w > 20 && <span style={{ fontSize: 11, color: 'white', fontWeight: 600 }}>{fmt(value)}</span>}
        </div>
        {w <= 20 && <span style={{ position: 'absolute', left: w + '%', paddingLeft: 8, fontSize: 11, color: 'var(--text-muted)', top: '50%', transform: 'translateY(-50%)' }}>{fmt(value)}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 60, textAlign: 'right' }}>{sub}</div>}
    </div>
  )
}

// ─── MAIN ────────────────────────────────────────────────────
export default function Dashboard() {
  const [mesOffset, setMesOffset] = useState(0)
  const [loading, setLoading]     = useState(true)

  // Dados
  const [kpis, setKpis]           = useState(null)
  const [saldoConsolidado, setSaldo] = useState(null)
  const [contasDia, setContasDia] = useState([])
  const [inadimplentes, setInadim] = useState([])
  const [lucroCultura, setLucroCultura] = useState([])
  const [agenda, setAgenda]       = useState([])
  const [lotes, setLotes]         = useState([])

  const mesRef = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + mesOffset); return d
  }, [mesOffset])

  const mesLabel = useMemo(() =>
    mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())
  , [mesRef])

  const load = useCallback(async () => {
    setLoading(true)
    const mesStr = mesRef.toISOString().split('T')[0]

    const [
      { data: dash },
      { data: saldo },
      { data: contas },
      { data: inadim },
      { data: cult },
      { data: ag },
      { data: resumo },
    ] = await Promise.all([
      supabase.rpc('fn_dashboard_mes', { p_mes: mesStr }),
      supabase.from('vw_saldo_consolidado').select('*').single(),
      supabase.from('vw_contas_do_dia').select('*'),
      supabase.from('vw_inadimplencia').select('*').limit(5),
      supabase.from('vw_lucro_por_cultura').select('*'),
      supabase.from('vw_agenda_campo').select('*').limit(10),
      supabase.from('vw_resumo_por_lote').select('*'),
    ])

    setKpis(Array.isArray(dash) ? dash[0] : dash)
    setSaldo(saldo)
    setContasDia(contas ?? [])
    setInadim(inadim ?? [])
    setLucroCultura(cult ?? [])
    setAgenda(ag ?? [])
    setLotes(resumo ?? [])
    setLoading(false)
  }, [mesRef])

  useEffect(() => { load() }, [load])

  // Métricas derivadas
  const receita  = Number(kpis?.receita_mes ?? 0)
  const custo    = Number(kpis?.custo_mes ?? 0)
  const lucro    = Number(kpis?.lucro_mes ?? 0)
  const caixas   = Number(kpis?.caixas_mes ?? 0)
  const margem   = receita > 0 ? (lucro / receita * 100).toFixed(1) : 0
  const precoMed = caixas > 0 ? receita / caixas : 0

  const pagarHoje    = contasDia.filter(c => c.tipo === 'pagar')
  const receberHoje  = contasDia.filter(c => c.tipo === 'receber')
  const totalPagar   = pagarHoje.reduce((s, c) => s + Number(c.valor ?? 0), 0)
  const totalReceber = receberHoje.reduce((s, c) => s + Number(c.valor ?? 0), 0)

  const agendaAtrasada = agenda.filter(a => a.urgencia === 'atrasado')
  const agendaHoje     = agenda.filter(a => a.urgencia === 'hoje')
  const agendaUrgente  = agenda.filter(a => a.urgencia === 'urgente')
  const maxLucro       = Math.max(...lucroCultura.map(c => Math.abs(Number(c.lucro_total))), 1)
  const totalLucroLotes = lotes.reduce((s, l) => s + Number(l.lucro_bruto ?? 0), 0)

  if (loading) return <div className="loading">Carregando painel...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* NAVEGAÇÃO DE MESES */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="btn btn-sm" onClick={() => setMesOffset(o => o - 1)}>←</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16, color: 'var(--green)' }}>
          {mesLabel}
          {mesOffset === 0 && <span style={{ marginLeft: 8, fontSize: 11, background: 'var(--green-light)', color: 'var(--green)', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>Mês atual</span>}
        </div>
        <button className="btn btn-sm" onClick={() => setMesOffset(o => Math.min(o + 1, 0))} disabled={mesOffset === 0}>→</button>
        {mesOffset !== 0 && <button className="btn btn-sm" onClick={() => setMesOffset(0)}>Hoje</button>}
      </div>

      {/* ══════════════════════════════════════════════════════
          BLOCO 1 — FINANCEIRO
      ══════════════════════════════════════════════════════ */}
      <Secao
        icon="💰"
        titulo="Financeiro"
        cor={inadimplentes.length > 0 ? '#fca5a5' : 'var(--border)'}
        badge={inadimplentes.length > 0 && (
          <span style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>
            🔴 {inadimplentes.length} inadimplente(s)
          </span>
        )}
      >
        {/* Saldo consolidado */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Saldo consolidado</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <KpiMini label="Total" value={fmt(saldoConsolidado?.saldo_total)} color="var(--teal)" />
            <KpiMini label="Bancos" value={fmt(saldoConsolidado?.saldo_bancos)} color="var(--text)" />
            <KpiMini label="Caixa" value={fmt(saldoConsolidado?.saldo_caixa)} color="var(--text)" />
          </div>
        </div>

        {/* KPIs do mês */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Desempenho — {mesLabel}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <KpiMini label="Receita" value={fmt(receita)} color="var(--teal)" sub={`${caixas} caixas`} />
            <KpiMini label="Custos" value={fmt(custo)} color={custo > 0 ? 'var(--amber)' : 'var(--text-muted)'} />
            <KpiMini label="Lucro" value={fmt(lucro)} color={cor(lucro)} sub={`Margem ${margem}%`} />
            <KpiMini label="Preço médio/cx" value={precoMed > 0 ? fmt(precoMed) : '—'} color="var(--text)" />
          </div>
        </div>

        {/* Contas do dia */}
        {contasDia.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 8 }}>📅 Contas de hoje</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: '#92400e', fontWeight: 700, marginBottom: 4 }}>💸 Pagar — {fmt(totalPagar)}</div>
                {pagarHoje.slice(0, 3).map(c => (
                  <div key={c.id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{c.nome}</span>
                    <strong>{fmt(c.valor)}</strong>
                  </div>
                ))}
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: '#166534', fontWeight: 700, marginBottom: 4 }}>💰 Receber — {fmt(totalReceber)}</div>
                {receberHoje.slice(0, 3).map(c => (
                  <div key={c.id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{c.contraparte}</span>
                    <strong>{fmt(c.valor)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Inadimplência */}
        {inadimplentes.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>🚨 Inadimplência</div>
            {inadimplentes.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{i.comprador}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i.lote} · venceu {fmtDate(i.data_vencimento)}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(i.valor_total)}</div>
                  <div style={{ fontSize: 11, color: 'var(--red)' }}>{i.dias_atraso}d atraso</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Secao>

      {/* ══════════════════════════════════════════════════════
          BLOCO 2 — PRODUTIVIDADE POR CULTURA
      ══════════════════════════════════════════════════════ */}
      <Secao icon="📊" titulo="Produtividade por Cultura">
        {lucroCultura.length === 0
          ? <div className="empty">Nenhuma cultura cadastrada</div>
          : (
            <>
              {lucroCultura.map(c => {
                const rec  = Number(c.receita_total)
                const luc  = Number(c.lucro_total)
                const cst  = Number(c.custo_total)
                const area = Number(c.area_total_ha)
                const lucHa = area > 0 ? luc / area : 0
                const ativo = rec > 0
                return (
                  <div key={c.cultura_id} style={{ marginBottom: 14, opacity: ativo ? 1 : 0.45 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 20 }}>{c.icone}</span>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{c.cultura}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>{c.qtd_lotes} lote(s) · {area.toFixed(1)} ha</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Lucro/ha</div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: cor(lucHa) }}>{area > 0 ? fmt(lucHa) : '—'}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Lucro total</div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: cor(luc) }}>{fmt(luc)}</div>
                        </div>
                      </div>
                    </div>
                    {ativo && (
                      <BarraH
                        value={rec}
                        max={Math.max(...lucroCultura.map(x => Number(x.receita_total)), 1)}
                        color={luc >= 0 ? 'linear-gradient(90deg, var(--teal), var(--green))' : 'var(--red)'}
                        label=""
                        sub={`${pct(rec, lucroCultura.reduce((s,x)=>s+Number(x.receita_total),0))} receita`}
                      />
                    )}
                    {!ativo && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem vendas registradas</div>}
                  </div>
                )
              })}

              {/* Ranking de lotes */}
              {lotes.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10 }}>🏆 Ranking de lotes</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr style={{ background: 'var(--bg)' }}>
                          <th style={{ width: 24 }}>#</th>
                          <th>Lote</th>
                          <th style={{ textAlign: 'right' }}>Receita</th>
                          <th style={{ textAlign: 'right' }}>Lucro</th>
                          <th style={{ textAlign: 'right' }}>Margem</th>
                          <th style={{ width: 80 }}>Part.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...lotes].sort((a,b)=>Number(b.lucro_bruto)-Number(a.lucro_bruto)).map((l,i) => {
                          const rec = Number(l.receita_bruta)
                          const luc = Number(l.lucro_bruto)
                          const mg  = rec > 0 ? (luc/rec*100).toFixed(1) : 0
                          const part = totalLucroLotes > 0 ? (luc/totalLucroLotes*100).toFixed(1) : 0
                          return (
                            <tr key={l.lote_id} style={{ opacity: rec === 0 ? 0.4 : 1 }}>
                              <td style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{i+1}</td>
                              <td><strong>{l.lote}</strong></td>
                              <td style={{ textAlign: 'right', color: 'var(--teal)', fontWeight: 600, fontSize: 13 }}>{fmt(rec)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: cor(luc) }}>{fmt(luc)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600, fontSize: 12, color: Number(mg) >= 30 ? 'var(--green)' : 'var(--amber)' }}>{mg > 0 ? mg+'%' : '—'}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <div style={{ flex: 1, height: 6, background: 'var(--bg)', borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: Math.min(Number(part),100)+'%', height: '100%', background: 'var(--green)', borderRadius: 3 }} />
                                  </div>
                                  <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 28 }}>{part}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
      </Secao>

      {/* ══════════════════════════════════════════════════════
          BLOCO 3 — AGENDA DO CAMPO
      ══════════════════════════════════════════════════════ */}
      <Secao
        icon="🌾"
        titulo="Agenda do Campo — Próximos 15 dias"
        cor={agendaAtrasada.length > 0 ? '#fca5a5' : agendaHoje.length > 0 ? '#fde68a' : 'var(--border)'}
        badge={
          agendaAtrasada.length > 0
            ? <span style={{ fontSize: 11, background: '#fee2e2', color: '#991b1b', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>🔴 {agendaAtrasada.length} atrasada(s)</span>
            : agendaHoje.length > 0
            ? <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '2px 8px', fontWeight: 600 }}>🟡 {agendaHoje.length} para hoje</span>
            : null
        }
      >
        {agenda.length === 0
          ? <div className="empty">Nenhuma atividade programada para os próximos 15 dias</div>
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agenda.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '8px 12px', borderRadius: 8,
                  background: a.urgencia === 'atrasado' ? '#fff5f5' : a.urgencia === 'hoje' ? '#fffbeb' : 'var(--bg)',
                  border: `1px solid ${a.urgencia === 'atrasado' ? '#fca5a5' : a.urgencia === 'hoje' ? '#fde68a' : 'var(--border)'}`,
                }}>
                  <StatusBadge status={a.urgencia} />
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.cultura_icone} {a.tipo_atividade}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.lote}{a.setor ? ` · ${a.setor}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(a.proxima_execucao)}</div>
                    {a.dias_atraso > 0 && <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>{a.dias_atraso}d atraso</div>}
                    {a.frequencia_dias && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>A cada {a.frequencia_dias}d</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
      </Secao>

    </div>
  )
}

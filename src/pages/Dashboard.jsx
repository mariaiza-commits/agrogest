import React, { useEffect, useState, useCallback } from 'react'
import { Bar, Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Tooltip, Filler
} from 'chart.js'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Filler)

export default function Dashboard() {
  const [kpis, setKpis]       = useState(null)
  const [lotes, setLotes]     = useState([])
  const [mensal, setMensal]   = useState([])
  const [vencer, setVencer]   = useState([])  // contas a pagar vencendo
  const [atraso, setAtraso]   = useState([])  // contas em atraso
  const [receber, setReceber] = useState([])  // a receber
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('mes') // mes | trimestre | tudo

  const load = useCallback(async () => {
    setLoading(true)
    const hoje = new Date()
    const em7d = new Date(hoje.getTime() + 7 * 86400000).toISOString().split('T')[0]
    const em3d = new Date(hoje.getTime() + 3 * 86400000).toISOString().split('T')[0]
    const hojeStr = hoje.toISOString().split('T')[0]

    const [
      { data: dash },
      { data: resumo },
      { data: prod },
      { data: pagar7d },
      { data: emAtraso },
      { data: receberPend },
    ] = await Promise.all([
      supabase.from('vw_dashboard_mensal').select('*').single(),
      supabase.from('vw_resumo_por_lote').select('*'),
      supabase.from('vw_producao_mensal').select('*').order('mes', { ascending: true }).limit(6),
      // Vencendo em 7 dias (não atrasado ainda)
      supabase.from('vw_contas_a_pagar').select('*')
        .gte('data_vencimento', hojeStr)
        .lte('data_vencimento', em7d),
      // Já atrasado
      supabase.from('vw_contas_a_pagar').select('*')
        .lt('data_vencimento', hojeStr)
        .order('data_vencimento', { ascending: true }).limit(10),
      // A receber pendente
      supabase.from('vw_contas_a_receber').select('*')
        .order('data_vencimento', { ascending: true }).limit(5),
    ])

    setKpis(dash)
    setLotes(resumo ?? [])
    setMensal(prod ?? [])
    setVencer(pagar7d ?? [])
    setAtraso(emAtraso ?? [])
    setReceber(receberPend ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="loading">Carregando painel...</div>

  // Agrupa produção mensal
  const mensalAgrup = (mensal ?? []).reduce((acc, r) => {
    const k = r.mes_label
    if (!acc[k]) acc[k] = { label: k, caixas: 0 }
    acc[k].caixas += Number(r.total_caixas)
    return acc
  }, {})
  const mensalArr = Object.values(mensalAgrup)

  const chartOpts = (cb) => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: cb } } },
    scales: {
      x: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { color: '#999', font: { size: 10 } } },
      y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { color: '#999', font: { size: 10 }, callback: v => 'R$' + (v >= 1000 ? (v/1000).toFixed(0)+'k' : v) } }
    }
  })

  const totalAtrasado = atraso.reduce((s, a) => s + Number(a.valor ?? 0), 0)
  const totalVencer   = vencer.reduce((s, v) => s + Number(v.valor ?? 0), 0)
  const totalReceber  = receber.reduce((s, r) => s + Number(r.valor_total ?? 0), 0)

  return (
    <>
      {/* KPIs */}
      <div className="metric-grid">
        <div className="metric teal">
          <div className="metric-label">Receita do mês</div>
          <div className="metric-value">{fmt(kpis?.receita_mes)}</div>
          <div className="metric-sub">Recebido: {fmt((kpis?.receita_mes ?? 0) - (kpis?.total_a_receber ?? 0))}</div>
          <div className="metric-bar"><div className="metric-bar-fill" style={{ width: '100%', background: 'var(--teal-mid)' }} /></div>
        </div>
        <div className="metric amber">
          <div className="metric-label">Custos do mês</div>
          <div className="metric-value">{fmt(kpis?.custo_mes)}</div>
          <div className="metric-sub">Pago: {fmt((kpis?.custo_mes ?? 0) - (kpis?.total_a_pagar ?? 0))}</div>
          <div className="metric-bar"><div className="metric-bar-fill" style={{ width: kpis?.receita_mes > 0 ? Math.min(((kpis?.custo_mes ?? 0)/(kpis?.receita_mes ?? 1))*100, 100)+'%' : '0%', background: 'var(--amber-mid)' }} /></div>
        </div>
        <div className={`metric ${Number(kpis?.lucro_mes) >= 0 ? 'green' : 'red'}`}>
          <div className="metric-label">Lucro do mês</div>
          <div className="metric-value">{fmt(kpis?.lucro_mes)}</div>
          <div className="metric-sub">
            Margem {kpis?.receita_mes > 0 ? ((kpis.lucro_mes / kpis.receita_mes) * 100).toFixed(1) + '%' : '—'}
          </div>
          <div className="metric-bar"><div className="metric-bar-fill" style={{ width: kpis?.receita_mes > 0 ? Math.max(0, Math.min(((kpis?.lucro_mes ?? 0)/(kpis?.receita_mes ?? 1))*100, 100))+'%' : '0%', background: 'var(--green-mid)' }} /></div>
        </div>
        <div className="metric">
          <div className="metric-label">Caixas do mês</div>
          <div className="metric-value">{Number(kpis?.caixas_mes ?? 0).toLocaleString('pt-BR')}</div>
          <div className="metric-sub">{((kpis?.caixas_mes ?? 0) / 20).toFixed(1)} cargas</div>
        </div>
      </div>

      {/* ALERTAS */}
      {(atraso.length > 0 || vencer.length > 0 || receber.length > 0) && (
        <div className="alertas-grid">
          {atraso.length > 0 && (
            <div className="alerta-card urgente">
              <div className="alerta-icon">🚨</div>
              <div className="alerta-body">
                <div className="alerta-title">{atraso.length} conta{atraso.length > 1 ? 's' : ''} em atraso — {fmt(totalAtrasado)}</div>
                <div className="alerta-list">
                  {atraso.slice(0, 3).map(a => (
                    <div key={a.id} className="alerta-item">
                      <span>{a.descricao?.substring(0, 22) ?? a.fornecedor}</span>
                      <strong>{fmt(a.valor)}</strong>
                    </div>
                  ))}
                  {atraso.length > 3 && <div className="alerta-desc">+{atraso.length - 3} mais...</div>}
                </div>
              </div>
            </div>
          )}

          {vencer.length > 0 && (
            <div className="alerta-card aviso">
              <div className="alerta-icon">⚠️</div>
              <div className="alerta-body">
                <div className="alerta-title">{vencer.length} vence{vencer.length > 1 ? 'm' : ''} em 7 dias — {fmt(totalVencer)}</div>
                <div className="alerta-list">
                  {vencer.slice(0, 3).map(v => (
                    <div key={v.id} className="alerta-item">
                      <span>{fmtDate(v.data_vencimento)} · {v.lote}</span>
                      <strong>{fmt(v.valor)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {receber.length > 0 && (
            <div className="alerta-card info">
              <div className="alerta-icon">💰</div>
              <div className="alerta-body">
                <div className="alerta-title">{receber.length} a receber — {fmt(totalReceber)}</div>
                <div className="alerta-list">
                  {receber.slice(0, 3).map(r => (
                    <div key={r.id} className="alerta-item">
                      <span>{r.comprador?.substring(0, 18)}</span>
                      <strong>{fmt(r.valor_total)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LUCRO POR LOTE */}
      <div className="card">
        <div className="section-header">
          <div className="card-title" style={{ marginBottom: 0 }}>Lucro por lote</div>
        </div>
        {lotes.length === 0
          ? <div className="empty">Sem dados ainda — registre vendas e custos</div>
          : (
            <div className="lucro-grid">
              {[...lotes].sort((a, b) => Number(b.lucro_bruto) - Number(a.lucro_bruto)).map(l => {
                const lucro = Number(l.lucro_bruto)
                const margem = Number(l.margem_pct)
                const maxLucro = Math.max(...lotes.map(x => Math.abs(Number(x.lucro_bruto))), 1)
                const barW = Math.min(Math.abs(lucro) / maxLucro * 100, 100)
                return (
                  <div key={l.lote_id} className="lucro-card">
                    <div className="lucro-card-name">{l.lote}</div>
                    <div className="lucro-card-variety">{l.variedade} · {l.area_hectares} ha</div>
                    <div className={`lucro-valor ${lucro >= 0 ? 'pos' : 'neg'}`}>{fmt(lucro)}</div>
                    <div className="lucro-margem">Margem {margem.toFixed(1)}%</div>
                    <div className="lucro-bar">
                      <div className="lucro-bar-fill" style={{
                        width: barW + '%',
                        background: lucro >= 0
                          ? (margem >= 50 ? 'var(--green)' : 'var(--amber-mid)')
                          : 'var(--red-mid)'
                      }} />
                    </div>
                    <div className="lucro-stats">
                      <div className="lucro-stat">
                        <div className="lucro-stat-label">Receita</div>
                        <div className="lucro-stat-val" style={{ color: 'var(--teal)' }}>{fmt(l.receita_bruta)}</div>
                      </div>
                      <div className="lucro-stat">
                        <div className="lucro-stat-label">Custo</div>
                        <div className="lucro-stat-val" style={{ color: 'var(--amber)' }}>{fmt(l.custo_total)}</div>
                      </div>
                      <div className="lucro-stat">
                        <div className="lucro-stat-label">Caixas</div>
                        <div className="lucro-stat-val">{Number(l.total_caixas_produzidas).toLocaleString()}</div>
                      </div>
                      <div className="lucro-stat">
                        <div className="lucro-stat-label">cx/ha</div>
                        <div className="lucro-stat-val">{Number(l.caixas_por_hectare).toFixed(0)}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {/* GRÁFICOS */}
      <div className="chart-grid">
        <div className="card">
          <div className="card-title">Receita vs Custo por lote</div>
          <div className="chart-wrap">
            {lotes.length > 0 ? (
              <Bar
                data={{
                  labels: lotes.map(l => l.lote),
                  datasets: [
                    { label: 'Receita', data: lotes.map(l => Number(l.receita_bruta)), backgroundColor: 'rgba(29,158,117,.75)', borderRadius: 4 },
                    { label: 'Custo',   data: lotes.map(l => Number(l.custo_total)),   backgroundColor: 'rgba(186,117,23,.75)',  borderRadius: 4 },
                  ]
                }}
                options={{
                  ...chartOpts(ctx => fmt(ctx.raw)),
                  plugins: { ...chartOpts().plugins, legend: { display: true, labels: { font: { size: 11 }, boxWidth: 12 } } }
                }}
              />
            ) : <div className="empty">Sem dados</div>}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Produção mensal (caixas)</div>
          <div className="chart-wrap">
            {mensalArr.length > 0 ? (
              <Line
                data={{
                  labels: mensalArr.map(m => m.label),
                  datasets: [{
                    data: mensalArr.map(m => m.caixas),
                    borderColor: '#1D9E75', backgroundColor: 'rgba(29,158,117,.10)',
                    fill: true, tension: 0.4, pointBackgroundColor: '#1D9E75', pointRadius: 4,
                  }]
                }}
                options={chartOpts(ctx => ctx.raw.toLocaleString('pt-BR') + ' cx')}
              />
            ) : <div className="empty">Sem dados</div>}
          </div>
        </div>
      </div>
    </>
  )
}

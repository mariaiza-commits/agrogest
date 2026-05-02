import React, { useEffect, useState, useCallback, useMemo } from 'react'
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
  const [vencer, setVencer]   = useState([])
  const [atraso, setAtraso]   = useState([])
  const [receber, setReceber] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('mes')
  const [mesOffset, setMesOffset] = useState(0) // 0 = mês atual, -1 = mês anterior, etc.

  const mesRef = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() + mesOffset)
    return d
  }, [mesOffset])

  const mesLabel = useMemo(() => {
    return mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      .replace(/^\w/, c => c.toUpperCase())
  }, [mesRef])

  const load = useCallback(async () => {
    setLoading(true)
    const hoje = new Date()
    const em7d = new Date(hoje.getTime() + 7 * 86400000).toISOString().split('T')[0]
    const hojeStr = hoje.toISOString().split('T')[0]
    const mesStr = mesRef.toISOString().split('T')[0]

    const [
      { data: dash },
      { data: resumo },
      { data: prod },
      { data: pagar7d },
      { data: emAtraso },
      { data: receberPend },
    ] = await Promise.all([
      supabase.rpc('fn_dashboard_mes', { p_mes: mesStr }),
      supabase.from('vw_resumo_por_lote').select('*'),
      supabase.from('vw_producao_mensal').select('*').order('mes', { ascending: true }).limit(6),
      supabase.from('vw_contas_a_pagar').select('*').gte('data_vencimento', hojeStr).lte('data_vencimento', em7d),
      supabase.from('vw_contas_a_pagar').select('*').lt('data_vencimento', hojeStr).order('data_vencimento', { ascending: true }).limit(10),
      supabase.from('vw_contas_a_receber').select('*').order('data_vencimento', { ascending: true }).limit(5),
    ])

    setKpis(Array.isArray(dash) ? dash[0] : dash)
    setLotes(resumo ?? [])
    setMensal(prod ?? [])
    setVencer(pagar7d ?? [])
    setAtraso(emAtraso ?? [])
    setReceber(receberPend ?? [])
    setLoading(false)
  }, [mesRef])

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
      {/* Navegação de meses */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <button className="btn btn-sm" onClick={()=>setMesOffset(o=>o-1)}>← Anterior</button>
        <div style={{ fontWeight:700, fontSize:16, flex:1, textAlign:'center', color:'var(--green)' }}>
          {mesLabel}
          {mesOffset === 0 && <span className="badge badge-green" style={{ marginLeft:8, fontSize:10 }}>Mês atual</span>}
        </div>
        <button className="btn btn-sm" onClick={()=>setMesOffset(o=>Math.min(o+1,0))} disabled={mesOffset===0}>Próximo →</button>
        {mesOffset !== 0 && <button className="btn btn-sm" onClick={()=>setMesOffset(0)}>Hoje</button>}
      </div>

      {/* KPIs */}
      <div className="metric-grid">
        <div className="metric teal">
          <div className="metric-label">Receita do mês</div>
          <div className="metric-value">{fmt(kpis?.receita_mes)}</div>
          <div className="metric-sub">A receber: {fmt(kpis?.total_a_receber ?? 0)}</div>
          <div className="metric-bar"><div className="metric-bar-fill" style={{ width: '100%', background: 'var(--teal-mid)' }} /></div>
        </div>
        <div className="metric amber">
          <div className="metric-label">Custos do mês</div>
          <div className="metric-value">{fmt(kpis?.custo_mes)}</div>
          <div className="metric-sub">A pagar: {fmt(kpis?.total_a_pagar ?? 0)}</div>
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
          <div className="metric-label">Caixas do mês</div>
          <div className="metric-value">{Number(kpis?.caixas_mes ?? 0).toLocaleString('pt-BR')}</div>
          <div className="metric-sub">{kpis?.caixas_mes > 0 ? `${((kpis?.caixas_mes ?? 0) / 20).toFixed(1)} cargas est.` : 'Sem produção'}</div>
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

      {/* LUCRO POR LOTE — ranking compacto */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div className="card-title" style={{ marginBottom:0 }}>🏆 Ranking por lucro</div>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>{lotes.length} lotes</span>
        </div>
        {lotes.length === 0
          ? <div className="empty">Sem dados ainda</div>
          : <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{width:28}}>#</th>
                    <th>Lote</th>
                    <th style={{textAlign:'right'}}>Receita</th>
                    <th style={{textAlign:'right'}}>Custo</th>
                    <th style={{textAlign:'right'}}>Lucro</th>
                    <th style={{textAlign:'right'}}>Margem</th>
                    <th style={{width:100}}>Barra</th>
                  </tr>
                </thead>
                <tbody>
                  {[...lotes].sort((a,b)=>Number(b.lucro_bruto)-Number(a.lucro_bruto)).map((l,i)=>{
                    const lucro  = Number(l.lucro_bruto)
                    const margem = Number(l.margem_pct)
                    const maxLucro = Math.max(...lotes.map(x=>Math.abs(Number(x.lucro_bruto))),1)
                    const barW = Math.min(Math.abs(lucro)/maxLucro*100,100)
                    const cor = lucro>=0?(margem>=40?'var(--green)':'var(--amber)'):'var(--red)'
                    return (
                      <tr key={l.lote_id}>
                        <td style={{color:'var(--text-muted)',fontSize:12,fontWeight:600}}>{i+1}</td>
                        <td><strong>{l.lote}</strong></td>
                        <td style={{textAlign:'right',color:'var(--teal)',fontSize:13}}>{fmt(l.receita_bruta)}</td>
                        <td style={{textAlign:'right',color:'var(--amber)',fontSize:13}}>{fmt(l.custo_total)}</td>
                        <td style={{textAlign:'right',fontWeight:700,color:cor}}>{fmt(lucro)}</td>
                        <td style={{textAlign:'right',fontWeight:600,color:cor,fontSize:13}}>{margem.toFixed(1)}%</td>
                        <td>
                          <div style={{background:'var(--bg)',borderRadius:4,height:8,overflow:'hidden'}}>
                            <div style={{width:barW+'%',height:'100%',background:cor,borderRadius:4,transition:'width .3s'}} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>}
      </div>

      {/* RESUMO POR CULTURA */}
      <ResumoCulturas />

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

function ResumoCulturas() {
  const [culturas, setCulturas] = useState([])
  useEffect(() => {
    supabase.from('vw_resumo_por_cultura').select('*').then(({ data }) => setCulturas(data??[]))
  }, [])
  if (!culturas.length) return null
  const maxReceita = Math.max(...culturas.map(c=>Number(c.receita_total)),1)
  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <div className="card-title" style={{ marginBottom:0 }}>🌿 Resumo por cultura</div>
        <span style={{ fontSize:12, color:'var(--text-muted)' }}>{culturas.length} cultura(s)</span>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {culturas.map(c => {
          const receita = Number(c.receita_total)
          const custo   = Number(c.custo_total)
          const lucro   = receita - custo
          const barW    = Math.min(receita/maxReceita*100, 100)
          return (
            <div key={c.cultura} style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <div style={{ minWidth:100, fontWeight:600, fontSize:13 }}>{c.cultura}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', minWidth:80 }}>{c.qtd_lotes} lote(s) · {c.qtd_setores} setor(es)</div>
              <div style={{ flex:1, minWidth:120 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text-muted)', marginBottom:3 }}>
                  <span>Receita</span>
                  <span>{barW.toFixed(0)}% do total</span>
                </div>
                <div style={{ background:'var(--bg)', borderRadius:6, height:10, overflow:'hidden', position:'relative' }}>
                  <div style={{ width:barW+'%', height:'100%', background:'linear-gradient(90deg, var(--teal), var(--green))', borderRadius:6, transition:'width .4s' }} />
                  {custo > 0 && (
                    <div style={{ position:'absolute', top:0, left:0, width:Math.min(custo/maxReceita*100,100)+'%', height:'100%', background:'rgba(186,117,23,0.35)', borderRadius:6 }} />
                  )}
                </div>
                <div style={{ display:'flex', gap:8, marginTop:3, fontSize:10, color:'var(--text-muted)' }}>
                  <span style={{ color:'var(--teal)' }}>■ Receita</span>
                  {custo > 0 && <span style={{ color:'var(--amber)' }}>■ Custo</span>}
                </div>
              </div>
              <div style={{ display:'flex', gap:16, flexShrink:0 }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>Caixas</div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{Number(c.total_caixas).toLocaleString('pt-BR')}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>Receita</div>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--teal)' }}>{fmt(receita)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>Lucro</div>
                  <div style={{ fontWeight:700, fontSize:13, color:lucro>=0?'var(--green)':'var(--red)' }}>{fmt(lucro)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

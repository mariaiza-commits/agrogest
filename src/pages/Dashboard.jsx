import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'

// ─── TOKENS ──────────────────────────────────────────────────
const cor = v => v > 0 ? '#3B6D11' : v < 0 ? '#A32D2D' : '#888'

// ─── NAV GROUPS (sidebar desktop) ───────────────────────────
const NAV_GROUPS = [
  {
    label: 'Visão geral',
    items: [{ icon:'📅', label:'Dashboard', page:'Dashboard' }]
  },
  {
    label: 'Campo',
    items: [
      { icon:'🗺️', label:'Lotes / Piquetes', page:'Lotes' },
      { icon:'🌱', label:'Culturas',          page:'Culturas' },
      { icon:'🌾', label:'Produção',           page:'Producao' },
      { icon:'🔧', label:'Atividades',         page:'Atividades' },
      { icon:'📆', label:'Programação',        page:'Programacao' },
      { icon:'📦', label:'Estoque',            page:'Estoque' },
    ]
  },
  {
    label: 'Relacionamentos',
    items: [
      { icon:'👥', label:'Clientes',     page:'Clientes' },
      { icon:'🏭', label:'Fornecedores', page:'Fornecedores' },
    ]
  },
  {
    label: 'Financeiro',
    items: [
      { icon:'🛒', label:'Vendas',      page:'Vendas' },
      { icon:'💸', label:'Custos',      page:'Custos' },
      { icon:'🏦', label:'Financeiro',  page:'Financeiro' },
    ]
  }
]

// ─── HELPERS ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ background:'#F1EFE8', borderRadius:8, padding:'10px 14px' }}>
      <div style={{ fontSize:11, color:'#888', marginBottom:4, fontWeight:500 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:600, color: color ?? '#1a1a1a', lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#aaa', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

function SectionTitle({ children, action, onAction }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
      <span style={{ fontSize:13, fontWeight:600, color:'#333' }}>{children}</span>
      {action && <button onClick={onAction} style={{ fontSize:12, color:'#2d6a2d', background:'none', border:'none', cursor:'pointer', padding:0 }}>{action}</button>}
    </div>
  )
}

function AlertItem({ nivel, mensagem, valor }) {
  const map = {
    critico:{ bg:'#FCEBEB', border:'#F5BCBC', color:'#A32D2D', icon:'🚨' },
    atencao:{ bg:'#FAEEDA', border:'#F5D5A0', color:'#854F0B', icon:'⚠️' },
    info:   { bg:'#E6F1FB', border:'#B3D4F5', color:'#185FA5', icon:'ℹ️' },
  }
  const s = map[nivel] ?? map.info
  return (
    <div style={{ background:s.bg, border:`0.5px solid ${s.border}`, borderRadius:8, padding:'8px 12px', display:'flex', gap:8, alignItems:'center', marginBottom:6 }}>
      <span style={{ fontSize:14 }}>{s.icon}</span>
      <span style={{ fontSize:12, color:s.color, flex:1 }}>{mensagem}</span>
      {Number(valor) > 0 && <span style={{ fontSize:12, fontWeight:600, color:s.color, whiteSpace:'nowrap' }}>{fmt(valor)}</span>}
    </div>
  )
}

// ─── SIDEBAR DESKTOP ─────────────────────────────────────────
function Sidebar({ currentPage, onNavigate, onSair }) {
  return (
    <div style={{
      width:200, flexShrink:0, background:'white',
      borderRight:'0.5px solid rgba(0,0,0,0.1)',
      display:'flex', flexDirection:'column',
      height:'100vh', position:'sticky', top:0, overflowY:'auto',
    }}>
      {/* Logo */}
      <div style={{ padding:'18px 16px 12px', borderBottom:'0.5px solid rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize:16, fontWeight:600, color:'#2d6a2d' }}>🍌 AgroGestão</div>
        <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>Jaíba · MG</div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'8px 0', overflowY:'auto' }}>
        {NAV_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom:4 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:'.6px', padding:'8px 16px 4px' }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const active = currentPage === item.page
              return (
                <button key={item.page} onClick={() => onNavigate(item.page)} style={{
                  width:'100%', display:'flex', alignItems:'center', gap:8,
                  padding:'7px 16px', border:'none', cursor:'pointer', textAlign:'left',
                  background: active ? '#EAF3DE' : 'none',
                  color: active ? '#2d6a2d' : '#666',
                  fontWeight: active ? 500 : 400, fontSize:13,
                  borderRadius:0,
                  transition:'background .15s',
                }}>
                  <span style={{ fontSize:14 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop:'0.5px solid rgba(0,0,0,0.08)', padding:'10px 0' }}>
        <button onClick={onSair} style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'7px 16px', border:'none', cursor:'pointer', background:'none', color:'#888', fontSize:13 }}>
          <span>🚪</span><span>Sair</span>
        </button>
      </div>
    </div>
  )
}

// ─── HOOK DE DADOS ───────────────────────────────────────────
function useDashData(mesRef) {
  const [kpis, setKpis]         = useState(null)
  const [saldo, setSaldo]       = useState(null)
  const [contasDia, setContas]  = useState([])
  const [inadim, setInadim]     = useState([])
  const [cultura, setCultura]   = useState([])
  const [agenda, setAgenda]     = useState([])
  const [lotes, setLotes]       = useState([])
  const [alertas, setAlertas]   = useState([])
  const [fluxo, setFluxo]       = useState([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const mesStr = mesRef.toISOString().split('T')[0]
    const [{ data:dash },{ data:sal },{ data:contas },{ data:ind },{ data:cult },
           { data:ag },{ data:res },{ data:al },{ data:fl }] = await Promise.all([
      supabase.rpc('fn_dashboard_mes', { p_mes:mesStr }),
      supabase.from('vw_saldo_consolidado').select('*').single(),
      supabase.from('vw_contas_do_dia').select('*'),
      supabase.from('vw_inadimplencia').select('*').limit(5),
      supabase.from('vw_lucro_por_cultura').select('*'),
      supabase.from('vw_agenda_campo').select('*').limit(10),
      supabase.from('vw_resumo_por_lote').select('*'),
      supabase.from('vw_alertas_sistema').select('*').limit(15),
      supabase.from('vw_fluxo_projetado').select('*').limit(10),
    ])
    setKpis(Array.isArray(dash)?dash[0]:dash)
    setSaldo(sal); setContas(contas??[]); setInadim(ind??[])
    setCultura(cult??[]); setAgenda(ag??[]); setLotes(res??[])
    setAlertas(al??[]); setFluxo(fl??[])
    setLoading(false)
  }, [mesRef])

  useEffect(() => { load() }, [load])
  return { kpis, saldo, contasDia, inadim, cultura, agenda, lotes, alertas, fluxo, loading, reload:load }
}

// ─── MAIN COMPONENT ──────────────────────────────────────────
export default function Dashboard({ onNavigate, currentPage, onSair }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mesOffset, setMesOffset] = useState(0)
  const [aba, setAba] = useState('hoje')

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const mesRef = useMemo(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + mesOffset); return d
  }, [mesOffset])

  const mesLabel = useMemo(() =>
    mesRef.toLocaleDateString('pt-BR', { month:'long', year:'numeric' }).replace(/^\w/, c => c.toUpperCase())
  , [mesRef])

  const { kpis, saldo, contasDia, inadim, cultura, agenda, lotes, alertas, fluxo, loading } = useDashData(mesRef)

  // Métricas derivadas
  const receita  = Number(kpis?.receita_mes ?? 0)
  const custo    = Number(kpis?.custo_mes ?? 0)
  const lucro    = Number(kpis?.lucro_mes ?? 0)
  const caixas   = Number(kpis?.caixas_mes ?? 0)
  const margem   = receita > 0 ? (lucro/receita*100).toFixed(1) : 0
  const precoMed = caixas > 0 ? receita/caixas : 0
  const criticos = alertas.filter(a => a.nivel === 'critico')
  const pagarHoje   = contasDia.filter(c => c.tipo === 'pagar')
  const receberHoje = contasDia.filter(c => c.tipo === 'receber')
  const totalPagar  = pagarHoje.reduce((s,c)=>s+Number(c.valor??0),0)
  const totalRec    = receberHoje.reduce((s,c)=>s+Number(c.valor??0),0)
  const totalLucro  = lotes.reduce((s,l)=>s+Number(l.lucro_bruto??0),0)
  const urgCor  = { atrasado:'#A32D2D', urgente:'#854F0B', proximo:'#3B6D11', hoje:'#854F0B', ok:'#3B6D11' }
  const urgBg   = { atrasado:'#FCEBEB', urgente:'#FAEEDA', proximo:'#EAF3DE', hoje:'#FAEEDA', ok:'#EAF3DE' }
  const urgLabel = { atrasado:'atrasado', urgente:'urgente', proximo:'em breve', hoje:'hoje', ok:'ok' }

  // ── KPI STRIP (compartilhado) ────────────────────────────
  const KpiStrip = () => (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${isMobile?2:6},1fr)`, gap:10, marginBottom:16 }}>
      <KpiCard label="Receita" value={fmt(receita)} sub={`${caixas} caixas`} color="#3B6D11" />
      <KpiCard label="Custos"  value={fmt(custo)}   color={custo>0?'#A32D2D':'#aaa'} />
      <KpiCard label="Lucro"   value={fmt(lucro)}   sub={`Margem ${margem}%`} color={cor(lucro)} />
      <KpiCard label="Saldo"   value={fmt(saldo?.saldo_total)} sub={`${saldo?.qtd_contas??0} conta(s)`} color="#185FA5" />
      <KpiCard label="Preço/cx" value={precoMed>0?fmt(precoMed):'—'} color="#1a1a1a" />
      <KpiCard label="Alertas" value={alertas.length} sub={`${criticos.length} crítico(s)`} color={criticos.length>0?'#A32D2D':'#aaa'} />
    </div>
  )

  // ── COLUNA ESQUERDA ──────────────────────────────────────
  const ColunaEsq = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Agenda 7 dias */}
      <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:12, padding:'14px 16px' }}>
        <SectionTitle>🌾 Agenda do campo</SectionTitle>
        {agenda.length === 0
          ? <div style={{ fontSize:12, color:'#aaa', textAlign:'center', padding:'12px 0' }}>Nenhuma atividade programada</div>
          : agenda.slice(0,6).map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'0.5px solid rgba(0,0,0,0.06)' }}>
                <div style={{ width:32, height:32, borderRadius:8, background:urgBg[a.urgencia]??'#F1EFE8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                  {a.cultura_icone ?? '📝'}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.tipo_atividade}</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.lote}{a.setor?` · ${a.setor}`:''}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:urgCor[a.urgencia]??'#888', background:urgBg[a.urgencia]??'#F1EFE8', borderRadius:4, padding:'1px 7px', fontSize:11 }}>
                    {urgLabel[a.urgencia] ?? a.urgencia}
                  </div>
                  <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{fmtDate(a.proxima_execucao)}</div>
                </div>
              </div>
            ))}
      </div>

      {/* Produtividade por lote */}
      <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:12, padding:'14px 16px' }}>
        <SectionTitle>🏆 Produtividade por lote</SectionTitle>
        {lotes.length === 0
          ? <div style={{ fontSize:12, color:'#aaa', textAlign:'center', padding:'12px 0' }}>Sem dados de lotes</div>
          : lotes.slice(0,5).map((l,i) => {
              const rec = Number(l.receita_bruta); const luc = Number(l.lucro_bruto)
              const mg = rec>0?(luc/rec*100).toFixed(1):0
              const maxRec = Math.max(...lotes.map(x=>Number(x.receita_bruta)),1)
              return (
                <div key={l.lote_id} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                    <span style={{ fontSize:13, fontWeight:500 }}>{l.lote}</span>
                    <div style={{ display:'flex', gap:12, fontSize:12 }}>
                      <span style={{ color:'#185FA5' }}>{fmt(rec)}</span>
                      <span style={{ fontWeight:600, color:cor(luc) }}>{fmt(luc)}</span>
                      <span style={{ color: Number(mg)>=30?'#3B6D11':'#854F0B', fontSize:11 }}>{mg}%</span>
                    </div>
                  </div>
                  <div style={{ background:'#F1EFE8', borderRadius:4, height:6, overflow:'hidden' }}>
                    <div style={{ width:Math.min(rec/maxRec*100,100)+'%', height:'100%', background:luc>=0?'#3B6D11':'#A32D2D', borderRadius:4, transition:'width .4s' }} />
                  </div>
                </div>
              )
            })}
      </div>

      {/* Culturas */}
      {cultura.filter(c=>Number(c.receita_liquida)>0).length > 0 && (
        <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:12, padding:'14px 16px' }}>
          <SectionTitle>🌿 Por cultura</SectionTitle>
          {cultura.filter(c=>Number(c.receita_liquida)>0).map(c => {
            const rec=Number(c.receita_liquida), luc=Number(c.lucro_total)
            const maxRec=Math.max(...cultura.map(x=>Number(x.receita_liquida)),1)
            return (
              <div key={c.cultura_id} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:13 }}>{c.icone} {c.cultura}</span>
                  <div style={{ display:'flex', gap:10, fontSize:12 }}>
                    <span style={{ color:'#185FA5' }}>{fmt(rec)}</span>
                    <span style={{ fontWeight:600, color:cor(luc) }}>{fmt(luc)}</span>
                  </div>
                </div>
                <div style={{ background:'#F1EFE8', borderRadius:4, height:6, overflow:'hidden' }}>
                  <div style={{ width:Math.min(rec/maxRec*100,100)+'%', height:'100%', background:'linear-gradient(90deg,#185FA5,#3B6D11)', borderRadius:4 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  // ── COLUNA DIREITA ───────────────────────────────────────
  const ColunaDir = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* Financeiro do dia */}
      <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:12, padding:'14px 16px' }}>
        <SectionTitle>💰 Financeiro do dia</SectionTitle>

        {receberHoje.length > 0 && (
          <>
            <div style={{ fontSize:11, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>A receber</div>
            {receberHoje.slice(0,3).map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#3B6D11', flexShrink:0 }} />
                <span style={{ fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.contraparte ?? c.nome}</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#3B6D11', whiteSpace:'nowrap' }}>+{fmt(c.valor)}</span>
              </div>
            ))}
            <div style={{ height:'0.5px', background:'rgba(0,0,0,0.08)', margin:'8px 0' }} />
          </>
        )}

        {pagarHoje.length > 0 && (
          <>
            <div style={{ fontSize:11, fontWeight:600, color:'#888', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>A pagar</div>
            {pagarHoje.slice(0,3).map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:'#A32D2D', flexShrink:0 }} />
                <span style={{ fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.contraparte ?? c.nome}</span>
                <span style={{ fontSize:12, fontWeight:600, color:'#A32D2D', whiteSpace:'nowrap' }}>−{fmt(c.valor)}</span>
              </div>
            ))}
          </>
        )}

        {contasDia.length === 0 && (
          <div style={{ fontSize:12, color:'#aaa', textAlign:'center', padding:'8px 0' }}>✅ Nenhum vencimento hoje</div>
        )}

        <div style={{ background:'#F1EFE8', borderRadius:8, padding:'8px 10px', display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
          <span style={{ fontSize:12, color:'#888' }}>Saldo líquido do dia</span>
          <span style={{ fontSize:14, fontWeight:600, color:cor(totalRec-totalPagar) }}>
            {totalRec-totalPagar>=0?'+':''}{fmt(totalRec-totalPagar)}
          </span>
        </div>
      </div>

      {/* Próximos vencimentos */}
      {fluxo.filter(f=>Number(f.entradas)>0||Number(f.saidas)>0).length > 0 && (
        <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:12, padding:'14px 16px' }}>
          <SectionTitle>📆 Próximos vencimentos</SectionTitle>
          {fluxo.filter(f=>Number(f.entradas)>0||Number(f.saidas)>0).slice(0,5).map(f => {
            const ent=Number(f.entradas), sai=Number(f.saidas), sal=Number(f.saldo_dia)
            return (
              <div key={f.dia} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:'0.5px solid rgba(0,0,0,0.05)' }}>
                <span style={{ fontSize:12, fontWeight:600, minWidth:36, color:'#555' }}>{f.dia_label}</span>
                <div style={{ flex:1, display:'flex', gap:8, fontSize:12 }}>
                  {ent>0 && <span style={{ color:'#3B6D11' }}>↑ {fmt(ent)}</span>}
                  {sai>0 && <span style={{ color:'#A32D2D' }}>↓ {fmt(sai)}</span>}
                </div>
                <span style={{ fontSize:12, fontWeight:600, color:cor(sal), whiteSpace:'nowrap' }}>
                  {sal>=0?'+':''}{fmt(sal)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Inadimplência */}
      {inadim.length > 0 && (
        <div style={{ background:'#FCEBEB', border:'0.5px solid #F5BCBC', borderRadius:12, padding:'14px 16px' }}>
          <SectionTitle>🚨 Inadimplência</SectionTitle>
          {inadim.slice(0,3).map(i => (
            <div key={i.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'0.5px solid rgba(163,45,45,0.15)' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600 }}>{i.comprador}</div>
                <div style={{ fontSize:11, color:'#A32D2D' }}>{i.dias_atraso}d atraso</div>
              </div>
              <span style={{ fontWeight:700, color:'#A32D2D', fontSize:13 }}>{fmt(i.valor_total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Alertas */}
      {alertas.length > 0 && (
        <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:12, padding:'14px 16px' }}>
          <SectionTitle>⚠️ Alertas</SectionTitle>
          {alertas.slice(0,4).map((a,i) => <AlertItem key={i} {...a} />)}
        </div>
      )}
    </div>
  )

  if (loading) return <div style={{ textAlign:'center', padding:48, color:'#888' }}>Carregando painel...</div>

  // ══════════════════════════════════════════════════════════
  // LAYOUT MOBILE
  // ══════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{ fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif', color:'#1a1a1a' }}>
        {/* Nav meses */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <button className="btn btn-sm" onClick={() => setMesOffset(o=>o-1)}>←</button>
          <div style={{ flex:1, textAlign:'center', fontWeight:600, fontSize:15, color:'#2d6a2d' }}>
            {mesLabel}
            {mesOffset===0 && <span style={{ marginLeft:8, fontSize:11, background:'#EAF3DE', color:'#2d6a2d', borderRadius:4, padding:'2px 7px' }}>Mês atual</span>}
          </div>
          <button className="btn btn-sm" onClick={() => setMesOffset(o=>Math.min(o+1,0))} disabled={mesOffset===0}>→</button>
        </div>

        {/* Alertas críticos no topo */}
        {criticos.length > 0 && (
          <div style={{ marginBottom:12 }}>
            {criticos.slice(0,2).map((a,i) => <AlertItem key={i} {...a} />)}
          </div>
        )}

        {/* KPIs */}
        <KpiStrip />

        {/* Abas */}
        <div style={{ display:'flex', gap:6, marginBottom:14, overflowX:'auto' }}>
          {['hoje','campo','alertas'].map(a => (
            <button key={a} onClick={() => setAba(a)} style={{
              fontSize:12, fontWeight:500, padding:'6px 14px', borderRadius:20, border:'0.5px solid',
              cursor:'pointer', whiteSpace:'nowrap',
              background: aba===a ? '#EAF3DE' : '#F1EFE8',
              color: aba===a ? '#2d6a2d' : '#888',
              borderColor: aba===a ? '#C0DD97' : 'transparent',
            }}>
              {a==='hoje'?'💰 Hoje':a==='campo'?'🌾 Campo':'⚠️ Alertas'}
            </button>
          ))}
        </div>

        {aba==='hoje' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <ColunaDir />
          </div>
        )}
        {aba==='campo' && <ColunaEsq />}
        {aba==='alertas' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {alertas.length===0
              ? <div style={{ textAlign:'center', padding:20, color:'#aaa', fontSize:13 }}>✅ Nenhum alerta</div>
              : alertas.map((a,i) => <AlertItem key={i} {...a} />)}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // LAYOUT DESKTOP
  // ══════════════════════════════════════════════════════════
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif', background:'#FAFAFA' }}>

      {/* SIDEBAR */}
      <Sidebar currentPage={currentPage ?? 'Dashboard'} onNavigate={onNavigate ?? (() => {})} onSair={onSair ?? (() => {})} />

      {/* MAIN */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* TOPBAR */}
        <div style={{
          height:48, background:'white', borderBottom:'0.5px solid rgba(0,0,0,0.1)',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0 20px', flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:16, fontWeight:600, color:'#2d6a2d' }}>Dashboard</span>
            {/* Navegação meses */}
            <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:16 }}>
              <button onClick={() => setMesOffset(o=>o-1)} style={{ background:'none', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:12 }}>←</button>
              <span style={{ fontSize:13, fontWeight:500, color:'#555', minWidth:120, textAlign:'center' }}>{mesLabel}</span>
              <button onClick={() => setMesOffset(o=>Math.min(o+1,0))} disabled={mesOffset===0} style={{ background:'none', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:6, padding:'3px 8px', cursor:'pointer', fontSize:12, opacity:mesOffset===0?.4:1 }}>→</button>
              {mesOffset!==0 && <button onClick={() => setMesOffset(0)} style={{ fontSize:11, background:'#EAF3DE', color:'#2d6a2d', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>Hoje</button>}
            </div>
          </div>
          {criticos.length > 0 && (
            <div style={{ background:'#FCEBEB', color:'#A32D2D', border:'0.5px solid #F5BCBC', borderRadius:6, padding:'3px 10px', fontSize:12, fontWeight:600 }}>
              🚨 {criticos.length} alerta(s) crítico(s)
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
          {/* KPI STRIP */}
          <KpiStrip />

          {/* GRID 2 COLUNAS */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:16 }}>
            <ColunaEsq />
            <ColunaDir />
          </div>
        </div>
      </div>
    </div>
  )
}

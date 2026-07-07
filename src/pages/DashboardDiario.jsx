import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── TOKENS ──────────────────────────────────────────────────
const T = {
  verde:  { bg:'#EAF3DE', text:'#3B6D11', border:'#C0DD97' },
  amber:  { bg:'#FAEEDA', text:'#854F0B', border:'#F5D5A0' },
  azul:   { bg:'#E6F1FB', text:'#185FA5', border:'#B3D4F5' },
  vermelho:{ bg:'#FCEBEB', text:'#A32D2D', border:'#F5BCBC' },
  cinza:  { bg:'#F1EFE8', text:'#5F5E5A', border:'rgba(0,0,0,0.08)' },
  roxo:   { bg:'#F3EFFE', text:'#5B21B6', border:'#DDD6FE' },
  teal:   { bg:'#E6F7F5', text:'#0F766E', border:'#99E6E0' },
  rosa:   { bg:'#FDF2F8', text:'#9D174D', border:'#F9A8D4' },
}

function Badge({ color, children }) {
  const c = T[color] ?? T.cinza
  return (
    <span style={{ fontSize:11, fontWeight:600, background:c.bg, color:c.text, border:`0.5px solid ${c.border}`, borderRadius:6, padding:'2px 8px', whiteSpace:'nowrap' }}>
      {children}
    </span>
  )
}

function Card({ children, style }) {
  return (
    <div style={{ background:'white', border:'0.5px solid rgba(0,0,0,0.12)', borderRadius:12, padding:'1rem 1.25rem', ...style }}>
      {children}
    </div>
  )
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background:'#F1EFE8', borderRadius:8, padding:'0.75rem 1rem' }}>
      <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:500, color: color ?? '#1a1a1a', lineHeight:1.2 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'#aaa', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

const SUGESTOES = [
  { icon:'📊', cor:'verde',   titulo:'Dashboard diário como tela inicial', desc:'Substitua o painel mensal por um resumo diário com tarefas, alertas e saldo do dia.', badge:'alto impacto', badgeCor:'verde' },
  { icon:'📅', cor:'amber',   titulo:'Calendário visual na Programação', desc:'Visualize adubações, irrigações e colheitas em um calendário colorido de 30 dias.', badge:'médio esforço', badgeCor:'amber' },
  { icon:'📈', cor:'azul',    titulo:'Gráfico de evolução por lote', desc:'Identifique lotes em declínio antes que virem prejuízo com gráficos históricos.', badge:'novo módulo', badgeCor:'azul' },
  { icon:'🚨', cor:'rosa',    titulo:'Sistema de alertas e notificações', desc:'Pagamento vencendo, custo acima do orçamento, lote pronto para colheita — automático.', badge:'alto impacto', badgeCor:'verde' },
  { icon:'💰', cor:'roxo',    titulo:'Fluxo de caixa projetado', desc:'Transforme listas de contas em linha do tempo de 7/15/30 dias com saldo acumulado.', badge:'médio esforço', badgeCor:'amber' },
  { icon:'📦', cor:'teal',    titulo:'Rastreabilidade Estoque → Lote', desc:'Conecte insumos e atividades para calcular custo real de cada talhão.', badge:'novo módulo', badgeCor:'azul' },
]

function fmt(v) {
  if (!v && v !== 0) return '—'
  return Number(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })
}

export default function DashboardDiario() {
  const [aba, setAba]         = useState('hoje')
  const [kpis, setKpis]       = useState(null)
  const [contasDia, setContas] = useState([])
  const [agenda, setAgenda]   = useState([])
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load(); const _t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(_t) }, [aba])

  async function load() {
    setLoading(true)
    try {
    const hoje = new Date()
    let mesStr
    if (aba === 'semana') { const d=new Date(); d.setDate(d.getDate()-3); mesStr=d.toISOString().split('T')[0] }
    else if (aba === 'mes') { const d=new Date(); d.setDate(1); mesStr=d.toISOString().split('T')[0] }
    else mesStr = hoje.toISOString().split('T')[0]

    const [{ data: dash }, { data: contas }, { data: ag }, { data: al }] = await Promise.all([
      supabase.rpc('fn_dashboard_mes', { p_mes: mesStr }),
      supabase.from('vw_contas_do_dia').select('*'),
      supabase.from('vw_agenda_campo').select('*').limit(5),
      supabase.from('vw_alertas_sistema').select('*').limit(10),
    ])

    setKpis(Array.isArray(dash) ? dash[0] : dash)
    setContas(contas ?? [])
    setAgenda(ag ?? [])
    setAlertas(al ?? [])
    } catch {} finally {
      setLoading(false)
    }
  }

  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })
  const pagarHoje   = contasDia.filter(c => c.tipo === 'pagar')
  const receberHoje = contasDia.filter(c => c.tipo === 'receber')
  const totalReceber = receberHoje.reduce((s,c) => s+Number(c.valor??0), 0)
  const totalPagar   = pagarHoje.reduce((s,c) => s+Number(c.valor??0), 0)
  const saldoDia     = totalReceber - totalPagar
  const criticos     = alertas.filter(a => a.nivel === 'critico')

  const urgCor = { atrasado:'vermelho', urgente:'amber', proximo:'verde', hoje:'amber', ok:'verde' }
  const urgLabel = { atrasado:'atrasado', urgente:'urgente', proximo:'em breve', hoje:'hoje', ok:'ok' }

  return (
    <div style={{ fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif', color:'#1a1a1a', paddingBottom:'1rem' }}>

      {/* CABEÇALHO */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:500, color:'#1a1a1a' }}>🍌 AgroGestão</div>
          <div style={{ fontSize:12, color:'#888', marginTop:2 }}>Jaíba · {dataHoje}</div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:4 }}>
          {criticos.length > 0 && (
            <Badge color="azul">🔔 {criticos.length} alerta{criticos.length>1?'s':''}</Badge>
          )}
        </div>
      </div>

      {/* ABAS */}
      <div style={{ display:'flex', gap:6, marginBottom:16 }}>
        {['hoje','semana','mes'].map(a => (
          <button key={a} onClick={() => setAba(a)} style={{
            fontSize:13, fontWeight:500, padding:'6px 16px', borderRadius:20, border:'0.5px solid',
            cursor:'pointer',
            background: aba===a ? T.verde.bg : '#F1EFE8',
            color: aba===a ? T.verde.text : '#888',
            borderColor: aba===a ? T.verde.border : 'transparent',
          }}>
            {a==='hoje'?'Hoje':a==='semana'?'Semana':'Mês'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:32, color:'#888' }}>Carregando...</div>
      ) : (
        <>
          {/* GRID MÉTRICAS */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:16 }}>
            <MetricCard
              label="A receber" sub={receberHoje.length > 0 ? `${receberHoje.length} lançamento(s)` : 'Nenhum hoje'}
              value={totalReceber > 0 ? fmt(totalReceber) : '—'}
              color={totalReceber > 0 ? '#3B6D11' : '#aaa'}
            />
            <MetricCard
              label="A pagar" sub={pagarHoje.length > 0 ? `${pagarHoje.length} lançamento(s)` : 'Nenhum hoje'}
              value={totalPagar > 0 ? fmt(totalPagar) : '—'}
              color={totalPagar > 0 ? '#A32D2D' : '#aaa'}
            />
            <MetricCard
              label="Tarefas do campo" sub="programadas"
              value={agenda.length || '—'}
            />
            <MetricCard
              label="Receita do período" sub={`Margem: ${Number(kpis?.receita_mes)>0?((Number(kpis?.lucro_mes)/Number(kpis?.receita_mes))*100).toFixed(0)+'%':'—'}`}
              value={Number(kpis?.receita_mes)>0 ? fmt(kpis?.receita_mes) : '—'}
            />
          </div>

          {/* SEÇÃO CENTRAL */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>

            {/* PROGRAMAÇÃO DO CAMPO */}
            <Card>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                <span style={{ fontSize:16 }}>🔧</span>
                <span style={{ fontSize:14, fontWeight:600 }}>Campo</span>
              </div>

              {agenda.length === 0 ? (
                <div style={{ fontSize:12, color:'#aaa', textAlign:'center', padding:'12px 0' }}>
                  Nenhuma atividade nos próximos dias
                </div>
              ) : (
                <div>
                  {agenda.slice(0,4).map((a, i) => (
                    <div key={a.id}>
                      {i > 0 && <div style={{ height:'0.5px', background:'rgba(0,0,0,0.08)', margin:'8px 0' }} />}
                      <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                        <div style={{ width:32, height:32, borderRadius:8, background:T[urgCor[a.urgencia]??'cinza'].bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                          {a.cultura_icone ?? '📝'}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.tipo_atividade}</div>
                          <div style={{ fontSize:11, color:'#888', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.lote}{a.setor?` · ${a.setor}`:''}</div>
                        </div>
                        <Badge color={urgCor[a.urgencia] ?? 'cinza'}>{urgLabel[a.urgencia] ?? a.urgencia}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button style={{ width:'100%', marginTop:12, padding:'8px', fontSize:12, color:'#555', background:'transparent', border:'0.5px solid rgba(0,0,0,0.2)', borderRadius:8, cursor:'pointer', textAlign:'center' }}>
                Ver toda a programação →
              </button>
            </Card>

            {/* FINANCEIRO DO DIA */}
            <Card>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                <span style={{ fontSize:16 }}>💰</span>
                <span style={{ fontSize:14, fontWeight:600 }}>Financeiro</span>
              </div>

              {receberHoje.length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>A receber</div>
                  {receberHoje.slice(0,2).map(c => (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:'#3B6D11', flexShrink:0 }} />
                      <span style={{ fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.contraparte ?? c.nome}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:'#3B6D11', whiteSpace:'nowrap' }}>+{fmt(c.valor)}</span>
                    </div>
                  ))}
                  <div style={{ height:'0.5px', background:'rgba(0,0,0,0.08)', margin:'8px 0' }} />
                </>
              )}

              {pagarHoje.length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:500, color:'#888', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:6 }}>A pagar</div>
                  {pagarHoje.slice(0,2).map(c => (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:'#A32D2D', flexShrink:0 }} />
                      <span style={{ fontSize:12, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.contraparte ?? c.nome}</span>
                      <span style={{ fontSize:12, fontWeight:600, color:'#A32D2D', whiteSpace:'nowrap' }}>−{fmt(c.valor)}</span>
                    </div>
                  ))}
                  <div style={{ height:'0.5px', background:'rgba(0,0,0,0.08)', margin:'8px 0' }} />
                </>
              )}

              {contasDia.length === 0 && (
                <div style={{ fontSize:12, color:'#aaa', textAlign:'center', padding:'8px 0' }}>Nenhum vencimento hoje</div>
              )}

              {/* Saldo do dia */}
              <div style={{ background:'#F1EFE8', borderRadius:8, padding:'8px 10px', display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                <span style={{ fontSize:12, color:'#888' }}>Saldo líquido do dia</span>
                <span style={{ fontSize:15, fontWeight:500, color: saldoDia >= 0 ? '#3B6D11' : '#A32D2D' }}>
                  {saldoDia >= 0 ? '+' : ''}{fmt(saldoDia)}
                </span>
              </div>

              <button style={{ width:'100%', marginTop:10, padding:'8px', fontSize:12, color:'#555', background:'transparent', border:'0.5px solid rgba(0,0,0,0.2)', borderRadius:8, cursor:'pointer', textAlign:'center' }}>
                Ver fluxo de caixa →
              </button>
            </Card>
          </div>

          {/* ALERTAS */}
          {alertas.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ height:'0.5px', background:'rgba(0,0,0,0.1)', marginBottom:12 }} />
              <div style={{ fontSize:14, fontWeight:500, marginBottom:10 }}>⚠️ Alertas do sistema</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {alertas.slice(0,3).map((a, i) => {
                  const c = a.nivel==='critico' ? T.vermelho : T.amber
                  return (
                    <div key={i} style={{ background:c.bg, border:`0.5px solid ${c.border}`, borderRadius:10, padding:'10px 12px', display:'flex', gap:8, alignItems:'center' }}>
                      <span>{a.nivel==='critico'?'🚨':'⚠️'}</span>
                      <span style={{ fontSize:13, color:c.text, flex:1 }}>{a.mensagem}</span>
                      {Number(a.valor)>0 && <span style={{ fontSize:12, fontWeight:600, color:c.text, whiteSpace:'nowrap' }}>{fmt(a.valor)}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* SUGESTÕES */}
          <div>
            <div style={{ height:'0.5px', background:'rgba(0,0,0,0.1)', marginBottom:12 }} />
            <div style={{ fontSize:15, fontWeight:500, marginBottom:12 }}>💡 Sugestões de melhoria</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {SUGESTOES.map((s, i) => (
                <div key={i} style={{ border:'0.5px solid rgba(0,0,0,0.1)', borderRadius:12, padding:'1rem 1.25rem', display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ width:36, height:36, borderRadius:8, background:T[s.cor]?.bg ?? '#F1EFE8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>
                    {s.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:500, marginBottom:3 }}>{s.titulo}</div>
                    <div style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>{s.desc}</div>
                  </div>
                  <div style={{ flexShrink:0 }}>
                    <Badge color={s.badgeCor}>{s.badge}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <button style={{ width:'100%', marginTop:14, padding:'12px', fontSize:13, fontWeight:500, color:'#333', background:'transparent', border:'0.5px solid rgba(0,0,0,0.2)', borderRadius:10, cursor:'pointer' }}>
              Quero saber qual melhoria implementar primeiro →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

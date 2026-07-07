import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDate, today } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

const TIPOS = ['Adubação','Irrigação','Pulverização','Capina','Poda','Colheita','Outro']
const EMPTY = { lote_id:'', setor_id:'', tipo_atividade:'Adubação', insumo_id:'', frequencia_dias:'30', data_inicio:today(), proxima_execucao:today(), ativo:true, observacoes:'' }

export default function Programacao({ onAddBtn }) {
  const { tenantId } = useAuth()
  const [lotes, setLotes]     = useState([])
  const [setores, setSetores] = useState([])
  const [insumos, setInsumos] = useState([])
  const [programas, setProgr] = useState([])
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [editId, setEditId]   = useState(null)
  const [saving, setSaving]   = useState(false)
  const [viewMode, setViewMode] = useState('calendario') // calendario | lista
  const lotesRef = React.useRef([])

  useEffect(() => { load(); const _t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(_t) }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])

  async function load() {
    setLoading(true)
    try {
    const [{ data: ls }, { data: sts }, { data: ins }, { data: prg }, { data: ale }] = await Promise.all([
      supabase.from('lotes').select('id,nome').neq('status','inativo').order('nome'),
      supabase.from('setores').select('*').order('nome'),
      supabase.from('insumos').select('id,nome').order('nome'),
      supabase.from('programacao_atividades').select('*,lotes(nome),setores(nome),insumos(nome)').order('proxima_execucao',{ascending:true}),
      supabase.from('vw_alertas_operacionais').select('*').neq('urgencia','ok').limit(10),
    ])
    lotesRef.current = ls??[]
    setLotes(ls??[]); setSetores(sts??[]); setInsumos(ins??[])
    setProgr(prg??[]); setAlertas(ale??[])
    } catch {} finally {
      setLoading(false)
    }
  }

  function setoresDoLote(loteId) { return setores.filter(s=>s.lote_id===loteId) }

  function openModal(p=null) {
    if (p) {
      setForm({ lote_id:p.lote_id, setor_id:p.setor_id??'', tipo_atividade:p.tipo_atividade, insumo_id:p.insumo_id??'', frequencia_dias:p.frequencia_dias, data_inicio:p.data_inicio?.split('T')[0]??today(), proxima_execucao:p.proxima_execucao?.split('T')[0]??today(), ativo:p.ativo, observacoes:p.observacoes??'' })
      setEditId(p.id)
    } else {
      setForm({ ...EMPTY, lote_id:lotesRef.current[0]?.id??'' })
      setEditId(null)
    }
    setModal(true)
  }
  function closeModal() { setModal(false); setEditId(null) }

  async function save() {
    if (!form.lote_id || !form.tipo_atividade) return alert('Selecione lote e tipo de atividade.')
    setSaving(true)
    const payload = { lote_id:form.lote_id, setor_id:form.setor_id||null, tipo_atividade:form.tipo_atividade, insumo_id:form.insumo_id||null, frequencia_dias:parseInt(form.frequencia_dias), data_inicio:form.data_inicio, proxima_execucao:form.proxima_execucao, ativo:form.ativo, observacoes:form.observacoes||null }
    if (editId) await supabase.from('programacao_atividades').update(payload).eq('id',editId)
    else await supabase.from('programacao_atividades').insert({ ...payload, tenant_id: tenantId })
    setSaving(false); closeModal(); load()
  }

  async function toggleAtivo(id, ativo) {
    await supabase.from('programacao_atividades').update({ativo:!ativo}).eq('id',id); load()
  }
  async function excluir(id) {
    if (!window.confirm('Excluir esta programação?')) return
    await supabase.from('programacao_atividades').delete().eq('id',id); load()
  }

  const urgCor = { atrasado:'var(--red)', urgente:'var(--amber)', proximo:'var(--amber-mid)', ok:'var(--green)' }
  const urgLabel = { atrasado:'🔴 Atrasado', urgente:'⚠ Urgente', proximo:'🟡 Próximo', ok:'✓ OK' }
  const tipoIcon = { Adubação:'🌱', Irrigação:'💧', Pulverização:'🧪', Capina:'✂️', Poda:'🪚', Colheita:'🍌', Outro:'📝' }

  if (loading) return <div className="loading">Carregando programação...</div>

  // Calendário: monta grade de 30 dias
  const hoje = new Date()
  const diasCalendario = Array.from({length:35}, (_,i) => {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() - hoje.getDay() + i)
    return d
  })
  const atividadesPorDia = {}
  programas.forEach(p => {
    if (!p.proxima_execucao || !p.ativo) return
    const k = p.proxima_execucao.split('T')[0]
    if (!atividadesPorDia[k]) atividadesPorDia[k] = []
    atividadesPorDia[k].push(p)
  })
  const corTipo = {
    'Adubação':'var(--green)', 'Irrigação':'var(--teal)', 'Pulverização':'var(--amber)',
    'Colheita':'var(--red)', 'Capina':'#8b5cf6', 'Poda':'#ec4899',
  }

  return (
    <>
      {/* Botões de visualização */}
      <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginBottom:12}}>
        <button className="btn btn-sm" style={{background:viewMode==='calendario'?'var(--green)':'',color:viewMode==='calendario'?'white':''}} onClick={()=>setViewMode('calendario')}>📅 Calendário</button>
        <button className="btn btn-sm" style={{background:viewMode==='lista'?'var(--green)':'',color:viewMode==='lista'?'white':''}} onClick={()=>setViewMode('lista')}>☰ Lista</button>
      </div>

      {alertas.length > 0 && (
        <div style={{marginBottom:14}}>
          {alertas.map(a=>(
            <div key={a.id} className={`alerta-card ${a.urgencia==='atrasado'?'urgente':'aviso'}`} style={{marginBottom:8}}>
              <div className="alerta-icon">{a.urgencia==='atrasado'?'🚨':'⚠️'}</div>
              <div className="alerta-body">
                <div className="alerta-title">
                  {tipoIcon[a.tipo_atividade]??'📝'} {a.tipo_atividade} — {a.lote}{a.setor?` / ${a.setor}`:''}
                </div>
                <div className="alerta-desc">
                  {a.urgencia==='atrasado'
                    ? `Atrasado ${a.dias_atraso} dia(s) — era para ${fmtDate(a.proxima_execucao)}`
                    : `Próxima execução: ${fmtDate(a.proxima_execucao)}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CALENDÁRIO */}
      {viewMode==='calendario' && (
        <div className="card">
          {/* Header dias semana */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
            {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=>(
              <div key={d} style={{textAlign:'center',fontSize:11,fontWeight:700,color:'var(--text-muted)',padding:'4px 0'}}>{d}</div>
            ))}
          </div>
          {/* Grade */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
            {diasCalendario.map((dia,i) => {
              const key = dia.toISOString().split('T')[0]
              const ativs = atividadesPorDia[key] ?? []
              const isHoje = key === hoje.toISOString().split('T')[0]
              const isMesAtual = dia.getMonth() === hoje.getMonth()
              return (
                <div key={i} style={{
                  minHeight:64, background:isHoje?'var(--green-light)':isMesAtual?'var(--surface)':'var(--bg)',
                  border:`1px solid ${isHoje?'var(--green)':'var(--border)'}`,
                  borderRadius:6, padding:'4px 6px', opacity:isMesAtual?1:.5
                }}>
                  <div style={{fontSize:11,fontWeight:isHoje?700:400,color:isHoje?'var(--green)':'var(--text-muted)',marginBottom:3}}>
                    {dia.getDate()}{isHoje&&' •'}
                  </div>
                  {ativs.slice(0,3).map((a,j) => (
                    <div key={j} title={`${a.tipo_atividade} — ${a.lotes?.nome}`} style={{
                      fontSize:9, fontWeight:600, color:'white', borderRadius:3,
                      background:corTipo[a.tipo_atividade]??'var(--teal)',
                      padding:'1px 4px', marginBottom:2, overflow:'hidden',
                      textOverflow:'ellipsis', whiteSpace:'nowrap'
                    }}>
                      {tipoIcon[a.tipo_atividade]??'📝'} {a.tipo_atividade}
                    </div>
                  ))}
                  {ativs.length > 3 && <div style={{fontSize:9,color:'var(--text-muted)'}}>+{ativs.length-3}</div>}
                </div>
              )
            })}
          </div>
          {/* Legenda */}
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12,paddingTop:10,borderTop:'1px solid var(--border)'}}>
            {Object.entries(corTipo).map(([tipo,cor])=>(
              <span key={tipo} style={{fontSize:11,display:'flex',alignItems:'center',gap:4}}>
                <span style={{width:10,height:10,background:cor,borderRadius:2,display:'inline-block'}}/>
                {tipo}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* LISTA */}
      {viewMode==='lista' && (
        <>
          {programas.length === 0
            ? <div className="empty">Nenhuma programação cadastrada.<br/>Clique em "+ Nova programação".</div>
            : <div className="card">
                <div className="table-wrap">
                  <table>
                <thead><tr><th>Lote</th><th>Setor</th><th>Atividade</th><th>Insumo</th><th>Frequência</th><th>Próxima execução</th><th>Status</th><th>Ativo</th><th></th></tr></thead>
                <tbody>
                  {programas.map(p=>{
                    const dias = Math.floor((new Date()-new Date(p.proxima_execucao))/86400000)
                    const urg = dias>0?'atrasado':dias>-4?'urgente':dias>-10?'proximo':'ok'
                    return (
                      <tr key={p.id} style={!p.ativo?{opacity:.5}:{}}>
                        <td><strong>{p.lotes?.nome}</strong></td>
                        <td style={{color:'var(--text-muted)'}}>{p.setores?.nome??'—'}</td>
                        <td>{tipoIcon[p.tipo_atividade]??'📝'} {p.tipo_atividade}</td>
                        <td style={{color:'var(--text-muted)'}}>{p.insumos?.nome??'—'}</td>
                        <td>A cada {p.frequencia_dias}d</td>
                        <td>
                          <span style={{fontWeight:600,color:urgCor[urg]}}>{fmtDate(p.proxima_execucao)}</span>
                        </td>
                        <td><span className="badge" style={{background:urg==='ok'?'var(--green-light)':urg==='atrasado'?'var(--red-light)':'var(--amber-light)',color:urgCor[urg]}}>{urgLabel[urg]}</span></td>
                        <td>
                          <button className={`btn btn-sm ${p.ativo?'btn-primary':''}`} onClick={()=>toggleAtivo(p.id,p.ativo)}>
                            {p.ativo?'Ativo':'Inativo'}
                          </button>
                        </td>
                        <td><div style={{display:'flex',gap:4}}>
                          <button className="btn btn-sm" onClick={()=>openModal(p)}>✎</button>
                          <button className="btn btn-sm btn-danger" onClick={()=>excluir(p.id)}>✕</button>
                        </div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>}
        </>
      )}

      <button className="fab" onClick={()=>openModal()}>+</button>

      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editId?'Editar programação':'Nova programação'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Lote *</label>
                <select value={form.lote_id} onChange={e=>setForm(f=>({...f,lote_id:e.target.value,setor_id:''}))}>
                  <option value="">— Selecione —</option>
                  {lotes.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Setor</label>
                <select value={form.setor_id} onChange={e=>setForm(f=>({...f,setor_id:e.target.value}))}>
                  <option value="">— Todo o lote —</option>
                  {setoresDoLote(form.lote_id).map(s=><option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de atividade *</label>
                <select value={form.tipo_atividade} onChange={e=>setForm(f=>({...f,tipo_atividade:e.target.value}))}>
                  {TIPOS.map(t=><option key={t} value={t}>{tipoIcon[t]} {t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Insumo (opcional)</label>
                <select value={form.insumo_id} onChange={e=>setForm(f=>({...f,insumo_id:e.target.value}))}>
                  <option value="">— Sem insumo —</option>
                  {insumos.map(i=><option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Frequência (dias) *</label>
                <input type="number" inputMode="numeric" value={form.frequencia_dias} onChange={e=>setForm(f=>({...f,frequencia_dias:e.target.value}))} placeholder="30" />
                <span className="form-hint">Ex: 30 = mensal, 7 = semanal</span>
              </div>
              <div className="form-group">
                <label>Data de início</label>
                <input type="date" value={form.data_inicio} onChange={e=>setForm(f=>({...f,data_inicio:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>Próxima execução</label>
                <input type="date" value={form.proxima_execucao} onChange={e=>setForm(f=>({...f,proxima_execucao:e.target.value}))} />
              </div>
              <div className="form-group" style={{display:'flex',alignItems:'center',gap:10,paddingTop:20}}>
                <input type="checkbox" id="ativo" checked={form.ativo} onChange={e=>setForm(f=>({...f,ativo:e.target.checked}))} style={{width:18,height:18}} />
                <label htmlFor="ativo" style={{cursor:'pointer',marginBottom:0}}>Programação ativa</label>
              </div>
              <div className="form-group form-full">
                <label>Observações</label>
                <textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Detalhes da programação..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{flex:1}}>
                {saving?'Salvando...':editId?'✓ Salvar':'✓ Criar programação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

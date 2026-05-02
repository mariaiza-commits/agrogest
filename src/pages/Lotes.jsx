import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, statusLoteBadge } from '../lib/utils'

const VARIEDADES = ['Prata Anã','Nanica','Prata','Cavendish','Terra','Outra']
const ESTAGIOS   = [{ value:'jovem', label:'🌱 Jovem' },{ value:'producao', label:'🍌 Produção' },{ value:'final', label:'🍂 Final' }]
const EMPTY_LOTE = { nome:'', area_ha:'', status:'ativo', observacoes:'' }
const EMPTY_SETOR = (n) => ({ nome:`Setor ${n}`, cultura:'Prata Anã', estagio:'producao', area_hectares:'', data_plantio:'' })

export default function Lotes({ onAddBtn }) {
  const [lotes, setLotes]         = useState([])
  const [resumo, setResumo]       = useState({})
  const [setores, setSetores]     = useState({})
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [modalDetalhe, setModalDetalhe] = useState(null)
  const [form, setForm]           = useState(EMPTY_LOTE)
  const [formSetores, setFormSetores] = useState([EMPTY_SETOR(1)])
  const [saving, setSaving]       = useState(false)
  const [editId, setEditId]       = useState(null)
  const [viewMode, setViewMode]   = useState('tabela') // tabela | cards
  const [busca, setBusca]         = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroCultura, setFiltroCultura] = useState('')
  const [ordenar, setOrdenar]     = useState('lucro')

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])

  async function load() {
    setLoading(true)
    const [{ data: ls }, { data: rs }, { data: sts }] = await Promise.all([
      supabase.from('lotes').select('*').order('nome'),
      supabase.from('vw_resumo_por_lote').select('*'),
      supabase.from('setores').select('*').order('nome'),
    ])
    setLotes(ls??[])
    const m = {}; (rs??[]).forEach(r => { m[r.lote_id] = r }); setResumo(m)
    const s = {}; (sts??[]).forEach(st => { if (!s[st.lote_id]) s[st.lote_id]=[]; s[st.lote_id].push(st) }); setSetores(s)
    setLoading(false)
  }

  // Culturas únicas para filtro
  const culturasDisponiveis = useMemo(() => {
    const todas = Object.values(setores).flat().map(s => s.cultura).filter(Boolean)
    return [...new Set(todas)].sort()
  }, [setores])

  // Lotes filtrados e ordenados
  const lotesFiltrados = useMemo(() => {
    let lista = lotes.map(l => ({ ...l, r: resumo[l.id] ?? {}, sts: setores[l.id] ?? [] }))
    if (busca) lista = lista.filter(l => l.nome.toLowerCase().includes(busca.toLowerCase()))
    if (filtroStatus) lista = lista.filter(l => l.status === filtroStatus)
    if (filtroCultura) lista = lista.filter(l => l.sts.some(s => s.cultura === filtroCultura))
    lista.sort((a, b) => {
      if (ordenar === 'lucro') return Number(b.r.lucro_bruto??0) - Number(a.r.lucro_bruto??0)
      if (ordenar === 'area') return Number(b.area_ha??0) - Number(a.area_ha??0)
      if (ordenar === 'margem') return Number(b.r.margem_pct??0) - Number(a.r.margem_pct??0)
      if (ordenar === 'nome') return a.nome.localeCompare(b.nome)
      return 0
    })
    return lista
  }, [lotes, resumo, setores, busca, filtroStatus, filtroCultura, ordenar])

  function handleQtdSetores(qtd) {
    const n = parseInt(qtd) || 0
    setFormSetores(prev => {
      if (n > prev.length) { const novos=[...prev]; for(let i=prev.length+1;i<=n;i++) novos.push(EMPTY_SETOR(i)); return novos }
      return prev.slice(0, Math.max(n, 1))
    })
  }

  function updateSetor(idx, field, value) {
    setFormSetores(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  async function openModal(lote = null) {
    if (lote) {
      setForm({ nome:lote.nome, area_ha:lote.area_ha??'', status:lote.status, observacoes:lote.observacoes??'' })
      setEditId(lote.id)
      const { data: sts } = await supabase.from('setores').select('*').eq('lote_id', lote.id).order('nome')
      if (sts?.length) setFormSetores(sts.map(s => ({ id:s.id, nome:s.nome, cultura:s.cultura??'Prata Anã', estagio:s.estagio??'producao', area_hectares:s.area_hectares??'', data_plantio:s.data_plantio??'' })))
      else setFormSetores([EMPTY_SETOR(1)])
    } else {
      setForm(EMPTY_LOTE); setFormSetores([EMPTY_SETOR(1)]); setEditId(null)
    }
    setModal(true)
  }

  async function save() {
    if (!form.nome) return alert('Informe o nome do lote.')
    if (formSetores.some(s => !s.nome)) return alert('Informe o nome de todos os setores.')
    setSaving(true)
    const payload = { nome:form.nome, area_ha:parseFloat(form.area_ha)||null, status:form.status, observacoes:form.observacoes||null, quantidade_setores:formSetores.length }
    let loteId = editId
    if (editId) {
      await supabase.from('lotes').update(payload).eq('id', editId)
    } else {
      const { data: novoLote } = await supabase.from('lotes').insert(payload).select().single()
      loteId = novoLote.id
    }
    if (editId) {
      for (const s of formSetores) {
        if (s.id) await supabase.from('setores').update({ nome:s.nome, cultura:s.cultura, estagio:s.estagio, area_hectares:s.area_hectares||null, data_plantio:s.data_plantio||null }).eq('id', s.id)
        else await supabase.from('setores').insert({ lote_id:loteId, nome:s.nome, cultura:s.cultura, estagio:s.estagio, area_hectares:s.area_hectares||null, data_plantio:s.data_plantio||null })
      }
      const idsAtuais = formSetores.filter(s=>s.id).map(s=>s.id)
      if (idsAtuais.length) await supabase.from('setores').delete().eq('lote_id', loteId).not('id', 'in', `(${idsAtuais.join(',')})`)
    } else {
      await supabase.from('setores').insert(formSetores.map(s => ({ lote_id:loteId, nome:s.nome, cultura:s.cultura, estagio:s.estagio, area_hectares:s.area_hectares||null, data_plantio:s.data_plantio||null })))
    }
    setSaving(false); setModal(false); load()
  }

  async function excluir(id, e) {
    e?.stopPropagation()
    if (!window.confirm('Excluir este lote?')) return
    await supabase.from('lotes').delete().eq('id', id); load()
  }

  const estagioColor = { jovem:'var(--amber)', producao:'var(--green)', final:'var(--red)' }
  const estagioLabel = { jovem:'Jovem', producao:'Produção', final:'Final' }

  if (loading) return <div className="loading">Carregando lotes...</div>

  return (
    <>
      {/* Barra de controles */}
      <div className="card" style={{ marginBottom:12, padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="form-group" style={{ marginBottom:0, flex:2, minWidth:140 }}>
            <label>Buscar lote</label>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="ex: A370" />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Status</label>
            <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="em_repouso">Em repouso</option>
              <option value="colhido">Colhido</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Cultura</label>
            <select value={filtroCultura} onChange={e=>setFiltroCultura(e.target.value)}>
              <option value="">Todas</option>
              {culturasDisponiveis.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Ordenar por</label>
            <select value={ordenar} onChange={e=>setOrdenar(e.target.value)}>
              <option value="lucro">Lucro</option>
              <option value="margem">Margem</option>
              <option value="area">Área</option>
              <option value="nome">Nome</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <button className="btn btn-sm" style={{ background:viewMode==='tabela'?'var(--green)':'', color:viewMode==='tabela'?'white':'' }} onClick={()=>setViewMode('tabela')}>📋 Tabela</button>
            <button className="btn btn-sm" style={{ background:viewMode==='cards'?'var(--green)':'', color:viewMode==='cards'?'white':'' }} onClick={()=>setViewMode('cards')}>🧱 Cards</button>
          </div>
        </div>
      </div>

      {/* Totalizadores */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { label:'Lotes', val: lotesFiltrados.length, color:'var(--text)' },
          { label:'Receita total', val: fmt(lotesFiltrados.reduce((s,l)=>s+Number(l.r.receita_bruta??0),0)), color:'var(--teal)' },
          { label:'Custo total', val: fmt(lotesFiltrados.reduce((s,l)=>s+Number(l.r.custo_total??0),0)), color:'var(--amber)' },
          { label:'Lucro total', val: fmt(lotesFiltrados.reduce((s,l)=>s+Number(l.r.lucro_bruto??0),0)), color:'var(--green)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase' }}>{k.label}</div>
            <div style={{ fontSize:16, fontWeight:700, color:k.color, marginTop:2 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {lotesFiltrados.length === 0
        ? <div className="empty">Nenhum lote encontrado.</div>
        : viewMode === 'tabela'
          ? (
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Lote</th>
                      <th>Culturas</th>
                      <th>Área</th>
                      <th>Setores</th>
                      <th style={{textAlign:'right'}}>Receita</th>
                      <th style={{textAlign:'right'}}>Custo</th>
                      <th style={{textAlign:'right'}}>Lucro</th>
                      <th style={{textAlign:'right'}}>Margem</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesFiltrados.map(l => {
                      const { cls, label } = statusLoteBadge(l.status)
                      const margem = Number(l.r.margem_pct??0)
                      const lucro  = Number(l.r.lucro_bruto??0)
                      const culturas = [...new Set(l.sts.map(s=>s.cultura).filter(Boolean))].join(', ')
                      return (
                        <tr key={l.id} style={{ cursor:'pointer' }} onClick={()=>setModalDetalhe(l)}>
                          <td><strong style={{ fontSize:14 }}>{l.nome}</strong></td>
                          <td style={{ fontSize:12, color:'var(--text-muted)' }}>{culturas || '—'}</td>
                          <td style={{ fontSize:12 }}>{l.area_ha ? `${l.area_ha} ha` : '—'}</td>
                          <td style={{ textAlign:'center' }}><span className="badge badge-gray">{l.sts.length}</span></td>
                          <td style={{ textAlign:'right', color:'var(--teal)', fontWeight:600 }}>{fmt(l.r.receita_bruta)}</td>
                          <td style={{ textAlign:'right', color:'var(--amber)', fontWeight:600 }}>{fmt(l.r.custo_total)}</td>
                          <td style={{ textAlign:'right', fontWeight:700, color:lucro>=0?'var(--green)':'var(--red)' }}>{fmt(lucro)}</td>
                          <td style={{ textAlign:'right' }}>
                            <span style={{ fontWeight:700, color:margem>=40?'var(--green)':margem>0?'var(--amber)':'var(--red)' }}>{margem.toFixed(1)}%</span>
                          </td>
                          <td><span className={`badge ${cls}`}>{label}</span></td>
                          <td><div style={{ display:'flex', gap:4 }}>
                            <button className="btn btn-sm" onClick={e=>{e.stopPropagation();openModal(l)}}>✎</button>
                            <button className="btn btn-sm btn-danger" onClick={e=>excluir(l.id,e)}>✕</button>
                          </div></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
          : (
            // MODO CARDS COMPACTOS
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:10 }}>
              {lotesFiltrados.map(l => {
                const margem = Number(l.r.margem_pct??0)
                const lucro  = Number(l.r.lucro_bruto??0)
                return (
                  <div key={l.id} className="card" style={{ marginBottom:0, cursor:'pointer', padding:'12px 14px' }} onClick={()=>setModalDetalhe(l)}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                      <div style={{ fontWeight:700, fontSize:15 }}>{l.nome}</div>
                      <button className="btn btn-sm" style={{ padding:'2px 6px', fontSize:10 }} onClick={e=>{e.stopPropagation();openModal(l)}}>✎</button>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>{l.sts.length} setor(es)</div>
                    <div style={{ fontWeight:700, fontSize:18, color:lucro>=0?'var(--green)':'var(--red)', marginBottom:4 }}>{fmt(lucro)}</div>
                    <div style={{ fontWeight:600, fontSize:13, color:margem>=40?'var(--green)':margem>0?'var(--amber)':'var(--red)' }}>{margem.toFixed(1)}% margem</div>
                  </div>
                )
              })}
              <div className="card" style={{ marginBottom:0, display:'flex', alignItems:'center', justifyContent:'center', minHeight:120, cursor:'pointer', border:'1px dashed var(--border)', padding:'12px 14px' }} onClick={()=>openModal()}>
                <div style={{ textAlign:'center', color:'var(--text-muted)' }}><div style={{ fontSize:24 }}>+</div><div style={{ fontSize:12 }}>Novo lote</div></div>
              </div>
            </div>
          )}

      <button className="fab" onClick={()=>openModal()}>+</button>

      {/* MODAL DETALHE DO LOTE */}
      {modalDetalhe && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalDetalhe(null)}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div className="modal-header">
              <div>
                <h3>{modalDetalhe.nome}</h3>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>{modalDetalhe.area_ha?`${modalDetalhe.area_ha} ha · `:''}{(setores[modalDetalhe.id]??[]).length} setor(es)</div>
              </div>
              <button className="modal-close" onClick={()=>setModalDetalhe(null)}>✕</button>
            </div>

            {/* KPIs */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:16 }}>
              {[
                { label:'Receita', val:fmt(resumo[modalDetalhe.id]?.receita_bruta), color:'var(--teal)' },
                { label:'Custo', val:fmt(resumo[modalDetalhe.id]?.custo_total), color:'var(--amber)' },
                { label:'Lucro', val:fmt(resumo[modalDetalhe.id]?.lucro_bruto), color:Number(resumo[modalDetalhe.id]?.lucro_bruto??0)>=0?'var(--green)':'var(--red)' },
                { label:'Margem', val:`${Number(resumo[modalDetalhe.id]?.margem_pct??0).toFixed(1)}%`, color:Number(resumo[modalDetalhe.id]?.margem_pct??0)>=40?'var(--green)':'var(--amber)' },
              ].map(k=>(
                <div key={k.label} style={{ background:'var(--bg)', borderRadius:'var(--radius-sm)', padding:'8px 10px', textAlign:'center' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>{k.label}</div>
                  <div style={{ fontSize:14, fontWeight:700, color:k.color, marginTop:2 }}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Setores */}
            <div style={{ fontWeight:600, fontSize:13, marginBottom:8 }}>🌿 Setores</div>
            {(setores[modalDetalhe.id]??[]).length === 0
              ? <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:16 }}>Nenhum setor cadastrado.</div>
              : <div className="table-wrap" style={{ marginBottom:16 }}>
                  <table>
                    <thead><tr><th>Setor</th><th>Cultura</th><th>Estágio</th><th>Área</th><th>Plantio</th></tr></thead>
                    <tbody>
                      {(setores[modalDetalhe.id]??[]).map(s=>(
                        <tr key={s.id}>
                          <td><strong>{s.nome}</strong></td>
                          <td>{s.cultura??'—'}</td>
                          <td><span style={{ fontSize:11, fontWeight:600, color:estagioColor[s.estagio] }}>{estagioLabel[s.estagio]??'—'}</span></td>
                          <td style={{ fontSize:12 }}>{s.area_hectares?`${s.area_hectares} ha`:'—'}</td>
                          <td style={{ fontSize:12 }}>{s.data_plantio?fmtDate(s.data_plantio):'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}

            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" style={{ flex:1 }} onClick={()=>{setModalDetalhe(null);openModal(modalDetalhe)}}>✎ Editar lote</button>
              <button className="btn btn-danger" onClick={e=>{excluir(modalDetalhe.id);setModalDetalhe(null)}}>✕ Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR/EDITAR */}
      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div className="modal-header">
              <h3>{editId ? 'Editar lote' : 'Novo lote'}</h3>
              <button className="modal-close" onClick={()=>setModal(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Nome do lote *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="ex: A370" />
              </div>
              <div className="form-group"><label>Área total (ha)</label>
                <input type="number" step="0.1" value={form.area_ha} onChange={e=>setForm(f=>({...f,area_ha:e.target.value}))} placeholder="ex: 2.5" />
              </div>
              <div className="form-group"><label>Status</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="ativo">Ativo</option>
                  <option value="em_repouso">Em repouso</option>
                  <option value="colhido">Colhido</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div className="form-group"><label>Nº de setores</label>
                <input type="number" min="1" max="20" value={formSetores.length} onChange={e=>handleQtdSetores(e.target.value)} />
              </div>
              <div className="form-group form-full"><label>Observações</label>
                <textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Características, irrigação, etc." />
              </div>
            </div>

            <div style={{ fontWeight:600, fontSize:13, marginBottom:10, borderTop:'1px solid var(--border)', paddingTop:14 }}>🌿 Setores ({formSetores.length})</div>
            {formSetores.map((s, idx) => (
              <div key={idx} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:12, marginBottom:10 }}>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:100 }}><label>Nome</label>
                    <input value={s.nome} onChange={e=>updateSetor(idx,'nome',e.target.value)} placeholder={`Setor ${idx+1}`} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0, flex:2, minWidth:120 }}><label>Cultura</label>
                    <select value={VARIEDADES.includes(s.cultura) ? s.cultura : 'Outra'} onChange={e=>{
                      if (e.target.value !== 'Outra') updateSetor(idx,'cultura',e.target.value)
                      else updateSetor(idx,'cultura','')
                    }}>
                      {VARIEDADES.map(v=><option key={v}>{v}</option>)}
                    </select>
                    {!VARIEDADES.slice(0,-1).includes(s.cultura) && (
                      <input style={{marginTop:4}} value={s.cultura} onChange={e=>updateSetor(idx,'cultura',e.target.value)} placeholder="Digite a cultura" />
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom:0, flex:2, minWidth:120 }}><label>Estágio</label>
                    <select value={s.estagio} onChange={e=>updateSetor(idx,'estagio',e.target.value)}>
                      {ESTAGIOS.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:80 }}><label>Área (ha)</label>
                    <input type="number" step="0.01" value={s.area_hectares} onChange={e=>updateSetor(idx,'area_hectares',e.target.value)} placeholder="0.5" />
                  </div>
                  <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:110 }}><label>Data plantio</label>
                    <input type="date" value={s.data_plantio} onChange={e=>updateSetor(idx,'data_plantio',e.target.value)} />
                  </div>
                </div>
              </div>
            ))}

            <div className="modal-footer">
              <button className="btn" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex:1 }}>{saving?'Salvando...':editId?'✓ Salvar':'✓ Criar lote'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

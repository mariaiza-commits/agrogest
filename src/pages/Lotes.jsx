import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, statusLoteBadge, today } from '../lib/utils'

const EMPTY = { nome:'', area_hectares:'', variedade:'Prata Anã', data_plantio:today(), status:'ativo', quantidade_setores:1, localizacao:'', observacoes:'' }

export default function Lotes({ onAddBtn }) {
  const [lotes, setLotes]     = useState([])
  const [resumo, setResumo]   = useState({})
  const [setores, setSetores] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [editId, setEditId]   = useState(null)

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])

  async function load() {
    setLoading(true)
    const [{ data: ls }, { data: rs }, { data: sts }] = await Promise.all([
      supabase.from('lotes').select('*').order('criado_em', { ascending: true }),
      supabase.from('vw_resumo_por_lote').select('*'),
      supabase.from('setores').select('*').order('nome'),
    ])
    setLotes(ls ?? [])
    const m = {}; (rs ?? []).forEach(r => { m[r.lote_id] = r }); setResumo(m)
    const s = {}; (sts ?? []).forEach(st => { if (!s[st.lote_id]) s[st.lote_id] = []; s[st.lote_id].push(st) }); setSetores(s)
    setLoading(false)
  }

  function openModal(lote = null) {
    if (lote) {
      setForm({ nome:lote.nome, area_hectares:lote.area_hectares, variedade:lote.variedade, data_plantio:lote.data_plantio?.split('T')[0]??'', status:lote.status, quantidade_setores:lote.quantidade_setores??1, localizacao:lote.localizacao??'', observacoes:lote.observacoes??'' })
      setEditId(lote.id)
    } else {
      setForm(EMPTY); setEditId(null)
    }
    setModal(true)
  }
  function closeModal() { setModal(false); setForm(EMPTY); setEditId(null) }

  async function save() {
    if (!form.nome || !form.area_hectares) return alert('Preencha nome e área.')
    setSaving(true)
    const payload = { ...form, area_hectares: parseFloat(form.area_hectares), quantidade_setores: parseInt(form.quantidade_setores) || 1 }
    if (editId) await supabase.from('lotes').update(payload).eq('id', editId)
    else await supabase.from('lotes').insert(payload)
    setSaving(false); closeModal(); load()
  }

  if (loading) return <div className="loading">Carregando lotes...</div>

  return (
    <>
      <div className="lote-grid">
        {lotes.map(l => {
          const r = resumo[l.id] ?? {}
          const { cls, label } = statusLoteBadge(l.status)
          const margem = Number(r.margem_pct ?? 0)
          const setsDoLote = setores[l.id] ?? []
          return (
            <div className="lote-card" key={l.id} onClick={() => openModal(l)}>
              <div className="lote-card-header">
                <div>
                  <div className="lote-name">{l.nome}</div>
                  <div className="lote-variety">{l.variedade}</div>
                </div>
                <span className={`badge ${cls}`}>{label}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                {l.area_hectares} ha · {setsDoLote.length} setor{setsDoLote.length !== 1 ? 'es' : ''}
              </div>
              {setsDoLote.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {setsDoLote.map(s => (
                    <span key={s.id} className="badge badge-gray" style={{ fontSize: 10 }}>{s.nome}</span>
                  ))}
                </div>
              )}
              <div className="lote-stats">
                <div className="lote-stat-box"><div className="lote-stat-label">Receita</div><div className="lote-stat-val">{fmt(r.receita_bruta)}</div></div>
                <div className="lote-stat-box"><div className="lote-stat-label">Custo</div><div className="lote-stat-val">{fmt(r.custo_total)}</div></div>
                <div className="lote-stat-box"><div className="lote-stat-label">Lucro</div><div className={`lote-stat-val ${Number(r.lucro_bruto)>=0?'pos':'neg'}`}>{fmt(r.lucro_bruto)}</div></div>
                <div className="lote-stat-box"><div className="lote-stat-label">Margem</div><div className={`lote-stat-val ${margem>=40?'pos':'neg'}`}>{margem.toFixed(1)}%</div></div>
              </div>
              <div className="profit-bar"><div className="profit-bar-fill" style={{ width: `${Math.min(margem,100)}%` }} /></div>
            </div>
          )
        })}
        <div className="lote-card" style={{ border:'1px dashed var(--border)',display:'flex',alignItems:'center',justifyContent:'center',minHeight:180,cursor:'pointer' }} onClick={() => openModal()}>
          <div style={{ textAlign:'center',color:'var(--text-muted)' }}><div style={{ fontSize:28,marginBottom:6 }}>+</div><div style={{ fontSize:13 }}>Novo lote</div></div>
        </div>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editId ? 'Editar lote' : 'Novo lote'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Nome *</label><input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="ex: Talhão A" /></div>
              <div className="form-group"><label>Área (ha) *</label><input type="number" step="0.1" value={form.area_hectares} onChange={e=>setForm(f=>({...f,area_hectares:e.target.value}))} /></div>
              <div className="form-group">
                <label>Variedade</label>
                <select value={form.variedade} onChange={e=>setForm(f=>({...f,variedade:e.target.value}))}>
                  <option>Prata Anã</option><option>Nanica</option><option>Prata</option><option>Cavendish</option><option>Terra</option><option>Outra</option>
                </select>
              </div>
              <div className="form-group"><label>Data de plantio</label><input type="date" value={form.data_plantio} onChange={e=>setForm(f=>({...f,data_plantio:e.target.value}))} /></div>
              <div className="form-group">
                <label>Nº de setores</label>
                <input type="number" min="1" max="20" value={form.quantidade_setores} onChange={e=>setForm(f=>({...f,quantidade_setores:e.target.value}))} />
                <span className="form-hint">Setores são criados automaticamente</span>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="ativo">Ativo</option><option value="em_repouso">Em repouso</option><option value="colhido">Colhido</option><option value="inativo">Inativo</option>
                </select>
              </div>
              <div className="form-group form-full"><label>Observações</label><textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Características do solo, irrigação, etc." /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{flex:1}}>{saving?'Salvando...':editId?'✓ Salvar':'✓ Criar lote'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

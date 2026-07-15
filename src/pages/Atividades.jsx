import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, today } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

const TIPOS = ['Adubação','Irrigação','Pulverização','Capina','Poda','Colheita','Outro']
const EMPTY = { lote_id:'', setor_id:'', data:today(), tipo_atividade:'Adubação', observacoes:'' }

export default function Atividades({ onAddBtn }) {
  const { tenantId, handleAuthError } = useAuth()
  const [lotes, setLotes]       = useState([])
  const [setores, setSetores]   = useState([])
  const [insumos, setInsumos]   = useState([])
  const [atividades, setAtividades] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState(null)
  const [linhasInsumos, setLinhas] = useState([{ insumo_id:'', quantidade:'', custo_unitario:'' }])
  const [saving, setSaving]     = useState(false)
  const lotesRef = React.useRef([])

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])

  async function load() {
    setLoading(true)
    try {
      const [{ data: ls }, { data: sts }, { data: ins }, { data: ats }] = await Promise.all([
        supabase.from('lotes').select('id,nome').neq('status','inativo').order('nome'),
        supabase.from('setores').select('*').order('nome'),
        supabase.from('insumos').select('id,nome,unidade,custo_medio').order('nome'),
        supabase.from('atividades_lote').select('*,lotes(nome),setores(nome)').order('data',{ascending:false}).limit(50),
      ])
      lotesRef.current = ls??[]
      setLotes(ls??[]); setSetores(sts??[]); setInsumos(ins??[]); setAtividades(ats??[])
    } catch (e) { handleAuthError(e) } finally {
      setLoading(false)
    }
  }

  function setoresDoLote(loteId) { return setores.filter(s=>s.lote_id===loteId) }

  function openModal(a=null) {
    if (a) {
      setForm({ lote_id:a.lote_id, setor_id:a.setor_id??'', data:a.data?.split('T')[0]??today(), tipo_atividade:a.tipo_atividade, observacoes:a.observacoes??'' })
      setEditId(a.id)
    } else {
      setForm({ ...EMPTY, lote_id:lotesRef.current[0]?.id??'' })
      setEditId(null)
    }
    setLinhas([{ insumo_id:'', quantidade:'', custo_unitario:'' }])
    setModal(true)
  }
  function closeModal() { setModal(false); setEditId(null) }

  function addLinha() { setLinhas(l=>[...l,{insumo_id:'',quantidade:'',custo_unitario:''}]) }
  function removeLinha(i) { setLinhas(l=>l.filter((_,idx)=>idx!==i)) }
  function updateLinha(i,field,val) {
    setLinhas(l=>l.map((row,idx)=>{
      if (idx!==i) return row
      const novo = {...row,[field]:val}
      if (field==='insumo_id') {
        const ins = insumos.find(x=>x.id===val)
        if (ins) novo.custo_unitario = ins.custo_medio
      }
      return novo
    }))
  }

  const custoEstimado = linhasInsumos.reduce((s,l)=>{
    const q=parseFloat(l.quantidade)||0; const c=parseFloat(l.custo_unitario)||0
    return s+q*c
  },0)

  async function save() {
    if (!form.lote_id || !form.tipo_atividade) return alert('Selecione o lote e o tipo de atividade.')
    const _tipo = form.tipo_atividade.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    if (_tipo === 'Adubacao' || _tipo === 'Pulverizacao') {
      const _linhas = linhasInsumos.filter(l => l.insumo_id && parseFloat(l.quantidade) > 0)
      if (_linhas.length === 0) { return alert('Para Adubacao ou Pulverizacao informe o insumo em Estoque.') }
      for (const _l of _linhas) {
        const { data: _v } = await supabase.rpc('fn_validar_insumo_atividade', { p_insumo_id: _l.insumo_id, p_quantidade: parseFloat(_l.quantidade) || 0 })
        if (_v && !_v.ok) { return alert(_v.erro) }
      }
    }
    setSaving(true)
    try {
      const payload = { lote_id:form.lote_id, setor_id:form.setor_id||null, data:form.data, tipo_atividade:form.tipo_atividade, observacoes:form.observacoes||null, status:'realizada' }
      let atvId = editId
      const timeout = () => new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo esgotado.')),30000))
      if (editId) {
        const res = await Promise.race([supabase.from('atividades_lote').update(payload).eq('id',editId), timeout()])
        if (res?.error) throw new Error(res.error.message)
      } else {
        const res = await Promise.race([supabase.from('atividades_lote').insert({ ...payload, tenant_id: tenantId }).select().single(), timeout()])
        if (res?.error) throw new Error(res.error.message)
        atvId = res?.data?.id
      }
      // Salva insumos usados (apenas no insert)
      if (!editId && atvId) {
        const linhasValidas = linhasInsumos.filter(l=>l.insumo_id&&parseFloat(l.quantidade)>0)
        for (const l of linhasValidas) {
          const res = await Promise.race([supabase.from('atividade_insumos').insert({
            atividade_id:atvId, insumo_id:l.insumo_id,
            quantidade:parseFloat(l.quantidade), custo_unitario:parseFloat(l.custo_unitario)||0,
            tenant_id: tenantId,
          }), timeout()])
          if (res?.error) throw new Error(res.error.message)
        }
      }
      closeModal(); load()
    } catch(err) {
      console.error('[Atividades.save]', err)
      alert('Erro ao salvar: ' + err.message)
    } finally { setSaving(false) }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta atividade?')) return
    await supabase.from('atividades_lote').delete().eq('id',id); load()
  }

  const tipoIcon = { Adubação:'🌱', Irrigação:'💧', Pulverização:'🧪', Capina:'✂️', Poda:'🪚', Colheita:'🍌', Outro:'📝' }

  if (loading) return <div className="loading">Carregando atividades...</div>

  return (
    <>
      {atividades.length === 0
        ? <div className="empty">Nenhuma atividade registrada.<br/>Clique em "+ Nova atividade".</div>
        : <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Lote</th><th>Setor</th><th>Atividade</th><th>Custo</th><th>Obs.</th><th></th></tr></thead>
                <tbody>
                  {atividades.map(a=>(
                    <tr key={a.id}>
                      <td>{fmtDate(a.data)}</td>
                      <td><strong>{a.lotes?.nome}</strong></td>
                      <td style={{color:'var(--text-muted)'}}>{a.setores?.nome??'—'}</td>
                      <td>{tipoIcon[a.tipo_atividade]??'📝'} {a.tipo_atividade}</td>
                      <td style={{fontWeight:600,color:'var(--amber)'}}>{a.custo_total>0?fmt(a.custo_total):'—'}</td>
                      <td style={{color:'var(--text-muted)',fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.observacoes??'—'}</td>
                      <td><div style={{display:'flex',gap:4}}>
                        <button className="btn btn-sm" onClick={()=>openModal(a)}>✎</button>
                        <button className="btn btn-sm btn-danger" onClick={()=>excluir(a.id)}>✕</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

      <button className="fab" onClick={()=>openModal()}>+</button>

      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="modal" style={{maxWidth:560}}>
            <div className="modal-header">
              <h3>{editId?'Editar atividade':'Nova atividade'}</h3>
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
                <label>Data *</label>
                <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} />
              </div>
              <div className="form-group">
                <label>Tipo de atividade *</label>
                <select value={form.tipo_atividade} onChange={e=>setForm(f=>({...f,tipo_atividade:e.target.value}))}>
                  {TIPOS.map(t=><option key={t} value={t}>{tipoIcon[t]} {t}</option>)}
                </select>
              </div>
              <div className="form-group form-full">
                <label>Observações</label>
                <textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Detalhes da atividade..." />
              </div>

              {!editId && (
                <div className="form-group form-full">
                  <label style={{marginBottom:8}}>Insumos utilizados</label>
                  {linhasInsumos.map((l,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr auto',gap:6,marginBottom:6,alignItems:'flex-end'}}>
                      <select value={l.insumo_id} onChange={e=>updateLinha(i,'insumo_id',e.target.value)}>
                        <option value="">— Insumo —</option>
                        {insumos.map(ins=><option key={ins.id} value={ins.id}>{ins.nome}</option>)}
                      </select>
                      <input type="number" inputMode="decimal" value={l.quantidade} onChange={e=>updateLinha(i,'quantidade',e.target.value)} placeholder="Qtd" />
                      <input type="number" inputMode="decimal" value={l.custo_unitario} onChange={e=>updateLinha(i,'custo_unitario',e.target.value)} placeholder="R$/un" />
                      <button type="button" className="btn btn-sm btn-danger" onClick={()=>removeLinha(i)}>✕</button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm" onClick={addLinha} style={{marginTop:4}}>+ Adicionar insumo</button>
                  {custoEstimado > 0 && <div className="form-hint" style={{marginTop:6,fontWeight:600,color:'var(--amber)'}}>Custo estimado: {fmt(custoEstimado)}</div>}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{flex:1}}>
                {saving?'Salvando...':editId?'✓ Salvar':'✓ Registrar atividade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

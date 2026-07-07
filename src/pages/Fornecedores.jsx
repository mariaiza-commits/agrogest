import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

const CATS = ['geral','insumos','servicos','equipamentos','transporte','outros']
const EMPTY = { nome:'', cpf_cnpj:'', telefone:'', email:'', categoria:'geral', observacoes:'' }

export default function Fornecedores({ onAddBtn }) {
  const { tenantId } = useAuth()
  const [fornecedores, setFornecedores] = useState([])
  const [historico, setHistorico]       = useState({})
  const [loading, setLoading]           = useState(true)
  const [modal, setModal]               = useState(false)
  const [detalhe, setDetalhe]           = useState(null)
  const [form, setForm]                 = useState(EMPTY)
  const [editId, setEditId]             = useState(null)
  const [saving, setSaving]             = useState(false)
  const [busca, setBusca]               = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  useEffect(() => { load(); const _t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(_t) }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [])

  async function load() {
    setLoading(true)
    try {
    const [{ data: fs }, { data: hs }] = await Promise.all([
      supabase.from('suppliers').select('*').is('deleted_at', null).order('nome'),
      supabase.from('vw_historico_fornecedores').select('*'),
    ])
    setFornecedores(fs ?? [])
    const h = {}; (hs ?? []).forEach(r => { h[r.supplier_id] = r }); setHistorico(h)
    } catch {} finally {
      setLoading(false)
    }
  }

  function openModal(f = null) {
    if (f) { setForm({ nome:f.nome, cpf_cnpj:f.cpf_cnpj??'', telefone:f.telefone??'', email:f.email??'', categoria:f.categoria??'geral', observacoes:f.observacoes??'' }); setEditId(f.id) }
    else { setForm(EMPTY); setEditId(null) }
    setModal(true)
  }

  async function save() {
    if (!form.nome.trim()) return alert('Informe o nome.')
    setSaving(true)
    const payload = { nome:form.nome.trim(), cpf_cnpj:form.cpf_cnpj||null, telefone:form.telefone||null, email:form.email||null, categoria:form.categoria, observacoes:form.observacoes||null }
    if (editId) await supabase.from('suppliers').update(payload).eq('id', editId)
    else await supabase.from('suppliers').insert({ ...payload, tenant_id: tenantId })
    setSaving(false); setModal(false); load()
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este fornecedor?')) return
    await supabase.from('suppliers').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const filtrados = fornecedores.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) &&
    (!filtroCategoria || f.categoria === filtroCategoria)
  )

  const totalComprado = filtrados.reduce((s, f) => s + Number(historico[f.id]?.total_comprado ?? 0), 0)
  const totalPendente = filtrados.reduce((s, f) => s + Number(historico[f.id]?.total_pendente ?? 0), 0)

  const catLabel = { geral:'Geral', insumos:'Insumos', servicos:'Serviços', equipamentos:'Equipamentos', transporte:'Transporte', outros:'Outros' }
  const catColor = { insumos:'var(--green)', servicos:'var(--teal)', equipamentos:'var(--amber)', transporte:'var(--text-muted)', geral:'var(--text-muted)', outros:'var(--text-muted)' }

  if (loading) return <div className="loading">Carregando fornecedores...</div>

  return (
    <>
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { label:'Fornecedores', val: filtrados.length, color:'var(--text)' },
          { label:'Total comprado', val: fmt(totalComprado), color:'var(--amber)' },
          { label:'A pagar', val: fmt(totalPendente), color: totalPendente > 0 ? 'var(--red)' : 'var(--text-muted)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase' }}>{k.label}</div>
            <div style={{ fontSize:18, fontWeight:700, color:k.color, marginTop:2 }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom:12, padding:'10px 14px' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar fornecedor..." style={{ flex:2, minWidth:160 }} />
          <select value={filtroCategoria} onChange={e=>setFiltroCategoria(e.target.value)} style={{ flex:1 }}>
            <option value="">Todas categorias</option>
            {CATS.map(c => <option key={c} value={c}>{catLabel[c]}</option>)}
          </select>
        </div>
      </div>

      {filtrados.length === 0
        ? <div className="empty">Nenhum fornecedor encontrado.</div>
        : <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Telefone</th>
                    <th style={{textAlign:'right'}}>Total comprado</th>
                    <th style={{textAlign:'right'}}>A pagar</th>
                    <th>Última compra</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(f => {
                    const h = historico[f.id] ?? {}
                    const pendente = Number(h.total_pendente ?? 0)
                    return (
                      <tr key={f.id} style={{ cursor:'pointer' }} onClick={() => setDetalhe(f)}>
                        <td><strong>{f.nome}</strong>{f.cpf_cnpj && <div style={{fontSize:11,color:'var(--text-muted)'}}>{f.cpf_cnpj}</div>}</td>
                        <td><span style={{ fontSize:11, fontWeight:600, color:catColor[f.categoria], background:'var(--bg)', borderRadius:4, padding:'2px 7px' }}>{catLabel[f.categoria]??f.categoria}</span></td>
                        <td style={{fontSize:13}}>{f.telefone ?? '—'}</td>
                        <td style={{textAlign:'right',color:'var(--amber)',fontWeight:600}}>{fmt(h.total_comprado??0)}</td>
                        <td style={{textAlign:'right',fontWeight:600,color:pendente>0?'var(--red)':'var(--text-muted)'}}>{fmt(pendente)}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{h.ultima_transacao?fmtDate(h.ultima_transacao):'—'}</td>
                        <td><div style={{display:'flex',gap:4}}>
                          <button className="btn btn-sm" onClick={e=>{e.stopPropagation();openModal(f)}}>✎</button>
                          <button className="btn btn-sm btn-danger" onClick={e=>{e.stopPropagation();excluir(f.id)}}>✕</button>
                        </div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>}

      <button className="fab" onClick={() => openModal()}>+</button>

      {detalhe && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header">
              <div><h3>{detalhe.nome}</h3><div style={{fontSize:12,color:catColor[detalhe.categoria]??'var(--text-muted)'}}>{catLabel[detalhe.categoria]??detalhe.categoria}</div></div>
              <button className="modal-close" onClick={()=>setDetalhe(null)}>✕</button>
            </div>
            {(() => { const h = historico[detalhe.id] ?? {}; return (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                {[
                  { label:'Total comprado', val:fmt(h.total_comprado??0), color:'var(--amber)' },
                  { label:'A pagar', val:fmt(h.total_pendente??0), color:Number(h.total_pendente??0)>0?'var(--red)':'var(--text-muted)' },
                  { label:'Nº de compras', val:h.qtd_transacoes??0, color:'var(--text)' },
                  { label:'Última compra', val:h.ultima_transacao?fmtDate(h.ultima_transacao):'—', color:'var(--text)' },
                ].map(k => (
                  <div key={k.label} style={{background:'var(--bg)',borderRadius:8,padding:'10px 12px'}}>
                    <div style={{fontSize:11,color:'var(--text-muted)',fontWeight:600}}>{k.label}</div>
                    <div style={{fontWeight:700,fontSize:16,color:k.color,marginTop:2}}>{k.val}</div>
                  </div>
                ))}
              </div>
            )})()}
            {detalhe.telefone && <div style={{fontSize:13,marginBottom:6}}>📞 {detalhe.telefone}</div>}
            {detalhe.email && <div style={{fontSize:13,marginBottom:6}}>✉️ {detalhe.email}</div>}
            {detalhe.observacoes && <div style={{fontSize:13,color:'var(--text-muted)',marginTop:8}}>📝 {detalhe.observacoes}</div>}
            <div className="modal-footer" style={{marginTop:16}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={()=>{setDetalhe(null);openModal(detalhe)}}>✎ Editar</button>
              <button className="btn btn-danger" onClick={()=>{excluir(detalhe.id);setDetalhe(null)}}>✕ Excluir</button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header">
              <h3>{editId ? 'Editar fornecedor' : 'Novo fornecedor'}</h3>
              <button className="modal-close" onClick={()=>setModal(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Nome *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome ou razão social" autoFocus />
              </div>
              <div className="form-group"><label>Categoria</label>
                <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
                  {CATS.map(c => <option key={c} value={c}>{catLabel[c]}</option>)}
                </select>
              </div>
              <div className="form-group"><label>CPF / CNPJ</label>
                <input value={form.cpf_cnpj} onChange={e=>setForm(f=>({...f,cpf_cnpj:e.target.value}))} placeholder="000.000.000-00" />
              </div>
              <div className="form-group"><label>Telefone</label>
                <input value={form.telefone} onChange={e=>setForm(f=>({...f,telefone:e.target.value}))} placeholder="(38) 99999-9999" />
              </div>
              <div className="form-group"><label>E-mail</label>
                <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@exemplo.com" />
              </div>
              <div className="form-group form-full"><label>Observações</label>
                <textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{flex:1}}>{saving?'Salvando...':editId?'✓ Salvar':'✓ Cadastrar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

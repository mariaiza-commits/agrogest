import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'

const EMPTY = { nome:'', cpf_cnpj:'', telefone:'', email:'', tipo:'pessoa_fisica', observacoes:'' }

export default function Clientes({ onAddBtn }) {
  const [clientes, setClientes]   = useState([])
  const [historico, setHistorico] = useState({})
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [detalhe, setDetalhe]     = useState(null)
  const [form, setForm]           = useState(EMPTY)
  const [editId, setEditId]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [busca, setBusca]         = useState('')

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [])

  async function load() {
    setLoading(true)
    const [{ data: cs }, { data: hs }] = await Promise.all([
      supabase.from('clients').select('*').is('deleted_at', null).order('nome'),
      supabase.from('vw_historico_clientes').select('*'),
    ])
    setClientes(cs ?? [])
    const h = {}; (hs ?? []).forEach(r => { h[r.client_id] = r }); setHistorico(h)
    setLoading(false)
  }

  function openModal(c = null) {
    if (c) { setForm({ nome:c.nome, cpf_cnpj:c.cpf_cnpj??'', telefone:c.telefone??'', email:c.email??'', tipo:c.tipo??'pessoa_fisica', observacoes:c.observacoes??'' }); setEditId(c.id) }
    else { setForm(EMPTY); setEditId(null) }
    setModal(true)
  }

  async function save() {
    if (!form.nome.trim()) return alert('Informe o nome.')
    setSaving(true)
    const payload = { nome:form.nome.trim(), cpf_cnpj:form.cpf_cnpj||null, telefone:form.telefone||null, email:form.email||null, tipo:form.tipo, observacoes:form.observacoes||null }
    if (editId) await supabase.from('clients').update(payload).eq('id', editId)
    else await supabase.from('clients').insert(payload)
    setSaving(false); setModal(false); load()
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este cliente?')) return
    await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))
  const totalFaturado  = filtrados.reduce((s, c) => s + Number(historico[c.id]?.total_faturado ?? 0), 0)
  const totalPendente  = filtrados.reduce((s, c) => s + Number(historico[c.id]?.total_pendente ?? 0), 0)
  const inadimplentes  = filtrados.filter(c => Number(historico[c.id]?.total_pendente ?? 0) > 0)

  if (loading) return <div className="loading">Carregando clientes...</div>

  return (
    <>
      {/* Totalizadores */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { label:'Clientes', val: filtrados.length, color:'var(--text)' },
          { label:'Total faturado', val: fmt(totalFaturado), color:'var(--teal)' },
          { label:'A receber', val: fmt(totalPendente), color:'var(--amber)' },
          { label:'Inadimplentes', val: inadimplentes.length, color: inadimplentes.length > 0 ? 'var(--red)' : 'var(--text-muted)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase' }}>{k.label}</div>
            <div style={{ fontSize:18, fontWeight:700, color:k.color, marginTop:2 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="card" style={{ marginBottom:12, padding:'10px 14px' }}>
        <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar cliente..." style={{ width:'100%' }} />
      </div>

      {filtrados.length === 0
        ? <div className="empty">Nenhum cliente encontrado.</div>
        : <div className="card">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Telefone</th>
                    <th>Tipo</th>
                    <th style={{textAlign:'right'}}>Faturado</th>
                    <th style={{textAlign:'right'}}>Pendente</th>
                    <th>Última compra</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map(c => {
                    const h = historico[c.id] ?? {}
                    const pendente = Number(h.total_pendente ?? 0)
                    return (
                      <tr key={c.id} style={{ cursor:'pointer' }} onClick={() => setDetalhe(c)}>
                        <td><strong>{c.nome}</strong>{c.cpf_cnpj && <div style={{fontSize:11,color:'var(--text-muted)'}}>{c.cpf_cnpj}</div>}</td>
                        <td style={{fontSize:13}}>{c.telefone ?? '—'}</td>
                        <td><span className="badge badge-gray" style={{fontSize:10}}>{c.tipo === 'pessoa_fisica' ? 'Pessoa Física' : 'Empresa'}</span></td>
                        <td style={{textAlign:'right',color:'var(--teal)',fontWeight:600}}>{fmt(h.total_faturado ?? 0)}</td>
                        <td style={{textAlign:'right',fontWeight:600,color:pendente>0?'var(--red)':'var(--text-muted)'}}>{fmt(pendente)}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{h.ultima_transacao ? fmtDate(h.ultima_transacao) : '—'}</td>
                        <td><div style={{display:'flex',gap:4}}>
                          <button className="btn btn-sm" onClick={e=>{e.stopPropagation();openModal(c)}}>✎</button>
                          <button className="btn btn-sm btn-danger" onClick={e=>{e.stopPropagation();excluir(c.id)}}>✕</button>
                        </div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>}

      <button className="fab" onClick={() => openModal()}>+</button>

      {/* Modal detalhe */}
      {detalhe && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
          <div className="modal" style={{maxWidth:480}}>
            <div className="modal-header">
              <div><h3>{detalhe.nome}</h3><div style={{fontSize:12,color:'var(--text-muted)'}}>{detalhe.tipo === 'pessoa_fisica' ? 'Pessoa Física' : 'Empresa'}</div></div>
              <button className="modal-close" onClick={()=>setDetalhe(null)}>✕</button>
            </div>
            {(() => { const h = historico[detalhe.id] ?? {}; return (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
                {[
                  { label:'Total faturado', val:fmt(h.total_faturado??0), color:'var(--teal)' },
                  { label:'Pendente', val:fmt(h.total_pendente??0), color:Number(h.total_pendente??0)>0?'var(--red)':'var(--text-muted)' },
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
            {detalhe.cpf_cnpj && <div style={{fontSize:13,marginBottom:6}}>📄 {detalhe.cpf_cnpj}</div>}
            {detalhe.observacoes && <div style={{fontSize:13,color:'var(--text-muted)',marginTop:8}}>📝 {detalhe.observacoes}</div>}
            <div className="modal-footer" style={{marginTop:16}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={()=>{setDetalhe(null);openModal(detalhe)}}>✎ Editar</button>
              <button className="btn btn-danger" onClick={()=>{excluir(detalhe.id);setDetalhe(null)}}>✕ Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal" style={{maxWidth:440}}>
            <div className="modal-header">
              <h3>{editId ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button className="modal-close" onClick={()=>setModal(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Nome *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="Nome completo ou empresa" autoFocus />
              </div>
              <div className="form-group"><label>Tipo</label>
                <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}>
                  <option value="pessoa_fisica">Pessoa Física</option>
                  <option value="empresa">Empresa</option>
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
                <textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} placeholder="Informações adicionais..." />
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

import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

const EMPTY = { nome:'', telefone:'', email:'', cpf_cnpj:'', observacoes:'' }

export default function Clientes({ onAddBtn }) {
  const { tenantId } = useAuth()
  const [clientes, setClientes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [editId, setEditId]     = useState(null)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [detalhe, setDetalhe]   = useState(null)
  const [busca, setBusca]       = useState('')

  useEffect(() => { load(); const _t = setTimeout(() => setLoading(false), 10000); return () => clearTimeout(_t) }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [clientes])

  async function load() {
    setLoading(true)
    try {
    const { data } = await supabase
      .from('vw_historico_clientes')
      .select('*')
      .order('nome')
    setClientes(data ?? [])
    } catch {} finally {
      setLoading(false)
    }
  }

  function openModal(c = null) {
    if (c) {
      setEditId(c.client_id)
      setForm({ nome: c.nome, telefone: c.telefone || '', email: c.email || '', cpf_cnpj: c.cpf_cnpj || '', observacoes: c.observacoes || '' })
    } else {
      setEditId(null)
      setForm(EMPTY)
    }
    setModal(true)
  }

  async function save() {
    if (!form.nome.trim()) return alert('Informe o nome.')
    setSaving(true)
    const payload = { nome: form.nome.trim(), telefone: form.telefone || null, email: form.email || null, cpf_cnpj: form.cpf_cnpj || null, observacoes: form.observacoes || null }
    if (editId) {
      await supabase.from('clients').update(payload).eq('id', editId)
    } else {
      await supabase.from('clients').insert({ ...payload, tenant_id: tenantId })
    }
    setSaving(false); setModal(false); load()
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este cliente?')) return
    await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const filtrados = clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))
  const totalFaturado  = filtrados.reduce((s, c) => s + Number(c.total_faturado  ?? 0), 0)
  const totalPendente  = filtrados.reduce((s, c) => s + Number(c.total_pendente  ?? 0), 0)
  const totalRecebido  = filtrados.reduce((s, c) => s + Number(c.total_recebido  ?? 0), 0)

  if (loading) return <div className="loading">Carregando clientes...</div>

  return (
    <>
      {/* KPIs */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { label:'Clientes',    val: filtrados.length },
          { label:'Faturado',    val: fmt(totalFaturado),  color:'var(--teal)' },
          { label:'Pendente',    val: fmt(totalPendente),  color:'var(--amber)' },
          { label:'Recebido',    val: fmt(totalRecebido),  color:'var(--green)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase' }}>{k.label}</div>
            <div style={{ fontSize:16, fontWeight:700, color:k.color ?? 'var(--text)', marginTop:2 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="card" style={{ marginBottom:12, padding:'10px 14px' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente..." style={{ width:'100%' }}/>
      </div>

      {/* Lista */}
      {filtrados.length === 0
        ? <div className="empty">Nenhum cliente encontrado.</div>
        : <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th style={{textAlign:'right'}}>Vendas</th>
                  <th style={{textAlign:'right'}}>Faturado</th>
                  <th style={{textAlign:'right'}}>Pendente</th>
                  <th style={{textAlign:'right'}}>Recebido</th>
                  <th>Última compra</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {filtrados.map(c => (
                    <tr key={c.client_id} style={{ cursor:'pointer' }} onClick={() => setDetalhe(c)}>
                      <td><strong>{c.nome}</strong></td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{c.telefone || '—'}</td>
                      <td style={{ textAlign:'right' }}>{c.total_vendas ?? 0}</td>
                      <td style={{ textAlign:'right', color:'var(--teal)', fontWeight:600 }}>{fmt(c.total_faturado)}</td>
                      <td style={{ textAlign:'right', color:'var(--amber)', fontWeight:600 }}>{fmt(c.total_pendente)}</td>
                      <td style={{ textAlign:'right', color:'var(--green)', fontWeight:600 }}>{fmt(c.total_recebido)}</td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{c.ultima_compra ? fmtDate(c.ultima_compra) : '—'}</td>
                      <td>
                        <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-sm" onClick={() => openModal(c)}>✎</button>
                          <button className="btn btn-sm btn-danger" onClick={() => excluir(c.client_id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

      <button className="fab" onClick={() => openModal()}>+</button>

      {/* Modal detalhe */}
      {detalhe && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setDetalhe(null)}>
          <div className="modal" style={{ maxWidth:460 }}>
            <div className="modal-header">
              <h3>👥 {detalhe.nome}</h3>
              <button className="modal-close" onClick={() => setDetalhe(null)}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
              {[
                { label:'Total vendas',   val: detalhe.total_vendas ?? 0 },
                { label:'Última compra',  val: detalhe.ultima_compra ? fmtDate(detalhe.ultima_compra) : '—' },
                { label:'Total faturado', val: fmt(detalhe.total_faturado),  color:'var(--teal)' },
                { label:'Pendente',       val: fmt(detalhe.total_pendente),  color:'var(--amber)' },
                { label:'Recebido',       val: fmt(detalhe.total_recebido),  color:'var(--green)' },
                { label:'Telefone',       val: detalhe.telefone || '—' },
                { label:'Email',          val: detalhe.email || '—' },
                { label:'CPF/CNPJ',       val: detalhe.cpf_cnpj || '—' },
              ].map(k => (
                <div key={k.label} style={{ background:'var(--bg)', borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>{k.label}</div>
                  <div style={{ fontSize:14, fontWeight:600, color:k.color ?? 'var(--text)', marginTop:2 }}>{k.val}</div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDetalhe(null)}>Fechar</button>
              <button className="btn btn-primary" onClick={() => { setDetalhe(null); openModal(detalhe) }}>✎ Editar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      {modal && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <h3>{editId ? 'Editar cliente' : 'Novo cliente'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Nome *</label>
                <input value={form.nome} onChange={e => setForm(f => ({...f, nome:e.target.value}))} placeholder="Nome do cliente" autoFocus/>
              </div>
              <div className="form-group"><label>Telefone</label>
                <input value={form.telefone} onChange={e => setForm(f => ({...f, telefone:e.target.value}))} placeholder="(00) 00000-0000"/>
              </div>
              <div className="form-group"><label>Email</label>
                <input value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} placeholder="email@exemplo.com"/>
              </div>
              <div className="form-group form-full"><label>CPF / CNPJ</label>
                <input value={form.cpf_cnpj} onChange={e => setForm(f => ({...f, cpf_cnpj:e.target.value}))} placeholder="000.000.000-00"/>
              </div>
              <div className="form-group form-full"><label>Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({...f, observacoes:e.target.value}))} rows={2}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex:1 }}>
                {saving ? 'Salvando...' : editId ? '✓ Salvar' : '✓ Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

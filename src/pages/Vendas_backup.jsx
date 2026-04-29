import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, statusBadge, today } from '../lib/utils'

const EMPTY = { lote_id: '', producao_id: '', data_venda: today(), comprador: '', quantidade_caixas: '', preco_unitario: '', forma_pagamento: 'a_vista', data_vencimento: '', observacoes: '' }

export default function Vendas({ onAddBtn }) {
  const [lotes, setLotes]       = useState([])
  const [producoes, setProducoes] = useState([])
  const [vendas, setVendas]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    load()
    if (onAddBtn) onAddBtn(() => openModal())
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: ls }, { data: vs }] = await Promise.all([
      supabase.from('lotes').select('id, nome, variedade').neq('status', 'inativo').order('nome'),
      supabase.from('vendas').select('*, lotes(nome)').order('data_venda', { ascending: false }).limit(50),
    ])
    setLotes(ls ?? [])
    setVendas(vs ?? [])
    if (ls?.length > 0) loadProducoes(ls[0].id)
    setLoading(false)
  }

  async function loadProducoes(loteId) {
    const { data } = await supabase.from('producao').select('id, data_colheita, quantidade_caixas').eq('lote_id', loteId).order('data_colheita', { ascending: false })
    setProducoes(data ?? [])
  }

  function openModal() {
    const firstLote = lotes[0]?.id ?? ''
    setForm({ ...EMPTY, lote_id: firstLote })
    if (firstLote) loadProducoes(firstLote)
    setModal(true)
  }

  function closeModal() { setModal(false) }

  function handleLoteChange(loteId) {
    setForm(f => ({ ...f, lote_id: loteId, producao_id: '' }))
    loadProducoes(loteId)
  }

  const valorTotal = form.quantidade_caixas && form.preco_unitario
    ? (parseFloat(form.quantidade_caixas) * parseFloat(form.preco_unitario))
    : null

  async function save() {
    if (!form.lote_id || !form.comprador || !form.quantidade_caixas || !form.preco_unitario)
      return alert('Preencha lote, comprador, quantidade e preço.')
    if (form.forma_pagamento === 'a_prazo' && !form.data_vencimento)
      return alert('Informe a data de vencimento para vendas a prazo.')
    setSaving(true)
    const payload = {
      lote_id: form.lote_id,
      producao_id: form.producao_id || null,
      data_venda: form.data_venda,
      comprador: form.comprador,
      quantidade_caixas: parseInt(form.quantidade_caixas),
      preco_unitario: parseFloat(form.preco_unitario),
      forma_pagamento: form.forma_pagamento,
      data_vencimento: form.data_vencimento || null,
      status_pagamento: form.forma_pagamento === 'a_vista' ? 'recebido' : 'pendente',
      data_recebimento: form.forma_pagamento === 'a_vista' ? form.data_venda : null,
      observacoes: form.observacoes || null,
    }
    const { error } = await supabase.from('vendas').insert(payload)
    if (error) { alert('Erro ao salvar: ' + error.message); setSaving(false); return }
    setSaving(false)
    closeModal()
    load()
  }

  async function marcarRecebido(id) {
    await supabase.rpc('fn_receber_venda', { p_venda_id: id, p_data_recebimento: today() })
    load()
  }

  if (loading) return <div className="loading">Carregando vendas...</div>

  return (
    <>
      {vendas.length === 0
        ? <div className="empty">Nenhuma venda registrada.<br />Clique em "+ Nova venda" para começar.</div>
        : (
          <div className="card">
            <div className="card-title">Vendas registradas</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Data</th><th>Comprador</th><th>Lote</th><th>Caixas</th><th>Preço/cx</th><th>Total</th><th>Vencimento</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {vendas.map(v => {
                    const { cls, label } = statusBadge(v.status_pagamento)
                    return (
                      <tr key={v.id}>
                        <td>{fmtDate(v.data_venda)}</td>
                        <td><strong>{v.comprador}</strong></td>
                        <td>{v.lotes?.nome}</td>
                        <td>{v.quantidade_caixas}</td>
                        <td>{fmt(v.preco_unitario)}</td>
                        <td style={{ fontWeight: 500, color: 'var(--teal)' }}>{fmt(v.valor_total)}</td>
                        <td>{fmtDate(v.data_vencimento)}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td>
                          {v.status_pagamento === 'pendente' || v.status_pagamento === 'atrasado'
                            ? <button className="btn btn-sm" onClick={() => marcarRecebido(v.id)}>Receber</button>
                            : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      {modal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            <div className="modal-header">
              <h3>Registrar venda</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Lote *</label>
                <select value={form.lote_id} onChange={e => handleLoteChange(e.target.value)}>
                  {lotes.map(l => <option key={l.id} value={l.id}>{l.nome} — {l.variedade}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Colheita vinculada</label>
                <select value={form.producao_id} onChange={e => setForm(f => ({ ...f, producao_id: e.target.value }))}>
                  <option value="">— Sem vínculo —</option>
                  {producoes.map(p => (
                    <option key={p.id} value={p.id}>
                      {fmtDate(p.data_colheita)} — {p.quantidade_caixas} caixas
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Data da venda *</label>
                <input type="date" value={form.data_venda} onChange={e => setForm(f => ({ ...f, data_venda: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Comprador *</label>
                <input value={form.comprador} onChange={e => setForm(f => ({ ...f, comprador: e.target.value }))} placeholder="Nome ou empresa" />
              </div>
              <div className="form-group">
                <label>Qtd caixas *</label>
                <input type="number" value={form.quantidade_caixas} onChange={e => setForm(f => ({ ...f, quantidade_caixas: e.target.value }))} placeholder="120" />
              </div>
              <div className="form-group">
                <label>Preço por caixa (R$) *</label>
                <input type="number" step="0.01" value={form.preco_unitario} onChange={e => setForm(f => ({ ...f, preco_unitario: e.target.value }))} placeholder="30,00" />
              </div>
              <div className="form-group">
                <label>Valor total</label>
                <input className="form-readonly" readOnly value={valorTotal !== null ? fmt(valorTotal) : ''} placeholder="Calculado automaticamente" style={{ color: 'var(--green)', fontWeight: 500 }} />
              </div>
              <div className="form-group">
                <label>Forma de pagamento</label>
                <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}>
                  <option value="a_vista">À vista</option>
                  <option value="a_prazo">A prazo</option>
                </select>
              </div>
              {form.forma_pagamento === 'a_prazo' && (
                <div className="form-group">
                  <label>Data de vencimento *</label>
                  <input type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                </div>
              )}
              <div className="form-group form-full">
                <label>Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Notas sobre a venda..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Registrar venda'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

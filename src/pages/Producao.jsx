import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

const EMPTY_ITEM = { lote_id:'', setor_id:'', quantidade_primeira:0, quantidade_segunda:0, peso_medio_primeira:0, peso_medio_segunda:0, preco_kg_primeira:0, preco_kg_segunda:0 }

export default function Producao({ onAddBtn }) {
  const { tenantId, handleAuthError } = useAuth()
  const [cargas, setCargas]   = useState([])
  const [lotes, setLotes]     = useState([])
  const [setoresMap, setSetoresMap] = useState({}) // lote_id → setores[]
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [editId, setEditId]   = useState(null)
  const [saving, setSaving]   = useState(false)
  const [detalhe, setDetalhe] = useState(null)
  const [detalheItens, setDetalheItens] = useState([])

  // Form da carga
  const [formData, setFormData] = useState('')
  const [formObs, setFormObs]   = useState('')
  const [itens, setItens]       = useState([{ ...EMPTY_ITEM }])

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [cargas])

  async function load() {
    setLoading(true)
    try {
      const [{ data: cs }, { data: ls }, { data: sts }] = await Promise.all([
        supabase.from('vw_resumo_cargas').select('*').order('data', { ascending: false }),
        supabase.from('lotes').select('id,nome').order('nome'),
        supabase.from('setores').select('id,lote_id,nome,cultura,variedade').order('nome'),
      ])
      setCargas(cs ?? [])
      setLotes(ls ?? [])
      const m = {}
      ;(sts ?? []).forEach(s => {
        if (!m[s.lote_id]) m[s.lote_id] = []
        m[s.lote_id].push(s)
      })
      setSetoresMap(m)
    } catch (e) { handleAuthError(e) } finally {
      setLoading(false)
    }
  }

  function getSetores(lote_id) {
    return setoresMap[lote_id] ?? []
  }

  // Label do setor: mostra variedade se existir, senão cultura, senão nome
  function labelSetor(s) {
    if (!s) return '—'
    const info = s.variedade || s.cultura
    return info ? `${s.nome} — ${info}` : s.nome
  }

  function addItem() {
    setItens(prev => [...prev, { ...EMPTY_ITEM }])
  }

  function removeItem(idx) {
    setItens(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx, field, value) {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const updated = { ...it, [field]: value }
      // Se mudou lote, reseta setor
      if (field === 'lote_id') updated.setor_id = ''
      return updated
    }))
  }

  async function openModal(carga = null) {
    setEditId(null)
    setFormData(new Date().toISOString().split('T')[0])
    setFormObs('')
    setItens([{ ...EMPTY_ITEM }])
    if (carga) {
      setEditId(carga.carga_id)
      setFormData(carga.data)
      setFormObs(carga.observacoes ?? '')
      const { data: its } = await supabase.from('carga_itens').select('*').eq('carga_id', carga.carga_id)
      if (its?.length) setItens(its.map(it => ({
        id: it.id,
        lote_id: it.lote_id ?? '',
        setor_id: it.setor_id ?? '',
        quantidade_primeira: it.quantidade_primeira ?? 0,
        quantidade_segunda: it.quantidade_segunda ?? 0,
        peso_medio_primeira: it.peso_medio_primeira ?? 0,
        peso_medio_segunda: it.peso_medio_segunda ?? 0,
        preco_kg_primeira: it.preco_kg_primeira ?? 0,
        preco_kg_segunda: it.preco_kg_segunda ?? 0,
      })))
    }
    setModal(true)
  }

  async function abrirDetalhe(carga) {
    setDetalhe(carga)
    const { data } = await supabase
      .from('carga_itens')
      .select('*, lotes(nome), setores(nome, variedade, cultura)')
      .eq('carga_id', carga.carga_id)
    setDetalheItens(data ?? [])
  }

  async function save() {
    if (!formData) return alert('Informe a data da carga.')
    if (itens.some(it => !it.lote_id)) return alert('Selecione o lote em todos os itens.')
    setSaving(true)
    try {
      const itensPayload = itens.map(it => ({
        lote_id: it.lote_id,
        setor_id: it.setor_id || null,
        quantidade_primeira: Number(it.quantidade_primeira) || 0,
        quantidade_segunda: Number(it.quantidade_segunda) || 0,
        peso_medio_primeira: Number(it.peso_medio_primeira) || 0,
        peso_medio_segunda: Number(it.peso_medio_segunda) || 0,
        preco_kg_primeira: Number(it.preco_kg_primeira) || 0,
        preco_kg_segunda: Number(it.preco_kg_segunda) || 0,
      }))
      const { error } = await supabase.rpc('fn_salvar_carga', {
        p_carga_id: editId || null,
        p_data: formData,
        p_obs: formObs || null,
        p_itens: itensPayload,
        p_tenant_id: tenantId,
      })
      if (error) throw new Error(error.message)
      setModal(false)
      await load()
    } catch(err) { alert('Erro: ' + err.message) }
    finally { setSaving(false) }
  }

    async function excluir(id) {
    if (!window.confirm('Excluir esta carga?')) return
    await supabase.from('carga_itens').delete().eq('carga_id', id)
    await supabase.from('cargas').delete().eq('id', id)
    load()
  }

  // Totais do formulário
  const totaisForm = useMemo(() => {
    let qtd1 = 0, qtd2 = 0, peso1 = 0, peso2 = 0
    itens.forEach(it => {
      qtd1 += Number(it.quantidade_primeira) || 0
      qtd2 += Number(it.quantidade_segunda) || 0
      const q1 = Number(it.quantidade_primeira) || 0
      const q2 = Number(it.quantidade_segunda) || 0
      const p1 = Number(it.peso_medio_primeira) || 0
      const p2 = Number(it.peso_medio_segunda) || 0
      peso1 += q1 * p1
      peso2 += q2 * p2
    })
    return { qtd1, qtd2, total: qtd1 + qtd2, pesoTotal: peso1 + peso2 }
  }, [itens])

  if (loading) return <div className="loading">Carregando produção...</div>

  return (
    <>
      {/* RESUMO */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { label:'Cargas', val: cargas.length },
          { label:'Total 1ª', val: cargas.reduce((s,c)=>s+Number(c.total_primeira??0),0) + ' cx' },
          { label:'Total 2ª', val: cargas.reduce((s,c)=>s+Number(c.total_segunda??0),0) + ' cx' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase' }}>{k.label}</div>
            <div style={{ fontSize:16, fontWeight:700, marginTop:2 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* LISTA DE CARGAS */}
      {cargas.length === 0
        ? <div className="empty">Nenhuma carga registrada.</div>
        : <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Data</th>
                  <th>Lote(s)</th>
                  <th style={{textAlign:'right'}}>1ª (cx)</th>
                  <th style={{textAlign:'right'}}>2ª (cx)</th>
                  <th style={{textAlign:'right'}}>Total</th>
                  <th style={{textAlign:'right'}}>Peso total</th>
                  <th>Obs</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  {cargas.map(c => (
                    <tr key={c.carga_id} style={{ cursor:'pointer' }} onClick={() => abrirDetalhe(c)}>
                      <td><strong>{fmtDate(c.data)}</strong></td>
                      <td style={{ fontSize:12, color:'var(--text-muted)' }}>{c.lotes_nomes || '—'}</td>
                      <td style={{ textAlign:'right' }}>{Number(c.total_primeira||0).toLocaleString('pt-BR')}</td>
                      <td style={{ textAlign:'right', color:'var(--amber)' }}>{Number(c.total_segunda||0).toLocaleString('pt-BR')}</td>
                      <td style={{ textAlign:'right', fontWeight:700, color:'var(--teal)' }}>{Number((c.total_primeira||0)+(c.total_segunda||0)).toLocaleString('pt-BR')}</td>
                      <td style={{ textAlign:'right', fontSize:12, color:'var(--text-muted)' }}>
                        {Number(c.peso_total_kg||0) > 0 ? `${Number(c.peso_total_kg).toFixed(0)} kg` : '—'}
                      </td>
                      <td style={{ fontSize:12, color:'var(--text-muted)', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.observacoes||'—'}</td>
                      <td>
                        <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-sm" onClick={() => openModal(c)}>✎</button>
                          <button className="btn btn-sm btn-danger" onClick={() => excluir(c.carga_id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

      <button className="fab" onClick={() => openModal()}>+</button>

      {/* MODAL DETALHE */}
      {detalhe && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setDetalhe(null)}>
          <div className="modal" style={{ maxWidth:580 }}>
            <div className="modal-header">
              <h3>Carga — {fmtDate(detalhe.data)}</h3>
              <button className="modal-close" onClick={() => setDetalhe(null)}>✕</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>Lote</th><th>Setor / Variedade</th>
                  <th style={{textAlign:'right'}}>1ª (cx)</th>
                  <th style={{textAlign:'right'}}>Peso 1ª</th>
                  <th style={{textAlign:'right'}}>Preço/kg 1ª</th>
                  <th style={{textAlign:'right'}}>2ª (cx)</th>
                  <th style={{textAlign:'right'}}>Peso 2ª</th>
                  <th style={{textAlign:'right'}}>Preço/kg 2ª</th>
                </tr></thead>
                <tbody>
                  {detalheItens.map(it => {
                    const setorLabel = it.setores
                      ? (it.setores.variedade || it.setores.cultura
                          ? `${it.setores.nome} — ${it.setores.variedade || it.setores.cultura}`
                          : it.setores.nome)
                      : '—'
                    return (
                      <tr key={it.id}>
                        <td><strong>{it.lotes?.nome}</strong></td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>{setorLabel}</td>
                        <td style={{ textAlign:'right' }}>{it.quantidade_primeira}</td>
                        <td style={{ textAlign:'right', fontSize:12 }}>{it.peso_medio_primeira > 0 ? `${it.peso_medio_primeira} kg` : '—'}</td>
                        <td style={{ textAlign:'right', fontSize:12, color:'var(--teal)' }}>{it.preco_kg_primeira > 0 ? fmt(it.preco_kg_primeira) : '—'}</td>
                        <td style={{ textAlign:'right', color:'var(--amber)' }}>{it.quantidade_segunda}</td>
                        <td style={{ textAlign:'right', fontSize:12 }}>{it.peso_medio_segunda > 0 ? `${it.peso_medio_segunda} kg` : '—'}</td>
                        <td style={{ textAlign:'right', fontSize:12, color:'var(--amber)' }}>{it.preco_kg_segunda > 0 ? fmt(it.preco_kg_segunda) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setDetalhe(null)}>Fechar</button>
              <button className="btn btn-primary" onClick={() => { setDetalhe(null); openModal(detalhe) }}>✎ Editar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR/EDITAR */}
      {modal && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth:700 }}>
            <div className="modal-header">
              <h3>{editId ? 'Editar carga' : 'Nova carga'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            <div className="form-grid" style={{ marginBottom:16 }}>
              <div className="form-group">
                <label>Data da carga *</label>
                <input type="date" value={formData} onChange={e => setFormData(e.target.value)} />
              </div>
              <div className="form-group form-full">
                <label>Observações</label>
                <input value={formObs} onChange={e => setFormObs(e.target.value)} placeholder="ex: Carga da manhã" />
              </div>
            </div>

            <div style={{ fontWeight:600, fontSize:13, marginBottom:10, borderTop:'1px solid var(--border)', paddingTop:14 }}>
              📦 Itens da carga
            </div>

            {itens.map((it, idx) => {
              const setoresLote = getSetores(it.lote_id)
              // Totais do item
              const q1 = Number(it.quantidade_primeira) || 0
              const q2 = Number(it.quantidade_segunda) || 0
              const p1 = Number(it.peso_medio_primeira) || 0
              const p2 = Number(it.peso_medio_segunda) || 0
              const pr1 = Number(it.preco_kg_primeira) || 0
              const pr2 = Number(it.preco_kg_segunda) || 0
              const valorItem = (q1 * p1 * pr1) + (q2 * p2 * pr2)

              return (
                <div key={idx} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:12, marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                    <span style={{ fontWeight:600, fontSize:12, color:'var(--text-muted)' }}>Item {idx + 1}</span>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      {valorItem > 0 && <span style={{ fontSize:12, fontWeight:700, color:'var(--teal)' }}>≈ {fmt(valorItem)}</span>}
                      {itens.length > 1 && <button className="btn btn-sm btn-danger" onClick={() => removeItem(idx)}>✕</button>}
                    </div>
                  </div>

                  {/* Lote + Setor */}
                  <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                    <div className="form-group" style={{ marginBottom:0, flex:2, minWidth:140 }}>
                      <label>Lote *</label>
                      <select value={it.lote_id} onChange={e => updateItem(idx, 'lote_id', e.target.value)}>
                        <option value="">— Selecione —</option>
                        {lotes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom:0, flex:2, minWidth:160 }}>
                      <label>Setor / Variedade</label>
                      <select value={it.setor_id} onChange={e => updateItem(idx, 'setor_id', e.target.value)} disabled={!it.lote_id}>
                        <option value="">— Geral —</option>
                        {setoresLote.map(s => (
                          <option key={s.id} value={s.id}>{labelSetor(s)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 1ª Qualidade */}
                  <div style={{ background:'#EAF3DE22', border:'1px solid #C0DD9766', borderRadius:6, padding:'8px 10px', marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--green)', marginBottom:6 }}>1ª Qualidade</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:80 }}>
                        <label>Qtd (cx)</label>
                        <input type="number" min="0" value={it.quantidade_primeira} onChange={e => updateItem(idx,'quantidade_primeira',e.target.value)} placeholder="0" />
                      </div>
                      <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:80 }}>
                        <label>Peso médio/cx (kg)</label>
                        <input type="number" step="0.01" min="0" value={it.peso_medio_primeira} onChange={e => updateItem(idx,'peso_medio_primeira',e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:80 }}>
                        <label>Preço/kg (R$)</label>
                        <input type="number" step="0.001" min="0" value={it.preco_kg_primeira} onChange={e => updateItem(idx,'preco_kg_primeira',e.target.value)} placeholder="0.00" />
                      </div>
                      {q1 > 0 && p1 > 0 && pr1 > 0 && (
                        <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:4 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'var(--green)' }}>= {fmt(q1*p1*pr1)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 2ª Qualidade */}
                  <div style={{ background:'#FAEEDA22', border:'1px solid #FAC77566', borderRadius:6, padding:'8px 10px' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--amber)', marginBottom:6 }}>2ª Qualidade</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:80 }}>
                        <label>Qtd (cx)</label>
                        <input type="number" min="0" value={it.quantidade_segunda} onChange={e => updateItem(idx,'quantidade_segunda',e.target.value)} placeholder="0" />
                      </div>
                      <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:80 }}>
                        <label>Peso médio/cx (kg)</label>
                        <input type="number" step="0.01" min="0" value={it.peso_medio_segunda} onChange={e => updateItem(idx,'peso_medio_segunda',e.target.value)} placeholder="0.00" />
                      </div>
                      <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:80 }}>
                        <label>Preço/kg (R$)</label>
                        <input type="number" step="0.001" min="0" value={it.preco_kg_segunda} onChange={e => updateItem(idx,'preco_kg_segunda',e.target.value)} placeholder="0.00" />
                      </div>
                      {q2 > 0 && p2 > 0 && pr2 > 0 && (
                        <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:4 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'var(--amber)' }}>= {fmt(q2*p2*pr2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            <button className="btn btn-sm" onClick={addItem} style={{ marginBottom:14, width:'100%' }}>
              + Adicionar lote/setor
            </button>

            {/* Totais */}
            <div style={{ background:'var(--bg)', borderRadius:8, padding:'10px 14px', marginBottom:14, display:'flex', gap:16, flexWrap:'wrap' }}>
              <span style={{ fontSize:13 }}>1ª: <strong>{totaisForm.qtd1} cx</strong></span>
              <span style={{ fontSize:13 }}>2ª: <strong style={{color:'var(--amber)'}}>{totaisForm.qtd2} cx</strong></span>
              <span style={{ fontSize:13 }}>Total: <strong style={{color:'var(--teal)'}}>{totaisForm.total} cx</strong></span>
              {totaisForm.pesoTotal > 0 && <span style={{ fontSize:13 }}>Peso: <strong>{totaisForm.pesoTotal.toFixed(0)} kg</strong></span>}
            </div>

            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex:1 }}>
                {saving ? 'Salvando...' : editId ? '✓ Salvar alterações' : '✓ Registrar carga'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

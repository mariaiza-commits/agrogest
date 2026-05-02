import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, today, BtnExportar } from '../lib/utils'

const EMPTY_CARGA = { data: today(), observacoes: '' }
const EMPTY_ITEM  = { lote_id: '', setor_id: '', quantidade_primeira: '', quantidade_segunda: '', peso_medio_primeira: '', peso_medio_segunda: '' }

const COLS_EXPORT = [
  { label: 'Data', accessor: r => fmtDate(r.data) },
  { label: 'Total caixas', key: 'total_caixas' },
  { label: 'Primeira', key: 'total_primeira' },
  { label: 'Segunda', key: 'total_segunda' },
  { label: 'Saldo primeira', key: 'saldo_primeira' },
  { label: 'Saldo segunda', key: 'saldo_segunda' },
]

export default function Producao({ onAddBtn }) {
  const [lotes, setLotes]         = useState([])
  const [setores, setSetores]     = useState([])
  const [cargas, setCargas]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [modal, setModal]         = useState(false)
  const [editId, setEditId]       = useState(null)
  const [formCarga, setFormCarga] = useState(EMPTY_CARGA)
  const [itens, setItens]         = useState([{ ...EMPTY_ITEM }])
  const [saving, setSaving]       = useState(false)
  const [expandido, setExpandido] = useState({})

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])

  async function load() {
    setLoading(true)
    const [{ data: ls }, { data: sts }, { data: cs }] = await Promise.all([
      supabase.from('lotes').select('id,nome,variedade').neq('status','inativo').order('nome'),
      supabase.from('setores').select('id,lote_id,nome,cultura,estagio').order('nome'),
      supabase.from('vw_resumo_cargas').select('*'),
    ])
    setLotes(ls??[]); setSetores(sts??[]); setCargas(cs??[])
    setLoading(false)
  }

  function setoresPorLote(loteId) {
    return setores.filter(s => s.lote_id === loteId)
  }

  async function openModal(carga = null) {
    if (carga) {
      setFormCarga({ data: carga.data, observacoes: carga.observacoes ?? '' })
      setEditId(carga.carga_id)
      const { data } = await supabase.from('carga_itens').select('*').eq('carga_id', carga.carga_id)
      if (data?.length) setItens(data.map(i => ({ lote_id: i.lote_id, setor_id: i.setor_id??'', quantidade_primeira: i.quantidade_primeira, quantidade_segunda: i.quantidade_segunda, peso_medio_primeira: i.peso_medio_primeira??'', peso_medio_segunda: i.peso_medio_segunda??'' })))
      else setItens([{ ...EMPTY_ITEM }])
    } else {
      setFormCarga(EMPTY_CARGA); setItens([{ ...EMPTY_ITEM }]); setEditId(null)
    }
    setModal(true)
  }

  function addItem() { setItens(i => [...i, { ...EMPTY_ITEM }]) }
  function removeItem(idx) { setItens(i => i.filter((_, j) => j !== idx)) }
  function updateItem(idx, field, value) { setItens(i => i.map((item, j) => j === idx ? { ...item, [field]: value, ...(field==='lote_id'?{setor_id:''}:{}) } : item)) }

  const totalPrimeira = itens.reduce((s, i) => s + (parseInt(i.quantidade_primeira) || 0), 0)
  const totalSegunda  = itens.reduce((s, i) => s + (parseInt(i.quantidade_segunda) || 0), 0)
  const totalGeral    = totalPrimeira + totalSegunda

  async function save() {
    if (!formCarga.data) return alert('Informe a data.')
    if (itens.every(i => !i.lote_id)) return alert('Adicione pelo menos um lote.')
    setSaving(true)
    let cargaId = editId
    if (editId) {
      await supabase.from('cargas').update({ data: formCarga.data, observacoes: formCarga.observacoes||null }).eq('id', editId)
      await supabase.from('carga_itens').delete().eq('carga_id', editId)
    } else {
      const { data: nova } = await supabase.from('cargas').insert({ data: formCarga.data, observacoes: formCarga.observacoes||null }).select().single()
      cargaId = nova.id
    }
    const filtrados = itens.filter(i => i.lote_id)
    if (filtrados.length) {
      await supabase.from('carga_itens').insert(filtrados.map(i => ({
        carga_id: cargaId, lote_id: i.lote_id, setor_id: i.setor_id||null,
        quantidade_primeira: parseInt(i.quantidade_primeira)||0,
        quantidade_segunda: parseInt(i.quantidade_segunda)||0,
        peso_medio_primeira: i.peso_medio_primeira ? parseFloat(i.peso_medio_primeira) : null,
        peso_medio_segunda: i.peso_medio_segunda ? parseFloat(i.peso_medio_segunda) : null,
      })))
    }
    setSaving(false); setModal(false); load()
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta carga?')) return
    await supabase.from('cargas').delete().eq('id', id); load()
  }

  if (loading) return <div className="loading">Carregando produção...</div>

  return (
    <>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
        <BtnExportar dados={cargas} colunas={COLS_EXPORT} nome="producao" />
      </div>

      {cargas.length === 0
        ? <div className="empty">Nenhuma carga registrada.<br/>Clique em "+ Nova carga" para começar.</div>
        : cargas.map(c => {
            const aberto = expandido[c.carga_id]
            const temSaldo = c.saldo_primeira > 0 || c.saldo_segunda > 0
            return (
              <div key={c.carga_id} className="card" style={{ marginBottom:10 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }} onClick={() => setExpandido(e => ({ ...e, [c.carga_id]: !e[c.carga_id] }))}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:16 }}>📦 Carga — {fmtDate(c.data)}</span>
                      {temSaldo ? <span className="badge badge-green">Saldo disponível</span> : c.total_caixas > 0 && <span className="badge badge-gray">Totalmente vendida</span>}
                    </div>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3 }}>{c.qtd_lotes} lote(s) · {c.qtd_itens} setor(es)</div>
                  </div>
                  <div style={{ display:'flex', gap:16, flexShrink:0 }}>
                    <div style={{ textAlign:'center' }}><div style={{ fontSize:11, color:'var(--text-muted)' }}>1ª</div><div style={{ fontWeight:700, color:'var(--green)' }}>{c.total_primeira}</div></div>
                    <div style={{ textAlign:'center' }}><div style={{ fontSize:11, color:'var(--text-muted)' }}>2ª</div><div style={{ fontWeight:700, color:'var(--amber)' }}>{c.total_segunda}</div></div>
                    <div style={{ textAlign:'center' }}><div style={{ fontSize:11, color:'var(--text-muted)' }}>Total</div><div style={{ fontWeight:700 }}>{c.total_caixas}</div></div>
                  </div>
                  <span style={{ fontSize:18, color:'var(--text-muted)', transform:aberto?'rotate(180deg)':'none', transition:'transform .2s' }}>⌄</span>
                </div>

                {aberto && (
                  <div style={{ marginTop:14, borderTop:'1px solid var(--border)', paddingTop:12 }}>
                    <div style={{ display:'flex', gap:12, marginBottom:12, flexWrap:'wrap' }}>
                      <div style={{ background:'var(--green-light)', borderRadius:'var(--radius-sm)', padding:'8px 14px' }}>
                        <div style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>SALDO 1ª</div>
                        <div style={{ fontSize:20, fontWeight:700, color:'var(--green)' }}>{c.saldo_primeira} cx</div>
                      </div>
                      <div style={{ background:'var(--amber-light)', borderRadius:'var(--radius-sm)', padding:'8px 14px' }}>
                        <div style={{ fontSize:11, color:'var(--amber)', fontWeight:600 }}>SALDO 2ª</div>
                        <div style={{ fontSize:20, fontWeight:700, color:'var(--amber)' }}>{c.saldo_segunda} cx</div>
                      </div>
                    </div>
                    {c.observacoes && <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>📝 {c.observacoes}</div>}
                    <CargaItens cargaId={c.carga_id} lotes={lotes} setores={setores} />
                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      <button className="btn btn-sm" onClick={() => openModal(c)}>✎ Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => excluir(c.carga_id)}>✕ Excluir</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

      <button className="fab" onClick={() => openModal()}>+</button>

      {modal && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget&&setModal(false)}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div className="modal-header">
              <h3>{editId ? 'Editar carga' : 'Nova carga'}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="form-grid" style={{ marginBottom:16 }}>
              <div className="form-group"><label>Data *</label>
                <input type="date" value={formCarga.data} onChange={e => setFormCarga(f => ({ ...f, data: e.target.value }))} />
              </div>
              <div className="form-group"><label>Observações</label>
                <input value={formCarga.observacoes} onChange={e => setFormCarga(f => ({ ...f, observacoes: e.target.value }))} placeholder="ex: Carga da manhã" />
              </div>
            </div>

            <div style={{ display:'flex', gap:10, marginBottom:16, background:'var(--bg)', borderRadius:'var(--radius-sm)', padding:'10px 14px' }}>
              <div style={{ flex:1, textAlign:'center' }}><div style={{ fontSize:11, color:'var(--text-muted)' }}>1ª qualidade</div><div style={{ fontSize:20, fontWeight:700, color:'var(--green)' }}>{totalPrimeira} cx</div></div>
              <div style={{ flex:1, textAlign:'center' }}><div style={{ fontSize:11, color:'var(--text-muted)' }}>2ª qualidade</div><div style={{ fontSize:20, fontWeight:700, color:'var(--amber)' }}>{totalSegunda} cx</div></div>
              <div style={{ flex:1, textAlign:'center' }}><div style={{ fontSize:11, color:'var(--text-muted)' }}>Total geral</div><div style={{ fontSize:20, fontWeight:700 }}>{totalGeral} cx</div></div>
            </div>

            <div style={{ marginBottom:10, fontWeight:600, fontSize:13 }}>Distribuição por lote/setor</div>
            {itens.map((item, idx) => (
              <div key={idx} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:12, marginBottom:10 }}>
                <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                  <div className="form-group" style={{ marginBottom:0, flex:2, minWidth:140 }}>
                    <label>Lote</label>
                    <select value={item.lote_id} onChange={e => updateItem(idx,'lote_id',e.target.value)}>
                      <option value="">— Selecione —</option>
                      {lotes.map(l => <option key={l.id} value={l.id}>{l.nome} — {l.variedade}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom:0, flex:2, minWidth:140 }}>
                    <label>Setor</label>
                    <select value={item.setor_id} onChange={e => updateItem(idx,'setor_id',e.target.value)} disabled={!item.lote_id}>
                      <option value="">— Sem setor —</option>
                      {setoresPorLote(item.lote_id).map(s => <option key={s.id} value={s.id}>{s.nome}{s.cultura?` (${s.cultura})`:''}</option>)}
                    </select>
                  </div>
                </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:90 }}><label>Qtd 1ª cx</label><input type="number" inputMode="numeric" value={item.quantidade_primeira} onChange={e => updateItem(idx,'quantidade_primeira',e.target.value)} placeholder="0" /></div>
                  <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:90 }}><label>Peso médio 1ª kg</label><input type="number" inputMode="decimal" step="0.1" value={item.peso_medio_primeira} onChange={e => updateItem(idx,'peso_medio_primeira',e.target.value)} placeholder="22" /></div>
                  <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:90 }}><label>Qtd 2ª cx</label><input type="number" inputMode="numeric" value={item.quantidade_segunda} onChange={e => updateItem(idx,'quantidade_segunda',e.target.value)} placeholder="0" /></div>
                  <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:90 }}><label>Peso médio 2ª kg</label><input type="number" inputMode="decimal" step="0.1" value={item.peso_medio_segunda} onChange={e => updateItem(idx,'peso_medio_segunda',e.target.value)} placeholder="18" /></div>
                  {itens.length > 1 && <button className="btn btn-sm btn-danger" onClick={() => removeItem(idx)}>✕</button>}
                </div>
              </div>
            ))}

            <button className="btn btn-sm" style={{ width:'100%', marginBottom:16 }} onClick={addItem}>+ Adicionar lote/setor</button>

            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex:1 }}>{saving?'Salvando...':editId?'✓ Salvar':'✓ Registrar carga'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function CargaItens({ cargaId, lotes, setores }) {
  const [itens, setItens] = useState([])
  useEffect(() => {
    supabase.from('carga_itens').select('*').eq('carga_id', cargaId).then(({ data }) => setItens(data??[]))
  }, [cargaId])
  if (!itens.length) return <div style={{ fontSize:13, color:'var(--text-muted)' }}>Sem itens registrados.</div>
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Lote</th><th>Setor</th><th>1ª cx</th><th>2ª cx</th><th>Total</th><th>Peso médio</th></tr></thead>
        <tbody>
          {itens.map(i => {
            const lote  = lotes.find(l => l.id === i.lote_id)
            const setor = setores.find(s => s.id === i.setor_id)
            return (
              <tr key={i.id}>
                <td><strong>{lote?.nome??'—'}</strong></td>
                <td>{setor?.nome??'—'}</td>
                <td style={{ color:'var(--green)', fontWeight:600 }}>{i.quantidade_primeira}</td>
                <td style={{ color:'var(--amber)', fontWeight:600 }}>{i.quantidade_segunda}</td>
                <td style={{ fontWeight:700 }}>{i.quantidade_primeira+i.quantidade_segunda}</td>
                <td style={{ color:'var(--text-muted)' }}>{i.peso_medio?i.peso_medio+'kg':'—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, today, BtnExportar } from '../lib/utils'

const EMPTY = { lote_id:'', data_colheita:today(), quantidade_caixas:'', peso_medio_kg:'', qualidade:'primeira', responsavel:'', observacoes:'' }
const COLS_EXPORT = [
  { label:'Data', key:'data_colheita', accessor: r => fmtDate(r.data_colheita) },
  { label:'Lote', accessor: r => r.lotes?.nome },
  { label:'Caixas', key:'quantidade_caixas' },
  { label:'Peso médio (kg)', key:'peso_medio_kg' },
  { label:'Qualidade', key:'qualidade' },
  { label:'Responsável', key:'responsavel' },
]

export default function Producao({ onAddBtn }) {
  const [lotes, setLotes]       = useState([])
  const [registros, setRegistros] = useState([])
  const [filtrados, setFiltrados] = useState([])
  const [loading, setLoading]   = useState(true)
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState(EMPTY)
  const [editId, setEditId]     = useState(null)
  const [saving, setSaving]     = useState(false)
  const [dataIni, setDataIni]   = useState('')
  const [dataFim, setDataFim]   = useState('')
  const [ordem, setOrdem]       = useState('desc')
  const lotesRef = React.useRef([])

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])
  useEffect(() => { aplicarFiltros() }, [registros, dataIni, dataFim, ordem])

  async function load() {
    setLoading(true)
    const [{ data: ls }, { data: ps }] = await Promise.all([
      supabase.from('lotes').select('id,nome,variedade').neq('status','inativo').order('nome'),
      supabase.from('producao').select('*,lotes(nome)').order('data_colheita', { ascending: false }).limit(100),
    ])
    lotesRef.current = ls ?? []
    setLotes(ls ?? []); setRegistros(ps ?? [])
    setLoading(false)
  }

  function aplicarFiltros() {
    let lista = [...registros]
    if (dataIni) lista = lista.filter(r => r.data_colheita >= dataIni)
    if (dataFim) lista = lista.filter(r => r.data_colheita <= dataFim)
    lista.sort((a, b) => ordem === 'asc'
      ? a.data_colheita.localeCompare(b.data_colheita)
      : b.data_colheita.localeCompare(a.data_colheita))
    setFiltrados(lista)
  }

  function openModal(r = null) {
    if (r) {
      setForm({ lote_id:r.lote_id, data_colheita:r.data_colheita?.split('T')[0]??today(), quantidade_caixas:r.quantidade_caixas, peso_medio_kg:r.peso_medio_kg??'', qualidade:r.qualidade, responsavel:r.responsavel??'', observacoes:r.observacoes??'' })
      setEditId(r.id)
    } else {
      setForm({ ...EMPTY, lote_id: lotesRef.current[0]?.id??'' }); setEditId(null)
    }
    setModal(true)
  }
  function closeModal() { setModal(false); setEditId(null) }

  async function save() {
    if (!form.lote_id || !form.quantidade_caixas) return alert('Selecione o lote e informe as caixas.')
    setSaving(true)
    const payload = { lote_id:form.lote_id, data_colheita:form.data_colheita, quantidade_caixas:parseInt(form.quantidade_caixas), peso_medio_kg:form.peso_medio_kg?parseFloat(form.peso_medio_kg):null, qualidade:form.qualidade, responsavel:form.responsavel||null, observacoes:form.observacoes||null }
    if (editId) await supabase.from('producao').update(payload).eq('id',editId)
    else await supabase.from('producao').insert(payload)
    setSaving(false); closeModal(); load()
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta colheita?')) return
    await supabase.from('producao').delete().eq('id',id); load()
  }

  const qBadge = { primeira:'badge-green', segunda:'badge-amber', refugo:'badge-red' }
  const qLabel = { primeira:'Primeira', segunda:'Segunda', refugo:'Refugo' }

  if (loading) return <div className="loading">Carregando produção...</div>

  return (
    <>
      {/* Filtros */}
      <div className="card" style={{marginBottom:12,padding:'12px 16px'}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label>Data inicial</label>
            <input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label>Data final</label>
            <input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label>Ordenar</label>
            <select value={ordem} onChange={e=>setOrdem(e.target.value)}>
              <option value="desc">Mais recente primeiro</option>
              <option value="asc">Mais antigo primeiro</option>
            </select>
          </div>
          <button className="btn btn-sm" onClick={()=>{setDataIni('');setDataFim('')}}>Limpar</button>
          <BtnExportar dados={filtrados} colunas={COLS_EXPORT} nome="producao" />
        </div>
      </div>

      {filtrados.length === 0
        ? <div className="empty">Nenhuma colheita encontrada.<br/>Clique em "+ Nova colheita" para começar.</div>
        : <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Lote</th><th>Caixas</th><th>Peso médio</th><th>Qualidade</th><th>Responsável</th><th></th></tr></thead>
                <tbody>
                  {filtrados.map(r => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.data_colheita)}</td>
                      <td><strong>{r.lotes?.nome}</strong></td>
                      <td>{r.quantidade_caixas}</td>
                      <td>{r.peso_medio_kg ? r.peso_medio_kg+'kg' : '—'}</td>
                      <td><span className={`badge ${qBadge[r.qualidade]}`}>{qLabel[r.qualidade]}</span></td>
                      <td>{r.responsavel??'—'}</td>
                      <td><div style={{display:'flex',gap:4}}>
                        <button className="btn btn-sm" onClick={()=>openModal(r)}>✎</button>
                        <button className="btn btn-sm btn-danger" onClick={()=>excluir(r.id)}>✕</button>
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
          <div className="modal">
            <div className="modal-header">
              <h3>{editId?'Editar colheita':'Nova colheita'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Lote *</label>
                <select value={form.lote_id} onChange={e=>setForm(f=>({...f,lote_id:e.target.value}))}>
                  {lotes.map(l=><option key={l.id} value={l.id}>{l.nome} — {l.variedade}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Data *</label><input type="date" value={form.data_colheita} onChange={e=>setForm(f=>({...f,data_colheita:e.target.value}))} /></div>
              <div className="form-group"><label>Caixas *</label><input type="number" inputMode="numeric" value={form.quantidade_caixas} onChange={e=>setForm(f=>({...f,quantidade_caixas:e.target.value}))} placeholder="120" /></div>
              <div className="form-group"><label>Peso médio/cx (kg)</label><input type="number" inputMode="decimal" step="0.1" value={form.peso_medio_kg} onChange={e=>setForm(f=>({...f,peso_medio_kg:e.target.value}))} placeholder="22" /></div>
              <div className="form-group"><label>Qualidade</label>
                <select value={form.qualidade} onChange={e=>setForm(f=>({...f,qualidade:e.target.value}))}>
                  <option value="primeira">Primeira</option><option value="segunda">Segunda</option><option value="refugo">Refugo</option>
                </select>
              </div>
              <div className="form-group"><label>Responsável</label><input value={form.responsavel} onChange={e=>setForm(f=>({...f,responsavel:e.target.value}))} placeholder="Nome" /></div>
              <div className="form-group form-full"><label>Observações</label><textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{flex:1}}>{saving?'Salvando...':editId?'✓ Salvar':'✓ Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

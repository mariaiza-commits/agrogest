import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, today, BtnExportar } from '../lib/utils'

const EMPTY_INS = { nome:'', unidade:'kg', categoria:'Insumos', estoque_minimo:'', observacoes:'' }
const EMPTY_MOV = { insumo_id:'', tipo:'entrada', quantidade:'', custo_unitario:'', data:today(), observacoes:'' }
const COLS_EST = [
  { label:'Insumo', key:'nome' },
  { label:'Categoria', key:'categoria' },
  { label:'Unidade', key:'unidade' },
  { label:'Estoque atual', key:'estoque_atual' },
  { label:'Mínimo', key:'estoque_minimo' },
  { label:'Custo médio', accessor: r => fmt(r.custo_medio) },
]
const COLS_MOV = [
  { label:'Data', accessor: r => fmtDate(r.data) },
  { label:'Insumo', accessor: r => r.insumos?.nome },
  { label:'Tipo', key:'tipo' },
  { label:'Quantidade', key:'quantidade' },
  { label:'Custo unit.', accessor: r => fmt(r.custo_unitario) },
  { label:'Total', accessor: r => fmt(r.custo_total) },
]

export default function Estoque({ onAddBtn }) {
  const [insumos, setInsumos]   = useState([])
  const [alertas, setAlertas]   = useState([])
  const [movs, setMovs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [modalIns, setModalIns] = useState(false)
  const [modalMov, setModalMov] = useState(false)
  const [formIns, setFormIns]   = useState(EMPTY_INS)
  const [formMov, setFormMov]   = useState(EMPTY_MOV)
  const [editInsId, setEditInsId] = useState(null)
  const [editMovId, setEditMovId] = useState(null)
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModalIns()) }, [insumos])

  async function load() {
    setLoading(true)
    const [{ data: ins }, { data: ale }, { data: mv }] = await Promise.all([
      supabase.from('insumos').select('*').order('nome'),
      supabase.from('vw_alertas_estoque').select('*'),
      supabase.from('movimentacoes_estoque').select('*,insumos(nome)').order('data',{ascending:false}).limit(50),
    ])
    setInsumos(ins??[]); setAlertas(ale??[]); setMovs(mv??[])
    setLoading(false)
  }

  function openModalIns(ins=null) {
    if (ins) { setFormIns({nome:ins.nome,unidade:ins.unidade,categoria:ins.categoria,estoque_minimo:ins.estoque_minimo,observacoes:ins.observacoes??''}); setEditInsId(ins.id) }
    else { setFormIns(EMPTY_INS); setEditInsId(null) }
    setModalIns(true)
  }

  function openModalMov(mov=null) {
    if (mov) { setFormMov({insumo_id:mov.insumo_id,tipo:mov.tipo,quantidade:mov.quantidade,custo_unitario:mov.custo_unitario,data:mov.data?.split('T')[0]??today(),observacoes:mov.observacoes??''}); setEditMovId(mov.id) }
    else { setFormMov(EMPTY_MOV); setEditMovId(null) }
    setModalMov(true)
  }

  async function saveInsumo() {
    if (!formIns.nome) return alert('Informe o nome.')
    setSaving(true)
    const payload = {nome:formIns.nome,unidade:formIns.unidade,categoria:formIns.categoria,estoque_minimo:parseFloat(formIns.estoque_minimo)||0,observacoes:formIns.observacoes||null}
    if (editInsId) await supabase.from('insumos').update(payload).eq('id',editInsId)
    else await supabase.from('insumos').insert(payload)
    setSaving(false); setModalIns(false); setEditInsId(null); load()
  }

  async function saveMov() {
    if (!formMov.insumo_id||!formMov.quantidade) return alert('Selecione o insumo e informe a quantidade.')
    setSaving(true)
    const payload = {insumo_id:formMov.insumo_id,tipo:formMov.tipo,quantidade:parseFloat(formMov.quantidade),custo_unitario:parseFloat(formMov.custo_unitario)||0,data:formMov.data,origem:formMov.tipo==='entrada'?'compra':'ajuste',observacoes:formMov.observacoes||null}
    if (editMovId) {
      await supabase.from('movimentacoes_estoque').update(payload).eq('id',editMovId)
    } else {
      await supabase.from('movimentacoes_estoque').insert(payload)
    }
    setSaving(false); setModalMov(false); setEditMovId(null); load()
  }

  async function excluirMov(id) {
    if (!window.confirm('Excluir esta movimentação? O estoque será recalculado.')) return
    await supabase.from('movimentacoes_estoque').delete().eq('id',id); load()
  }

  async function excluirInsumo(id) {
    if (!window.confirm('Excluir este insumo? As movimentações vinculadas também serão apagadas.')) return
    await supabase.from('movimentacoes_estoque').delete().eq('insumo_id', id)
    await supabase.from('insumos').delete().eq('id', id)
    load()
  }

  async function toggleStatus(ins) {
    const novoStatus = ins.status === 'ativo' ? 'inativo' : 'ativo'
    await supabase.from('insumos').update({ status: novoStatus }).eq('id', ins.id)
    load()
  }

  function getStatus(ins) {
    if (ins.estoque_atual<=0) return 'zerado'
    if (ins.estoque_atual<=ins.estoque_minimo) return 'critico'
    if (ins.estoque_atual<=ins.estoque_minimo*1.5) return 'baixo'
    return 'ok'
  }

  if (loading) return <div className="loading">Carregando estoque...</div>

  const stCor = { zerado:'var(--red)', critico:'var(--red)', baixo:'var(--amber)', ok:'var(--green)' }
  const stLabel = { zerado:'Zerado', critico:'Crítico', baixo:'Baixo', ok:'OK' }

  return (
    <>
      {alertas.length>0&&(
        <div className="alerta-card urgente" style={{marginBottom:14}}>
          <div className="alerta-icon">📦</div>
          <div className="alerta-body">
            <div className="alerta-title">{alertas.length} insumo(s) com estoque baixo</div>
            <div className="alerta-list">
              {alertas.slice(0,4).map(a=>(
                <div key={a.id} className="alerta-item">
                  <span>{a.nome}</span>
                  <strong style={{color:stCor[a.status_estoque]}}>{Number(a.estoque_atual).toFixed(2)} {a.unidade}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:8,marginBottom:14,flexWrap:'wrap'}}>
        <button className="btn btn-primary" onClick={()=>openModalIns()}>+ Novo insumo</button>
        <button className="btn" onClick={()=>openModalMov()}>+ Movimentação</button>
        <BtnExportar dados={insumos} colunas={COLS_EST} nome="estoque" />
      </div>

      {insumos.length===0
        ? <div className="empty">Nenhum insumo cadastrado.</div>
        : <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Insumo</th><th>Categoria</th><th>Unidade</th><th>Estoque atual</th><th>Mínimo</th><th>Custo médio</th><th>Nível</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {insumos.map(ins=>{
                    const st=getStatus(ins)
                    return (
                      <tr key={ins.id}>
                        <td><strong>{ins.nome}</strong></td>
                        <td><span className="badge badge-gray">{ins.categoria}</span></td>
                        <td>{ins.unidade}</td>
                        <td style={{fontWeight:600,color:stCor[st]}}>{Number(ins.estoque_atual).toFixed(2)} {ins.unidade}</td>
                        <td style={{color:'var(--text-muted)'}}>{Number(ins.estoque_minimo).toFixed(2)}</td>
                        <td>{fmt(ins.custo_medio)}/{ins.unidade}</td>
                        <td><span className="badge" style={{background:st==='ok'?'var(--green-light)':st==='baixo'?'var(--amber-light)':'var(--red-light)',color:stCor[st]}}>{stLabel[st]}</span></td>
                        <td><span className="badge" style={{background:ins.status==='inativo'?'var(--amber-light)':'var(--green-light)',color:ins.status==='inativo'?'var(--amber)':'var(--green)'}}>{ins.status==='inativo'?'Inativo':'Em uso'}</span></td>
                        <td><div style={{display:'flex',gap:4}}>
                          <button className="btn btn-sm" onClick={()=>openModalIns(ins)}>✎</button>
                          <button className="btn btn-sm" style={{fontSize:10,background:ins.status==='inativo'?'var(--amber-light)':'var(--green-light)',color:ins.status==='inativo'?'var(--amber)':'var(--green)',borderColor:'transparent'}} onClick={()=>toggleStatus(ins)}>{ins.status==='inativo'?'▶ Reativar':'⏸ Pausar'}</button>
                          <button className="btn btn-sm btn-danger" onClick={()=>excluirInsumo(ins.id)}>✕</button>
                          <button className="btn btn-sm" style={{color:'var(--teal)',borderColor:'var(--teal-light)',background:'var(--teal-light)'}} onClick={()=>{setFormMov({...EMPTY_MOV,insumo_id:ins.id});setModalMov(true)}}>+ Mov.</button>
                        </div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>}

      {movs.length>0&&(
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="card-title" style={{marginBottom:0}}>Últimas movimentações</div>
            <BtnExportar dados={movs} colunas={COLS_MOV} nome="movimentacoes_estoque" />
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Insumo</th><th>Tipo</th><th>Qtd</th><th>Custo unit.</th><th>Total</th><th>Origem</th><th></th></tr></thead>
              <tbody>
                {movs.map(m=>(
                  <tr key={m.id}>
                    <td>{fmtDate(m.data)}</td>
                    <td><strong>{m.insumos?.nome}</strong></td>
                    <td><span className={`badge ${m.tipo==='entrada'?'badge-green':'badge-amber'}`}>{m.tipo==='entrada'?'↑ Entrada':'↓ Saída'}</span></td>
                    <td>{m.quantidade}</td>
                    <td>{fmt(m.custo_unitario)}</td>
                    <td style={{fontWeight:600}}>{fmt(m.custo_total)}</td>
                    <td style={{color:'var(--text-muted)'}}>{m.origem}</td>
                    <td><div style={{display:'flex',gap:4}}>
                      <button className="btn btn-sm" onClick={()=>openModalMov(m)}>✎</button>
                      <button className="btn btn-sm btn-danger" onClick={()=>excluirMov(m.id)}>✕</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal insumo */}
      {modalIns&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalIns(false)}>
          <div className="modal">
            <div className="modal-header"><h3>{editInsId?'Editar insumo':'Novo insumo'}</h3><button className="modal-close" onClick={()=>setModalIns(false)}>✕</button></div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Nome *</label><input autoFocus value={formIns.nome} onChange={e=>setFormIns(f=>({...f,nome:e.target.value}))} placeholder="ex: Ureia 45%" /></div>
              <div className="form-group"><label>Unidade</label>
                <select value={formIns.unidade} onChange={e=>setFormIns(f=>({...f,unidade:e.target.value}))}>
                  <option value="kg">kg</option><option value="litro">litro</option><option value="saco">saco</option><option value="unidade">unidade</option><option value="caixa">caixa</option><option value="tonelada">tonelada</option>
                </select>
              </div>
              <div className="form-group"><label>Estoque mínimo</label><input type="number" inputMode="decimal" value={formIns.estoque_minimo} onChange={e=>setFormIns(f=>({...f,estoque_minimo:e.target.value}))} placeholder="0" /></div>
              <div className="form-group form-full"><label>Observações</label><textarea value={formIns.observacoes} onChange={e=>setFormIns(f=>({...f,observacoes:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModalIns(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveInsumo} disabled={saving} style={{flex:1}}>{saving?'Salvando...':editInsId?'✓ Salvar':'✓ Criar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal movimentação */}
      {modalMov&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalMov(false)}>
          <div className="modal">
            <div className="modal-header"><h3>{editMovId?'Editar movimentação':'Nova movimentação'}</h3><button className="modal-close" onClick={()=>setModalMov(false)}>✕</button></div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Insumo *</label>
                <select value={formMov.insumo_id} onChange={e=>setFormMov(f=>({...f,insumo_id:e.target.value}))}>
                  <option value="">— Selecione —</option>
                  {insumos.map(i=><option key={i.id} value={i.id}>{i.nome} ({Number(i.estoque_atual).toFixed(2)} {i.unidade})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Tipo</label>
                <select value={formMov.tipo} onChange={e=>setFormMov(f=>({...f,tipo:e.target.value}))}>
                  <option value="entrada">↑ Entrada</option><option value="saida">↓ Saída</option><option value="ajuste">⟳ Ajuste</option>
                </select>
              </div>
              <div className="form-group"><label>Data</label><input type="date" value={formMov.data} onChange={e=>setFormMov(f=>({...f,data:e.target.value}))} /></div>
              <div className="form-group"><label>Quantidade *</label><input type="number" inputMode="decimal" step="0.01" value={formMov.quantidade} onChange={e=>setFormMov(f=>({...f,quantidade:e.target.value}))} /></div>
              <div className="form-group"><label>Custo unitário (R$)</label><input type="number" inputMode="decimal" step="0.01" value={formMov.custo_unitario} onChange={e=>setFormMov(f=>({...f,custo_unitario:e.target.value}))} /></div>
              <div className="form-group form-full"><label>Observações</label><textarea value={formMov.observacoes} onChange={e=>setFormMov(f=>({...f,observacoes:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModalMov(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveMov} disabled={saving} style={{flex:1}}>{saving?'Salvando...':editMovId?'✓ Salvar':'✓ Registrar'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

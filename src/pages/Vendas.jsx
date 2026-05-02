import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, statusBadge, today, BtnExportar } from '../lib/utils'

const EMPTY = { lote_id:'', producao_id:'', data_venda:today(), comprador:'', quantidade_caixas:'', preco_unitario:'', dias_prazo:'', forma_pagamento:'a_vista', data_vencimento:'', conta_vista_id:'', observacoes:'' }
const COLS_EXPORT = [
  { label:'Data', accessor: r => fmtDate(r.data_venda) },
  { label:'Comprador', key:'comprador' },
  { label:'Lote', accessor: r => r.lotes?.nome },
  { label:'Caixas', key:'quantidade_caixas' },
  { label:'Preço/cx', accessor: r => fmt(r.preco_unitario) },
  { label:'Total', accessor: r => fmt(r.valor_total) },
  { label:'Vencimento', accessor: r => fmtDate(r.data_vencimento) },
  { label:'Status', key:'status_pagamento' },
]

export default function Vendas({ onAddBtn }) {
  const [lotes, setLotes]             = useState([])
  const [producoes, setProducoes]     = useState([])
  const [vendas, setVendas]           = useState([])
  const [filtrados, setFiltrados]     = useState([])
  const [contas, setContas]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(false)
  const [modalReceber, setModalReceber] = useState(null)
  const [form, setForm]               = useState(EMPTY)
  const [editId, setEditId]           = useState(null)
  const [saving, setSaving]           = useState(false)
  const [filtro, setFiltro]           = useState('todas')
  const [dataIni, setDataIni]         = useState('')
  const [dataFim, setDataFim]         = useState('')
  const [ordem, setOrdem]             = useState('desc')
  const [recContaId, setRecContaId]   = useState('')
  const [recData, setRecData]         = useState(today())
  const lotesRef = React.useRef([])

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])
  useEffect(() => { aplicarFiltros() }, [vendas, filtro, dataIni, dataFim, ordem])

  async function load() {
    setLoading(true)
    const [{ data: ls }, { data: vs }, { data: cs }] = await Promise.all([
      supabase.from('lotes').select('id,nome,variedade').neq('status','inativo').order('nome'),
      supabase.from('vendas').select('*,lotes(nome)').order('data_venda',{ascending:false}).limit(100),
      supabase.from('contas_financeiras').select('id,nome,tipo,saldo_atual').eq('ativo',true).order('nome'),
    ])
    lotesRef.current = ls ?? []
    setLotes(ls??[]); setVendas(vs??[]); setContas(cs??[])
    if (ls?.length>0) loadProducoes(ls[0].id)
    setLoading(false)
  }

  function aplicarFiltros() {
    let lista=[...vendas]
    if (filtro==='pendente') lista=lista.filter(v=>['pendente','atrasado'].includes(v.status_pagamento))
    if (filtro==='recebido') lista=lista.filter(v=>v.status_pagamento==='recebido')
    if (dataIni) lista=lista.filter(v=>v.data_venda>=dataIni)
    if (dataFim) lista=lista.filter(v=>v.data_venda<=dataFim)
    lista.sort((a,b)=>ordem==='asc'?a.data_venda.localeCompare(b.data_venda):b.data_venda.localeCompare(a.data_venda))
    setFiltrados(lista)
  }

  async function loadProducoes(loteId) {
    const { data } = await supabase.from('producao')
      .select('id,data_colheita,quantidade_caixas,responsavel')
      .eq('lote_id',loteId).order('data_colheita',{ascending:false})
    setProducoes(data??[])
  }

  function openModal(v=null) {
    if (v) {
      setForm({lote_id:v.lote_id, producao_id:v.producao_id??'', data_venda:v.data_venda?.split('T')[0]??today(), comprador:v.comprador, quantidade_caixas:v.quantidade_caixas, preco_unitario:v.preco_unitario, dias_prazo:'', forma_pagamento:v.forma_pagamento, data_vencimento:v.data_vencimento?.split('T')[0]??'', conta_vista_id:'', observacoes:v.observacoes??''})
      setEditId(v.id); loadProducoes(v.lote_id)
    } else {
      const firstId=lotesRef.current[0]?.id??''
      setForm({...EMPTY,lote_id:firstId}); setEditId(null)
      if (firstId) loadProducoes(firstId)
    }
    setModal(true)
  }
  function closeModal() { setModal(false); setEditId(null) }

  function handleLoteChange(loteId) {
    setForm(f=>({...f,lote_id:loteId,producao_id:'',quantidade_caixas:'',comprador:''}))
    loadProducoes(loteId)
  }

  function handleColheitaChange(producaoId) {
    const prod=producoes.find(p=>p.id===producaoId)
    setForm(f=>({
      ...f,
      producao_id: producaoId,
      quantidade_caixas: prod ? String(prod.quantidade_caixas) : '',
      comprador: prod?.responsavel ?? f.comprador,
    }))
  }

  function handleDiasPrazo(dias) {
    const n=parseInt(dias)
    const venc=n>0?new Date(new Date(form.data_venda).getTime()+n*86400000).toISOString().split('T')[0]:''
    setForm(f=>({...f,dias_prazo:dias,data_vencimento:venc}))
  }

  const valorTotal = form.quantidade_caixas&&form.preco_unitario ? parseFloat(form.quantidade_caixas)*parseFloat(form.preco_unitario) : null

  async function save() {
    if (!form.lote_id) return alert('Selecione o lote.')
    if (!form.producao_id) return alert('Selecione a colheita vinculada.')
    if (!form.preco_unitario) return alert('Informe o preço por caixa.')
    if (form.forma_pagamento==='a_prazo'&&!form.data_vencimento) return alert('Informe o prazo.')
    setSaving(true)
    const payload={lote_id:form.lote_id,producao_id:form.producao_id,data_venda:form.data_venda,comprador:form.comprador||'—',quantidade_caixas:parseInt(form.quantidade_caixas),preco_unitario:parseFloat(form.preco_unitario),forma_pagamento:form.forma_pagamento,data_vencimento:form.data_vencimento||null,observacoes:form.observacoes||null}
    if (editId) {
      await supabase.from('vendas').update(payload).eq('id',editId)
    } else {
      const isVista = form.forma_pagamento==='a_vista'
      const { data: nova } = await supabase.from('vendas').insert({
        ...payload,
        status_pagamento: isVista ? 'recebido' : 'pendente',
        data_recebimento: isVista ? form.data_venda : null,
        conta_financeira_id: isVista && form.conta_vista_id ? form.conta_vista_id : null,
      }).select().single()
      if (isVista && form.conta_vista_id && nova) {
        await supabase.rpc('fn_receber_venda',{p_venda_id:nova.id,p_data_recebimento:form.data_venda,p_conta_id:form.conta_vista_id})
      }
    }
    setSaving(false); closeModal(); load()
  }

  function abrirReceber(venda) {
    setModalReceber(venda)
    setRecContaId(contas[0]?.id??'')
    setRecData(today())
  }

  async function confirmarReceber() {
    if (!recContaId) return alert('Selecione a conta.')
    setSaving(true)
    const { error } = await supabase.rpc('fn_receber_venda',{p_venda_id:modalReceber.id,p_data_recebimento:recData,p_conta_id:recContaId})
    if (error) { alert('Erro: '+error.message); setSaving(false); return }
    setSaving(false); setModalReceber(null); load()
  }

  async function desfazerRecebimento(id) {
    if (!window.confirm('Desfazer recebimento? O valor será removido do caixa e a venda voltará para pendente.')) return
    const { error } = await supabase.rpc('fn_desfazer_recebimento',{p_venda_id:id})
    if (error) { alert('Erro: '+error.message); return }
    load()
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta venda?')) return
    await supabase.from('vendas').delete().eq('id',id); load()
  }

  const tipoIconConta={caixa:'💵',banco:'🏦',carteira:'👛'}

  if (loading) return <div className="loading">Carregando vendas...</div>

  return (
    <>
      <div className="card" style={{marginBottom:12,padding:'12px 16px'}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-group" style={{marginBottom:0}}><label>Data inicial</label><input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)} /></div>
          <div className="form-group" style={{marginBottom:0}}><label>Data final</label><input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} /></div>
          <div className="form-group" style={{marginBottom:0}}><label>Ordenar</label>
            <select value={ordem} onChange={e=>setOrdem(e.target.value)}><option value="desc">Mais recente</option><option value="asc">Mais antigo</option></select>
          </div>
          <button className="btn btn-sm" onClick={()=>{setDataIni('');setDataFim('')}}>Limpar</button>
          <BtnExportar dados={filtrados} colunas={COLS_EXPORT} nome="vendas" />
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${filtro==='todas'?'active':''}`} onClick={()=>setFiltro('todas')}>Todas ({vendas.length})</button>
        <button className={`tab ${filtro==='pendente'?'active':''}`} onClick={()=>setFiltro('pendente')}>A receber ({vendas.filter(v=>['pendente','atrasado'].includes(v.status_pagamento)).length})</button>
        <button className={`tab ${filtro==='recebido'?'active':''}`} onClick={()=>setFiltro('recebido')}>Recebidas ({vendas.filter(v=>v.status_pagamento==='recebido').length})</button>
      </div>

      {filtrados.length===0
        ? <div className="empty">Nenhuma venda encontrada.</div>
        : <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Comprador</th><th>Lote</th><th>Caixas</th><th>Total</th><th>Venc.</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtrados.map(v=>{
                    const {cls,label}=statusBadge(v.status_pagamento)
                    return (
                      <tr key={v.id}>
                        <td>{fmtDate(v.data_venda)}</td>
                        <td><strong>{v.comprador}</strong></td>
                        <td>{v.lotes?.nome}</td>
                        <td>{v.quantidade_caixas}</td>
                        <td style={{fontWeight:600,color:'var(--teal)'}}>{fmt(v.valor_total)}</td>
                        <td>{fmtDate(v.data_vencimento)}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td><div style={{display:'flex',gap:4}}>
                          {['pendente','atrasado'].includes(v.status_pagamento) &&
                            <button className="btn btn-sm btn-primary" onClick={()=>abrirReceber(v)}>✓</button>}
                          {v.status_pagamento==='recebido' &&
                            <button className="btn btn-sm" style={{color:'var(--amber)',borderColor:'var(--amber-light)',background:'var(--amber-light)'}} onClick={()=>desfazerRecebimento(v.id)} title="Desfazer recebimento">↩</button>}
                          <button className="btn btn-sm" onClick={()=>openModal(v)}>✎</button>
                          <button className="btn btn-sm btn-danger" onClick={()=>excluir(v.id)}>✕</button>
                        </div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>}

      <button className="fab" onClick={()=>openModal()}>+</button>

      {modal&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&closeModal()}>
          <div className="modal">
            <div className="modal-header"><h3>{editId?'Editar venda':'Nova venda'}</h3><button className="modal-close" onClick={closeModal}>✕</button></div>
            <div className="form-grid">
              <div className="form-group"><label>Lote *</label>
                <select value={form.lote_id} onChange={e=>handleLoteChange(e.target.value)}>
                  <option value="">— Selecione —</option>
                  {lotes.map(l=><option key={l.id} value={l.id}>{l.nome} — {l.variedade}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Colheita vinculada *</label>
                <select value={form.producao_id} onChange={e=>handleColheitaChange(e.target.value)}>
                  <option value="">— Selecione a colheita —</option>
                  {producoes.map(p=>(
                    <option key={p.id} value={p.id}>
                      {fmtDate(p.data_colheita)} — {p.quantidade_caixas} cx{p.responsavel?` (${p.responsavel})`:''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group"><label>Qtd caixas</label>
                <input className="form-readonly" readOnly value={form.quantidade_caixas||''} placeholder="Vem da colheita" style={{fontWeight:600,color:'var(--green)'}} />
              </div>
              <div className="form-group"><label>Comprador</label>
                <input className="form-readonly" readOnly value={form.comprador||''} placeholder="Vem da colheita" style={{fontWeight:600}} />
              </div>
              <div className="form-group"><label>Data *</label>
                <input type="date" value={form.data_venda} onChange={e=>setForm(f=>({...f,data_venda:e.target.value}))} />
              </div>
              <div className="form-group"><label>Preço/caixa (R$) *</label>
                <input type="number" inputMode="decimal" step="0.01" value={form.preco_unitario} onChange={e=>setForm(f=>({...f,preco_unitario:e.target.value}))} placeholder="30,00" />
              </div>
              <div className="form-group"><label>Valor total</label>
                <input className="form-readonly" readOnly value={valorTotal!==null?fmt(valorTotal):''} style={{fontWeight:600,color:'var(--green)'}} />
              </div>
              <div className="form-group"><label>Pagamento</label>
                <select value={form.forma_pagamento} onChange={e=>setForm(f=>({...f,forma_pagamento:e.target.value,dias_prazo:'',data_vencimento:'',conta_vista_id:''}))}>
                  <option value="a_vista">À vista</option><option value="a_prazo">A prazo</option>
                </select>
              </div>
              {form.forma_pagamento==='a_vista'&&(
                <div className="form-group">
                  <label>Conta que recebeu</label>
                  <select value={form.conta_vista_id??''} onChange={e=>setForm(f=>({...f,conta_vista_id:e.target.value}))}>
                    <option value="">— Selecione (opcional) —</option>
                    {contas.map(c=><option key={c.id} value={c.id}>{tipoIconConta[c.tipo]??'🏦'} {c.nome} — {fmt(c.saldo_atual)}</option>)}
                  </select>
                </div>
              )}
              {form.forma_pagamento==='a_prazo'&&<>
                <div className="form-group"><label>Prazo (dias)</label>
                  <input type="number" inputMode="numeric" value={form.dias_prazo} onChange={e=>handleDiasPrazo(e.target.value)} placeholder="30" />
                </div>
                <div className="form-group form-full"><label>Vencimento</label>
                  <input className="form-readonly" readOnly value={form.data_vencimento?fmtDate(form.data_vencimento):''} style={{fontWeight:600,color:'var(--amber)'}} />
                </div>
              </>}
              <div className="form-group form-full"><label>Observações</label>
                <textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={closeModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{flex:1}}>
                {saving?'Salvando...':editId?'✓ Salvar':'✓ Registrar venda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalReceber&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalReceber(null)}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header"><h3>Confirmar recebimento</h3><button className="modal-close" onClick={()=>setModalReceber(null)}>✕</button></div>
            <div style={{background:'var(--teal-light)',borderRadius:'var(--radius-sm)',padding:'12px 14px',marginBottom:16}}>
              <div style={{fontSize:12,color:'var(--teal)',marginBottom:4}}>Venda de {modalReceber.comprador}</div>
              <div style={{fontSize:22,fontWeight:700,fontFamily:'var(--font-display)',color:'var(--teal)'}}>{fmt(modalReceber.valor_total)}</div>
            </div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Conta que recebeu *</label>
                <select value={recContaId} onChange={e=>setRecContaId(e.target.value)}>
                  <option value="">— Selecione —</option>
                  {contas.map(c=><option key={c.id} value={c.id}>{tipoIconConta[c.tipo]??'🏦'} {c.nome} — {fmt(c.saldo_atual)}</option>)}
                </select>
              </div>
              <div className="form-group form-full"><label>Data do recebimento</label>
                <input type="date" value={recData} onChange={e=>setRecData(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModalReceber(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarReceber} disabled={saving} style={{flex:1}}>
                {saving?'Confirmando...':'✓ Confirmar recebimento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

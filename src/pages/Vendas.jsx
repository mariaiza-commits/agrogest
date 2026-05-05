import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, statusBadge, today, BtnExportar } from '../lib/utils'

const EMPTY = { carga_id:'', client_id:'', comprador:'', comprador_novo:'', usando_novo_comprador:false, quantidade_primeira:'', quantidade_segunda:'', preco_primeira:'', preco_segunda:'', forma_pagamento:'a_vista', dias_prazo:'', data_vencimento:'', conta_vista_id:'', observacoes:'' }

const COLS_EXPORT = [
  { label:'Data', accessor: r => fmtDate(r.data_venda) },
  { label:'Comprador', key:'comprador' },
  { label:'Carga', accessor: r => fmtDate(r.cargas?.data) },
  { label:'1ª cx', key:'quantidade_primeira' },
  { label:'Preço 1ª', accessor: r => fmt(r.preco_primeira) },
  { label:'2ª cx', key:'quantidade_segunda' },
  { label:'Preço 2ª', accessor: r => fmt(r.preco_segunda) },
  { label:'Total', accessor: r => fmt(r.valor_total) },
  { label:'Status', key:'status_pagamento' },
]

export default function Vendas({ onAddBtn }) {
  const [cargas, setCargas]         = useState([])
  const [vendas, setVendas]         = useState([])
  const [filtrados, setFiltrados]   = useState([])
  const [compradores, setCompradores] = useState([])
  const [contas, setContas]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [modalReceber, setModalReceber] = useState(null)
  const [form, setForm]             = useState(EMPTY)
  const [editId, setEditId]         = useState(null)
  const [saving, setSaving]         = useState(false)
  const [filtro, setFiltro]         = useState('todas')
  const [dataIni, setDataIni]       = useState('')
  const [dataFim, setDataFim]       = useState('')
  const [ordem, setOrdem]           = useState('desc')
  const [recContaId, setRecContaId] = useState('')
  const [recData, setRecData]       = useState(today())

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [cargas])
  useEffect(() => { aplicarFiltros() }, [vendas, filtro, dataIni, dataFim, ordem])

  async function load() {
    setLoading(true)
    const [{ data: cs }, { data: vs }, { data: cfs }] = await Promise.all([
      supabase.from('vw_resumo_cargas').select('*').order('data', { ascending: false }),
      supabase.from('vendas').select('*,cargas(data)').order('data_venda',{ascending:false}).limit(100),
      supabase.from('contas_financeiras').select('id,nome,tipo,saldo_atual').eq('ativo',true).order('nome'),
    ])
    setCargas(cs??[]); setVendas(vs??[]); setContas(cfs??[])
    // Carrega clientes cadastrados
    const { data: clientes } = await supabase.from('clients').select('id,nome').is('deleted_at',null).order('nome')
    setCompradores(clientes ?? [])
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

  function getCarga(id) { return cargas.find(c => c.carga_id === id) }

  function handleCargaChange(cargaId) {
    const carga = getCarga(cargaId)
    setForm(f => ({
      ...f, carga_id: cargaId,
      quantidade_primeira: carga ? String(Number(carga.saldo_primeira)) : '',
      quantidade_segunda: carga ? String(Number(carga.saldo_segunda)) : '',
    }))
  }

  function handleDiasPrazo(dias) {
    const n=parseInt(dias)
    const venc=n>0?new Date(new Date().getTime()+n*86400000).toISOString().split('T')[0]:''
    setForm(f=>({...f,dias_prazo:dias,data_vencimento:venc}))
  }

  const cargaSel = getCarga(form.carga_id)
  const valorTotal = (() => {
    const v1 = (parseInt(form.quantidade_primeira)||0) * (parseFloat(form.preco_primeira)||0)
    const v2 = (parseInt(form.quantidade_segunda)||0) * (parseFloat(form.preco_segunda)||0)
    return v1+v2 > 0 ? v1+v2 : null
  })()

  function openModal(v=null) {
    if (v) {
      setForm({ carga_id:v.carga_id??'', comprador:v.comprador, comprador_novo:'', usando_novo_comprador:false, quantidade_primeira:v.quantidade_primeira??0, quantidade_segunda:v.quantidade_segunda??0, preco_primeira:v.preco_primeira??'', preco_segunda:v.preco_segunda??'', forma_pagamento:v.forma_pagamento, dias_prazo:'', data_vencimento:v.data_vencimento?.split('T')[0]??'', conta_vista_id:'', observacoes:v.observacoes??'' })
      setEditId(v.id)
    } else { setForm(EMPTY); setEditId(null) }
    setModal(true)
  }

  const compradorFinal = form.usando_novo_comprador ? form.comprador_novo : form.comprador

  async function save() {
    if (!form.carga_id) return alert('Selecione a carga.')
    if (!compradorFinal) return alert('Informe o comprador.')
    if (!form.preco_primeira && !form.preco_segunda) return alert('Informe pelo menos um preço.')
    if (form.forma_pagamento==='a_prazo'&&!form.data_vencimento) return alert('Informe o prazo.')

    // Valida saldo
    const carga = getCarga(form.carga_id)
    if (carga && !editId) {
      const saldo1 = Number(carga.saldo_primeira)
      const saldo2 = Number(carga.saldo_segunda)
      const qtd1   = parseInt(form.quantidade_primeira)||0
      const qtd2   = parseInt(form.quantidade_segunda)||0
      if (qtd1 > saldo1) return alert(`Saldo insuficiente de 1ª: disponível ${saldo1} cx.`)
      if (qtd2 > saldo2) return alert(`Saldo insuficiente de 2ª: disponível ${saldo2} cx.`)
    }

    setSaving(true)
    const total = valorTotal ?? 0
    const payload = {
      carga_id: form.carga_id, comprador: compradorFinal,
      client_id: form.client_id || null,
      quantidade_primeira: parseInt(form.quantidade_primeira)||0,
      quantidade_segunda: parseInt(form.quantidade_segunda)||0,
      preco_primeira: parseFloat(form.preco_primeira)||0,
      preco_segunda: parseFloat(form.preco_segunda)||0,
      valor_total: total,
      quantidade_caixas: (parseInt(form.quantidade_primeira)||0)+(parseInt(form.quantidade_segunda)||0),
      preco_unitario: total > 0 ? total/((parseInt(form.quantidade_primeira)||0)+(parseInt(form.quantidade_segunda)||0)||1) : 0,
      forma_pagamento: form.forma_pagamento,
      data_venda: today(),
      data_vencimento: form.data_vencimento||null,
      observacoes: form.observacoes||null,
    }

    if (editId) {
      await supabase.from('vendas').update(payload).eq('id',editId)
    } else {
      const isVista = form.forma_pagamento==='a_vista'
      const { data: nova } = await supabase.from('vendas').insert({
        ...payload,
        status_pagamento: isVista?'recebido':'pendente',
        data_recebimento: isVista?today():null,
        conta_financeira_id: isVista&&form.conta_vista_id?form.conta_vista_id:null,
      }).select().single()
      if (isVista && form.conta_vista_id && nova) {
        await supabase.rpc('fn_receber_venda',{p_venda_id:nova.id,p_data_recebimento:today(),p_conta_id:form.conta_vista_id})
      }
    }
    setSaving(false); setModal(false); load()
  }

  function abrirReceber(venda) { setModalReceber(venda); setRecContaId(contas[0]?.id??''); setRecData(today()) }

  async function confirmarReceber() {
    if (!recContaId) return alert('Selecione a conta.')
    setSaving(true)
    const { error } = await supabase.rpc('fn_receber_venda',{p_venda_id:modalReceber.id,p_data_recebimento:recData,p_conta_id:recContaId})
    if (error) { alert('Erro: '+error.message); setSaving(false); return }
    setSaving(false); setModalReceber(null); load()
  }

  async function desfazerRecebimento(id) {
    if (!window.confirm('Desfazer recebimento? O valor será removido do caixa.')) return
    await supabase.rpc('fn_desfazer_recebimento',{p_venda_id:id}); load()
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
                <thead><tr><th>Data</th><th>Comprador</th><th>Carga</th><th>1ª cx</th><th>Preço 1ª</th><th>2ª cx</th><th>Preço 2ª</th><th>Total</th><th>Venc.</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtrados.map(v=>{
                    const {cls,label}=statusBadge(v.status_pagamento)
                    return (
                      <tr key={v.id}>
                        <td>{fmtDate(v.data_venda)}</td>
                        <td><strong>{v.comprador}</strong></td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{v.cargas?.data?fmtDate(v.cargas.data):'—'}</td>
                        <td style={{color:'var(--green)',fontWeight:600}}>{v.quantidade_primeira??0}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{v.preco_primeira?fmt(v.preco_primeira):'—'}</td>
                        <td style={{color:'var(--amber)',fontWeight:600}}>{v.quantidade_segunda??0}</td>
                        <td style={{color:'var(--text-muted)',fontSize:12}}>{v.preco_segunda?fmt(v.preco_segunda):'—'}</td>
                        <td style={{fontWeight:600,color:'var(--teal)'}}>{fmt(v.valor_total)}</td>
                        <td>{fmtDate(v.data_vencimento)}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td><div style={{display:'flex',gap:4}}>
                          {['pendente','atrasado'].includes(v.status_pagamento)&&<button className="btn btn-sm btn-primary" onClick={()=>abrirReceber(v)}>✓</button>}
                          {v.status_pagamento==='recebido'&&<button className="btn btn-sm" style={{color:'var(--amber)',borderColor:'var(--amber-light)',background:'var(--amber-light)'}} onClick={()=>desfazerRecebimento(v.id)} title="Desfazer">↩</button>}
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
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3>{editId?'Editar venda':'Nova venda'}</h3><button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Carga *</label>
                <select value={form.carga_id} onChange={e=>handleCargaChange(e.target.value)}>
                  <option value="">— Selecione a carga —</option>
                  {cargas.map(c=>(
                    <option key={c.carga_id} value={c.carga_id}>
                      {fmtDate(c.data)} — 1ª: {c.saldo_primeira}cx · 2ª: {c.saldo_segunda}cx disponível
                    </option>
                  ))}
                </select>
              </div>
              {cargaSel&&(
                <div className="form-group form-full">
                  <div style={{background:'var(--bg)',borderRadius:'var(--radius-sm)',padding:'10px 14px',display:'flex',gap:16}}>
                    <div style={{textAlign:'center'}}><div style={{fontSize:11,color:'var(--text-muted)'}}>Saldo 1ª</div><div style={{fontWeight:700,color:'var(--green)',fontSize:18}}>{cargaSel.saldo_primeira} cx</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:11,color:'var(--text-muted)'}}>Saldo 2ª</div><div style={{fontWeight:700,color:'var(--amber)',fontSize:18}}>{cargaSel.saldo_segunda} cx</div></div>
                    <div style={{textAlign:'center'}}><div style={{fontSize:11,color:'var(--text-muted)'}}>Total disponível</div><div style={{fontWeight:700,fontSize:18}}>{cargaSel.saldo_primeira+cargaSel.saldo_segunda} cx</div></div>
                  </div>
                </div>
              )}
              <div className="form-group form-full"><label>Comprador *</label>
                {!form.usando_novo_comprador
                  ? <div style={{display:'flex',gap:8}}>
                      <select value={form.client_id} onChange={e=>{
                        const sel = compradores.find(c=>c.id===e.target.value)
                        setForm(f=>({...f,client_id:e.target.value,comprador:sel?.nome??''}))
                      }} style={{flex:1}}>
                        <option value="">— Selecione o cliente —</option>
                        {compradores.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                      <button type="button" className="btn btn-sm" onClick={()=>setForm(f=>({...f,usando_novo_comprador:true,client_id:'',comprador:''}))}>+ Novo</button>
                    </div>
                  : <div style={{display:'flex',gap:8}}>
                      <input autoFocus value={form.comprador_novo} onChange={e=>setForm(f=>({...f,comprador_novo:e.target.value}))} placeholder="Nome ou empresa" style={{flex:1}} />
                      <button type="button" className="btn btn-sm" onClick={()=>setForm(f=>({...f,usando_novo_comprador:false,comprador_novo:'',client_id:''}))}>← Lista</button>
                    </div>}
              </div>
              <div className="form-group"><label>Qtd 1ª (cx)</label><input type="number" inputMode="numeric" value={form.quantidade_primeira} onChange={e=>setForm(f=>({...f,quantidade_primeira:e.target.value}))} /></div>
              <div className="form-group"><label>Preço 1ª (R$/cx)</label><input type="number" inputMode="decimal" step="0.01" value={form.preco_primeira} onChange={e=>setForm(f=>({...f,preco_primeira:e.target.value}))} placeholder="0,00" /></div>
              <div className="form-group"><label>Qtd 2ª (cx)</label><input type="number" inputMode="numeric" value={form.quantidade_segunda} onChange={e=>setForm(f=>({...f,quantidade_segunda:e.target.value}))} /></div>
              <div className="form-group"><label>Preço 2ª (R$/cx)</label><input type="number" inputMode="decimal" step="0.01" value={form.preco_segunda} onChange={e=>setForm(f=>({...f,preco_segunda:e.target.value}))} placeholder="0,00" /></div>
              <div className="form-group form-full"><label>Valor total</label><input className="form-readonly" readOnly value={valorTotal!==null?fmt(valorTotal):''} style={{fontWeight:600,color:'var(--green)',fontSize:18}} /></div>
              <div className="form-group"><label>Pagamento</label>
                <select value={form.forma_pagamento} onChange={e=>setForm(f=>({...f,forma_pagamento:e.target.value,dias_prazo:'',data_vencimento:'',conta_vista_id:''}))}>
                  <option value="a_vista">À vista</option><option value="a_prazo">A prazo</option>
                </select>
              </div>
              {form.forma_pagamento==='a_vista'&&(
                <div className="form-group"><label>Conta que recebeu</label>
                  <select value={form.conta_vista_id??''} onChange={e=>setForm(f=>({...f,conta_vista_id:e.target.value}))}>
                    <option value="">— Opcional —</option>
                    {contas.map(c=><option key={c.id} value={c.id}>{tipoIconConta[c.tipo]??'🏦'} {c.nome} — {fmt(c.saldo_atual)}</option>)}
                  </select>
                </div>
              )}
              {form.forma_pagamento==='a_prazo'&&<>
                <div className="form-group"><label>Prazo (dias)</label><input type="number" inputMode="numeric" value={form.dias_prazo} onChange={e=>handleDiasPrazo(e.target.value)} placeholder="30" /></div>
                <div className="form-group form-full"><label>Vencimento</label><input className="form-readonly" readOnly value={form.data_vencimento?fmtDate(form.data_vencimento):''} style={{fontWeight:600,color:'var(--amber)'}} /></div>
              </>}
              <div className="form-group form-full"><label>Observações</label><textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{flex:1}}>{saving?'Salvando...':editId?'✓ Salvar':'✓ Registrar venda'}</button>
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
              <div style={{fontSize:22,fontWeight:700,color:'var(--teal)'}}>{fmt(modalReceber.valor_total)}</div>
            </div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Conta que recebeu *</label>
                <select value={recContaId} onChange={e=>setRecContaId(e.target.value)}>
                  <option value="">— Selecione —</option>
                  {contas.map(c=><option key={c.id} value={c.id}>{tipoIconConta[c.tipo]??'🏦'} {c.nome} — {fmt(c.saldo_atual)}</option>)}
                </select>
              </div>
              <div className="form-group form-full"><label>Data do recebimento</label><input type="date" value={recData} onChange={e=>setRecData(e.target.value)} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModalReceber(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarReceber} disabled={saving} style={{flex:1}}>{saving?'Confirmando...':'✓ Confirmar recebimento'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

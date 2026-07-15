import React, { useEffect, useState } from 'react'

import { supabase } from '../lib/supabase'

import { fmt, fmtDate, statusBadge, today, BtnExportar } from '../lib/utils'

import { useAuth } from '../contexts/AuthContext'



const EMPTY = { lote_id:'', data:today(), categoria_id:'', descricao:'', fornecedor:'', fornecedor_novo:'', usando_novo_forn:false, valor:'', status_pagamento:'pendente', dias_prazo:'', data_vencimento:'', tipo_parcelamento:'avista', num_parcelas:'', num_meses:'', observacoes:'' }

const COLS_EXPORT = [

  { label:'Data', accessor: r => fmtDate(r.data) },

  { label:'Lote', accessor: r => r.lotes?.nome??'Geral' },

  { label:'Categoria', accessor: r => r.categorias?.nome??r.categoria },

  { label:'Descrição', key:'descricao' },

  { label:'Fornecedor', key:'fornecedor' },

  { label:'Valor', accessor: r => fmt(r.valor) },

  { label:'Vencimento', accessor: r => fmtDate(r.data_vencimento) },

  { label:'Status', key:'status_pagamento' },

]



export default function Custos({ onAddBtn }) {

  const { tenantId, handleAuthError } = useAuth()

  const [lotes, setLotes]           = useState([])

  const [categorias, setCategorias] = useState([])

  const [custos, setCustos]         = useState([])

  const [filtrados, setFiltrados]   = useState([])

  const [contas, setContas]         = useState([])

  const [fornecedores, setFornecedores] = useState([])

  const [loading, setLoading]       = useState(true)

  const [modal, setModal]           = useState(false)

  const [modalCat, setModalCat]     = useState(false)

  const [modalPagar, setModalPagar] = useState(null)

  const [modalEditarMassa, setModalEditarMassa] = useState(false)

  const [modalPagarMassa, setModalPagarMassa]   = useState(false)

  const [formMassa, setFormMassa]   = useState({ lote_id:'', categoria_id:'', fornecedor:'', fornecedor_novo:'', usando_novo_forn_massa:false, data_vencimento:'', dias_prazo:'' })

  const [novaCat, setNovaCat]       = useState('')

  const [form, setForm]             = useState(EMPTY)

  const [editId, setEditId]         = useState(null)

  const [saving, setSaving]         = useState(false)

  const [filtro, setFiltro]         = useState('todos')

  const [dataIni, setDataIni]       = useState('')

  const [dataFim, setDataFim]       = useState('')

  const [ordem, setOrdem]           = useState('desc')

  const [selecionados, setSelecionados] = useState([])

  const [pagContaId, setPagContaId] = useState('')

  const [pagData, setPagData]       = useState(today())

  const lotesRef = React.useRef([])



  useEffect(() => { load() }, [])

  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])

  useEffect(() => { aplicarFiltros() }, [custos, filtro, dataIni, dataFim, ordem])



  async function load() {

    setLoading(true)

    try {

    const timeout = new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo esgotado ao carregar custos.')),20000))

    const [{ data: ls }, { data: cs }, { data: cats }, { data: cfs }] = await Promise.race([
      Promise.all([

        supabase.from('lotes').select('id,nome').neq('status','inativo').order('nome'),

        supabase.from('custos').select('*,lotes(nome),categorias(nome)').or('observacoes.is.null,observacoes.neq.ATIVIDADE_AUTOMATICO').order('data_custo',{ascending:false}).limit(200),

        supabase.from('categorias').select('*').eq('tipo','custo').order('nome'),

        supabase.from('contas_financeiras').select('id,nome,tipo,saldo_atual').eq('ativo',true).order('nome'),

      ]),
      timeout
    ])

    lotesRef.current = ls??[]

    setLotes(ls??[]); setCustos(cs??[]); setCategorias(cats??[]); setContas(cfs??[])

    const forns_res = await supabase.from('suppliers').select('id,nome,categoria').is('deleted_at',null).order('nome')

    setFornecedores(forns_res.data ?? [])

    setSelecionados([])

    } catch (e) {
      console.error('[Custos.load]', e)
      if (!handleAuthError(e)) alert('Erro ao carregar: ' + (e.message || JSON.stringify(e)))
    } finally {

      setLoading(false)

    }

  }



  function aplicarFiltros() {

    let lista=[...custos]

    if (filtro==='pendente') lista=lista.filter(c=>['pendente','atrasado'].includes(c.status_pagamento))

    if (filtro==='pago') lista=lista.filter(c=>c.status_pagamento==='pago')

    if (dataIni) lista=lista.filter(c=>(c.data_custo||c.data)>=dataIni)

    if (dataFim) lista=lista.filter(c=>(c.data_custo||c.data)<=dataFim)

    lista.sort((a,b)=>{

      const da = a.data_custo||a.data||''

      const db = b.data_custo||b.data||''

      return ordem==='asc'?da.localeCompare(db):db.localeCompare(da)

    })

    setFiltrados(lista)

    setSelecionados([])

  }



  function toggleSel(id) { setSelecionados(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]) }

  function toggleTodos() {

    const pendFilt=filtrados.filter(c=>['pendente','atrasado'].includes(c.status_pagamento))

    if (selecionados.length===pendFilt.length) setSelecionados([])

    else setSelecionados(pendFilt.map(c=>c.id))

  }



  function openModal(c=null) {

    if (c) {

      setForm({lote_id:c.lote_id??'',data:c.data?.split('T')[0]??today(),categoria_id:c.categoria_id??'',descricao:c.descricao,fornecedor:c.fornecedor??'',fornecedor_novo:'',usando_novo_forn:false,valor:c.valor,status_pagamento:c.status_pagamento,dias_prazo:'',data_vencimento:c.data_vencimento?.split('T')[0]??'',tipo_parcelamento:'avista',num_parcelas:'',num_meses:'',observacoes:c.observacoes??''})

      setEditId(c.id)

    } else { setForm({...EMPTY,lote_id:''}); setEditId(null) }

    setModal(true)

  }

  function closeModal() { setModal(false); setEditId(null) }



  function handleDias(dias) {

    const n=parseInt(dias)

    const venc=n>0?new Date(new Date(form.data).getTime()+n*86400000).toISOString().split('T')[0]:''

    setForm(f=>({...f,dias_prazo:dias,data_vencimento:venc}))

  }



  async function salvarCategoria() {

    if (!novaCat.trim()) return

    const {data}=await supabase.from('categorias').insert({nome:novaCat.trim(),tipo:'custo',tenant_id:tenantId}).select().single()

    if (data){setCategorias(c=>[...c,data].sort((a,b)=>a.nome.localeCompare(b.nome)));setForm(f=>({...f,categoria_id:data.id}))}

    setNovaCat('');setModalCat(false)

  }



  const fornFinal = form.usando_novo_forn ? form.fornecedor_novo : form.fornecedor



  async function save() {

    if (!form.data) return alert('Informe a data.')

    if (!form.valor || parseFloat(form.valor)<=0) return alert('Informe o valor.')

    if (!form.categoria_id) return alert('Selecione a categoria.')

    if (!fornFinal) return alert('Informe o fornecedor.')

    setSaving(true)

    try {

      const catNome=categorias.find(c=>c.id===form.categoria_id)?.nome??''

      const base={lote_id:form.lote_id||null,data:form.data,data_custo:form.data,categoria_id:form.categoria_id||null,categoria:catNome,descricao:form.descricao||catNome,fornecedor:fornFinal,observacoes:form.observacoes||null}

      const timeout = new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo esgotado.')),30000))

      let res

      if (editId){

        res = await supabase.from('custos').update({...base,valor:parseFloat(form.valor),status_pagamento:form.status_pagamento,data_vencimento:form.data_vencimento||null}).eq('id',editId)

      } else if (form.tipo_parcelamento==='parcelado'&&parseInt(form.num_parcelas)>1){

        res = await Promise.race([supabase.rpc('fn_gerar_parcelas_custo',{p_lote_id:form.lote_id||null,p_data_competencia:form.data,p_categoria:catNome,p_descricao:form.descricao||catNome,p_fornecedor:fornFinal,p_valor_total:parseFloat(form.valor),p_num_parcelas:parseInt(form.num_parcelas),p_primeiro_venc:form.data_vencimento,p_observacoes:form.observacoes||null,p_tenant_id:tenantId}),timeout])

      } else if (form.tipo_parcelamento==='mensal'&&parseInt(form.num_meses)>1){

        res = await Promise.race([supabase.rpc('fn_gerar_mensal_custo',{p_lote_id:form.lote_id||null,p_data_competencia:form.data,p_categoria:catNome,p_descricao:form.descricao||catNome,p_fornecedor:fornFinal,p_valor:parseFloat(form.valor),p_num_meses:parseInt(form.num_meses),p_primeiro_venc:form.data_vencimento,p_observacoes:form.observacoes||null,p_tenant_id:tenantId}),timeout])

      } else {

        res = await supabase.from('custos').insert({...base,valor:parseFloat(form.valor),status_pagamento:form.status_pagamento,data_vencimento:form.data_vencimento||null,tipo_parcelamento:'avista',tenant_id:tenantId})

      }

      if (res?.error) throw res.error

      closeModal()

      load()

    } catch(e) {

      console.error('[Custos.save] erro:', e)

      if (!handleAuthError(e)) alert('Erro ao salvar: ' + (e.message || JSON.stringify(e)))

    } finally {

      setSaving(false)

    }

  }



  function abrirPagar(custo) { setModalPagar(custo); setPagContaId(contas[0]?.id??''); setPagData(today()) }



  async function confirmarPagar() {

    if (!pagContaId) return alert('Selecione a conta.')

    setSaving(true)

    try {

      const timeout = new Promise((_,reject)=>setTimeout(()=>reject(new Error('Tempo esgotado.')),30000))

      const { error } = await Promise.race([

        supabase.rpc('fn_pagar_custo',{p_custo_id:modalPagar.id,p_data_pagamento:pagData,p_conta_id:pagContaId}),

        timeout

      ])

      if (error) throw error

      setModalPagar(null);load()

    } catch(e) {

      console.error('[Custos.confirmarPagar]',e)

      if (!handleAuthError(e)) alert('Erro ao confirmar: '+(e.message||JSON.stringify(e)))

    } finally { setSaving(false) }

  }

  async function desfazerPagamento(id) {

    if (!window.confirm('Desfazer pagamento? O valor será removido do caixa e o custo voltará para pendente.')) return

    const { error } = await supabase.rpc('fn_desfazer_pagamento',{p_custo_id:id})

    if (error) { alert('Erro: '+error.message); return }

    load()

  }



  async function confirmarEditarMassa() {

    if (!selecionados.length) return

    setSaving(true)

    const updates={}

    if (formMassa.lote_id) updates.lote_id=formMassa.lote_id

    if (formMassa.categoria_id){updates.categoria_id=formMassa.categoria_id;updates.categoria=categorias.find(c=>c.id===formMassa.categoria_id)?.nome??''}

    const fornM=formMassa.usando_novo_forn_massa?formMassa.fornecedor_novo:formMassa.fornecedor

    if (fornM) updates.fornecedor=fornM

    if (formMassa.data_vencimento) updates.data_vencimento=formMassa.data_vencimento

    if (Object.keys(updates).length===0){alert('Selecione pelo menos um campo.');setSaving(false);return}

    for (const id of selecionados) await supabase.from('custos').update(updates).eq('id',id)

    setSaving(false);setModalEditarMassa(false);setFormMassa({lote_id:'',categoria_id:'',fornecedor:'',fornecedor_novo:'',usando_novo_forn_massa:false,data_vencimento:'',dias_prazo:''});setSelecionados([]);load()

  }



  async function confirmarPagarMassa() {

    if (!pagContaId) return alert('Selecione a conta.')

    if (!selecionados.length) return alert('Selecione pelo menos um custo.')

    setSaving(true)

    try {

      for (const id of selecionados) {

        const { error } = await supabase.rpc('fn_pagar_custo',{p_custo_id:id,p_data_pagamento:pagData,p_conta_id:pagContaId})

        if (error) throw error

      }

      setModalPagarMassa(false);setSelecionados([]);load()

    } catch(e) {

      console.error('[Custos.confirmarPagarMassa]',e)

      if (!handleAuthError(e)) alert('Erro: '+(e.message||JSON.stringify(e)))

    } finally { setSaving(false) }

  }

  async function excluir(id){

    if (!window.confirm('Excluir este custo?')) return

    await supabase.from('custos').delete().eq('id',id);load()

  }



  async function excluirMassa(){

    if (!selecionados.length) return

    if (!window.confirm(`Excluir ${selecionados.length} custo(s)?`)) return

    for (const id of selecionados) await supabase.from('custos').delete().eq('id',id)

    setSelecionados([]);load()

  }



  const totaisCat=filtrados.reduce((acc,c)=>{const n=c.categorias?.nome??c.categoria??'—';acc[n]=(acc[n]??0)+Number(c.valor);return acc},{})

  const tipoIconConta={caixa:'💵',banco:'🏦',carteira:'👛'}

  const pendFilt=filtrados.filter(c=>['pendente','atrasado'].includes(c.status_pagamento))

  const totalSelecionado=selecionados.reduce((s,id)=>{const c=custos.find(x=>x.id===id);return s+Number(c?.valor??0)},0)



  if (loading) return <div className="loading">Carregando custos...</div>



  return (

    <>

      {Object.keys(totaisCat).length>0&&(

        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>

          {Object.entries(totaisCat).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(

            <div key={cat} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 14px'}}>

              <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase'}}>{cat}</div>

              <div style={{fontSize:15,fontWeight:600,color:'var(--amber)',marginTop:2}}>{fmt(val)}</div>

            </div>

          ))}

        </div>

      )}



      <div className="card" style={{marginBottom:12,padding:'12px 16px'}}>

        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>

          <div className="form-group" style={{marginBottom:0}}><label>Data inicial</label><input type="date" value={dataIni} onChange={e=>setDataIni(e.target.value)} /></div>

          <div className="form-group" style={{marginBottom:0}}><label>Data final</label><input type="date" value={dataFim} onChange={e=>setDataFim(e.target.value)} /></div>

          <div className="form-group" style={{marginBottom:0}}><label>Ordenar</label>

            <select value={ordem} onChange={e=>setOrdem(e.target.value)}><option value="desc">Mais recente</option><option value="asc">Mais antigo</option></select>

          </div>

          <button className="btn btn-sm" onClick={()=>{setDataIni('');setDataFim('')}}>Limpar</button>

          <BtnExportar dados={filtrados} colunas={COLS_EXPORT} nome="custos" />

        </div>

      </div>



      {selecionados.length>0&&(

        <div style={{background:'var(--green-light)',border:'1px solid var(--green-mid)',borderRadius:'var(--radius-sm)',padding:'10px 16px',marginBottom:12,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>

          <span style={{fontWeight:600,color:'var(--green-dark)'}}>{selecionados.length} selecionado(s) — {fmt(totalSelecionado)}</span>

          <button className="btn btn-sm" style={{background:'var(--teal-light)',color:'var(--teal)',borderColor:'var(--teal)'}} onClick={()=>{setFormMassa({lote_id:'',categoria_id:'',fornecedor:'',fornecedor_novo:'',usando_novo_forn_massa:false,data_vencimento:'',dias_prazo:''});setModalEditarMassa(true)}}>✎ Editar todos</button>

          <button className="btn btn-primary btn-sm" onClick={()=>{setPagContaId(contas[0]?.id??'');setPagData(today());setModalPagarMassa(true)}}>✓ Pagar todos</button>

          <button className="btn btn-sm btn-danger" onClick={excluirMassa}>✕ Excluir todos</button>

          <button className="btn btn-sm" onClick={()=>setSelecionados([])}>Limpar seleção</button>

        </div>

      )}



      <div className="tabs">

        <button className={`tab ${filtro==='todos'?'active':''}`} onClick={()=>setFiltro('todos')}>Todos ({custos.length})</button>

        <button className={`tab ${filtro==='pendente'?'active':''}`} onClick={()=>setFiltro('pendente')}>A pagar ({custos.filter(c=>['pendente','atrasado'].includes(c.status_pagamento)).length})</button>

        <button className={`tab ${filtro==='pago'?'active':''}`} onClick={()=>setFiltro('pago')}>Pagos ({custos.filter(c=>c.status_pagamento==='pago').length})</button>

      </div>



      {filtrados.length===0

        ? <div className="empty">Nenhum custo encontrado.</div>

        : <div className="card">

            <div className="table-wrap">

              <table>

                <thead><tr>

                  <th style={{width:36}}>{pendFilt.length>0&&<input type="checkbox" checked={selecionados.length===pendFilt.length&&pendFilt.length>0} onChange={toggleTodos} style={{cursor:'pointer'}} />}</th>

                  <th>Data</th><th>Vencimento</th><th>Vencimento</th><th>Lote</th><th>Categoria</th><th>Descrição</th><th>Fornecedor</th><th>Valor</th><th>Venc.</th><th>Parcela</th><th>Status</th><th></th>

                </tr></thead>

                <tbody>

                  {filtrados.map(c=>{

                    const {cls,label}=statusBadge(c.status_pagamento)

                    const isPend=['pendente','atrasado'].includes(c.status_pagamento)

                    const isSel=selecionados.includes(c.id)

                    return (

                      <tr key={c.id} style={isSel?{background:'var(--green-light)'}:{}}>

                        <td>{isPend&&<input type="checkbox" checked={isSel} onChange={()=>toggleSel(c.id)} style={{cursor:'pointer'}} />}</td>

                        <td>{fmtDate(c.data_custo||c.data)}</td><td style={{fontSize:12,color:c.data_vencimento && new Date(c.data_vencimento) < new Date() && c.status_pagamento==='pendente' ? 'var(--red)' : 'var(--text-muted)'}}>{c.data_vencimento ? fmtDate(c.data_vencimento) : "—"}</td><td style={{fontSize:12, color: c.data_vencimento && new Date(c.data_vencimento) < new Date() && c.status_pagamento === "pendente" ? "var(--red)" : "var(--text-muted)"}}>{c.data_vencimento ? fmtDate(c.data_vencimento) : "—"}</td>

                        <td>{c.lotes?.nome??<span style={{color:'var(--text-muted)',fontSize:11}}>Geral</span>}</td>

                        <td><span className="badge badge-gray">{c.categorias?.nome??c.categoria??'—'}</span></td>

                        <td>{c.descricao}</td>

                        <td style={{color:'var(--text-muted)'}}>{c.fornecedor??'—'}</td>

                        <td style={{fontWeight:600,color:'var(--amber)'}}>{fmt(c.valor)}</td>

                        <td>{c.data_vencimento?<span style={{color:c.status_pagamento==='atrasado'?'var(--red)':'inherit',fontWeight:c.status_pagamento==='atrasado'?600:400}}>{fmtDate(c.data_vencimento)}</span>:'—'}</td>

                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{c.parcela_total>1?`${c.parcela_numero}/${c.parcela_total}`:'—'}{c.tipo_parcelamento==='mensal'&&' 🔁'}</td>

                        <td><span className={`badge ${cls}`}>{label}</span></td>

                        <td><div style={{display:'flex',gap:4}}>

                          {isPend&&<button className="btn btn-sm btn-primary" onClick={()=>abrirPagar(c)}>✓</button>}

                          {c.status_pagamento==='pago'&&<button className="btn btn-sm" style={{color:'var(--amber)',borderColor:'var(--amber-light)',background:'var(--amber-light)'}} onClick={()=>desfazerPagamento(c.id)} title="Desfazer pagamento">↩</button>}

                          <button className="btn btn-sm" onClick={()=>openModal(c)}>✎</button>

                          <button className="btn btn-sm btn-danger" onClick={()=>excluir(c.id)}>✕</button>

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

            <div className="modal-header"><h3>{editId?'Editar custo':'Novo custo'}</h3><button className="modal-close" onClick={closeModal}>✕</button></div>

            <div className="form-grid">

              <div className="form-group"><label>Lote (opcional)</label>

                <select value={form.lote_id} onChange={e=>setForm(f=>({...f,lote_id:e.target.value}))}>

                  <option value="">— Geral —</option>

                  {lotes.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}

                </select>

              </div>

              <div className="form-group"><label>Data *</label>

                <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} />

              </div>

              <div className="form-group"><label>Valor (R$) *</label>

                <input type="number" inputMode="decimal" step="0.01" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} placeholder="0,00" />

              </div>

              <div className="form-group" style={{display:'flex',gap:8,alignItems:'flex-end'}}>

                <div style={{flex:1}}><label>Categoria *</label>

                  <select value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))}>

                    <option value="">— Selecione —</option>

                    {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}

                  </select>

                </div>

                <button type="button" className="btn btn-sm" style={{marginBottom:2}} onClick={()=>setModalCat(true)}>+ Nova</button>

              </div>

              <div className="form-group form-full"><label>Descrição</label>

                <input value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="ex: Adubo NPK 25kg (opcional)" />

              </div>

              <div className="form-group form-full"><label>Fornecedor *</label>

                {!form.usando_novo_forn

                  ? <div style={{display:'flex',gap:8}}>

                      <select value={form.fornecedor} onChange={e=>{

                        const sel=fornecedores.find(f=>f.id===e.target.value)

                        setForm(f=>({...f,fornecedor:sel?.nome??e.target.value,supplier_id:e.target.value}))

                      }} style={{flex:1}}>

                        <option value="">— Selecione —</option>

                        {fornecedores.map(f=><option key={f.id} value={f.id}>{f.nome}</option>)}

                      </select>

                      <button type="button" className="btn btn-sm" onClick={()=>setForm(f=>({...f,usando_novo_forn:true,fornecedor:'',supplier_id:''}))}>+ Novo</button>

                    </div>

                  : <div style={{display:'flex',gap:8}}>

                      <input autoFocus value={form.fornecedor_novo} onChange={e=>setForm(f=>({...f,fornecedor_novo:e.target.value}))} placeholder="Nome do fornecedor" style={{flex:1}} />

                      <button type="button" className="btn btn-sm" onClick={()=>setForm(f=>({...f,usando_novo_forn:false,fornecedor_novo:''}))}>← Lista</button>

                    </div>}

              </div>

              <div className="form-group"><label>Status</label>

                <select value={form.status_pagamento} onChange={e=>setForm(f=>({...f,status_pagamento:e.target.value}))}>

                  <option value="pendente">A pagar</option><option value="pago">Já pago</option>

                </select>

              </div>

              {!editId&&(<div className="form-group form-full"><label>Tipo</label>

                <select value={form.tipo_parcelamento} onChange={e=>setForm(f=>({...f,tipo_parcelamento:e.target.value,num_parcelas:'',num_meses:''}))}>

                  <option value="avista">à vista</option><option value="parcelado">📦 Parcelado</option><option value="mensal">🔁 Mensal</option>

                </select>

              </div>)}

              {form.tipo_parcelamento==='parcelado'&&!editId&&(

                <div className="form-group"><label>Nº parcelas</label>

                  <input type="number" min="2" value={form.num_parcelas} onChange={e=>setForm(f=>({...f,num_parcelas:e.target.value}))} />

                  {form.num_parcelas>1&&form.valor&&<span className="form-hint">Cada: {fmt(parseFloat(form.valor)/parseInt(form.num_parcelas))}</span>}

                </div>

              )}

              {form.tipo_parcelamento==='mensal'&&!editId&&(

                <div className="form-group"><label>Repetir (meses)</label>

                  <input type="number" min="2" value={form.num_meses} onChange={e=>setForm(f=>({...f,num_meses:e.target.value}))} />

                </div>

              )}

              {form.status_pagamento==='pendente'&&<>

                <div className="form-group"><label>Prazo (dias)</label>

                  <input type="number" inputMode="numeric" value={form.dias_prazo} onChange={e=>handleDias(e.target.value)} placeholder="30" />

                </div>

                <div className="form-group"><label>Vencimento</label>

                  <input className={form.dias_prazo?'form-readonly':''} readOnly={!!form.dias_prazo} type={form.dias_prazo?'text':'date'} value={form.dias_prazo?(form.data_vencimento?fmtDate(form.data_vencimento):''):form.data_vencimento} onChange={e=>!form.dias_prazo&&setForm(f=>({...f,data_vencimento:e.target.value}))} style={form.dias_prazo?{fontWeight:600,color:'var(--amber)'}:{}} />

                </div>

              </>}

              <div className="form-group form-full"><label>Observações</label>

                <textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} />

              </div>

            </div>

            <div className="modal-footer">

              <button className="btn" onClick={closeModal}>Cancelar</button>

              <button className="btn btn-primary" onClick={save} disabled={saving} style={{flex:1}}>{saving?'Salvando...':editId?'✓ Salvar':'✓ Salvar custo'}</button>

            </div>

          </div>

        </div>

      )}



      {modalCat&&(

        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalCat(false)}>

          <div className="modal" style={{maxWidth:360}}>

            <div className="modal-header"><h3>Nova categoria</h3><button className="modal-close" onClick={()=>setModalCat(false)}>✕</button></div>

            <div className="form-group" style={{marginBottom:16}}><label>Nome</label><input autoFocus value={novaCat} onChange={e=>setNovaCat(e.target.value)} placeholder="ex: Defensivo agrícola" onKeyDown={e=>e.key==='Enter'&&salvarCategoria()} /></div>

            <div className="modal-footer"><button className="btn" onClick={()=>setModalCat(false)}>Cancelar</button><button className="btn btn-primary" onClick={salvarCategoria}>Criar</button></div>

          </div>

        </div>

      )}



      {modalPagar&&(

        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalPagar(null)}>

          <div className="modal" style={{maxWidth:420}}>

            <div className="modal-header"><h3>Confirmar pagamento</h3><button className="modal-close" onClick={()=>setModalPagar(null)}>✕</button></div>

            <div style={{background:'var(--amber-light)',borderRadius:'var(--radius-sm)',padding:'12px 14px',marginBottom:16}}>

              <div style={{fontSize:12,color:'var(--amber)',marginBottom:4}}>{modalPagar.descricao}{modalPagar.fornecedor&&` — ${modalPagar.fornecedor}`}</div>

              <div style={{fontSize:22,fontWeight:700,fontFamily:'var(--font-display)',color:'var(--amber)'}}>{fmt(modalPagar.valor)}</div>

            </div>

            <div className="form-grid">

              <div className="form-group form-full"><label>Pagar com qual conta *</label>

                <select value={pagContaId} onChange={e=>setPagContaId(e.target.value)}>

                  <option value="">— Selecione —</option>

                  {contas.map(c=><option key={c.id} value={c.id}>{tipoIconConta[c.tipo]??'🏦'} {c.nome} — {fmt(c.saldo_atual)}</option>)}

                </select>

              </div>

              <div className="form-group form-full"><label>Data do pagamento</label>

                <input type="date" value={pagData} onChange={e=>setPagData(e.target.value)} />

              </div>

            </div>

            <div className="modal-footer">

              <button className="btn" onClick={()=>setModalPagar(null)}>Cancelar</button>

              <button className="btn btn-primary" onClick={confirmarPagar} disabled={saving} style={{flex:1}}>{saving?'Confirmando...':'✓ Confirmar'}</button>

            </div>

          </div>

        </div>

      )}



      {modalEditarMassa&&(

        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalEditarMassa(false)}>

          <div className="modal" style={{maxWidth:480}}>

            <div className="modal-header"><h3>Editar {selecionados.length} custo(s)</h3><button className="modal-close" onClick={()=>setModalEditarMassa(false)}>✕</button></div>

            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:16}}>Preencha apenas os campos que deseja alterar.</p>

            <div className="form-grid">

              <div className="form-group"><label>Lote</label>

                <select value={formMassa.lote_id} onChange={e=>setFormMassa(f=>({...f,lote_id:e.target.value}))}>

                  <option value="">— Não alterar —</option>

                  {lotes.map(l=><option key={l.id} value={l.id}>{l.nome}</option>)}

                </select>

              </div>

              <div className="form-group"><label>Categoria</label>

                <select value={formMassa.categoria_id} onChange={e=>setFormMassa(f=>({...f,categoria_id:e.target.value}))}>

                  <option value="">— Não alterar —</option>

                  {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}

                </select>

              </div>

              <div className="form-group form-full"><label>Fornecedor</label>

                {!formMassa.usando_novo_forn_massa

                  ? <div style={{display:'flex',gap:8}}>

                      <select value={formMassa.fornecedor} onChange={e=>setFormMassa(f=>({...f,fornecedor:e.target.value}))} style={{flex:1}}>

                        <option value="">— Não alterar —</option>

                        {fornecedores.map(f=><option key={f} value={f}>{f}</option>)}

                      </select>

                      <button type="button" className="btn btn-sm" onClick={()=>setFormMassa(f=>({...f,usando_novo_forn_massa:true,fornecedor:''}))}>+ Novo</button>

                    </div>

                  : <div style={{display:'flex',gap:8}}>

                      <input autoFocus value={formMassa.fornecedor_novo} onChange={e=>setFormMassa(f=>({...f,fornecedor_novo:e.target.value}))} placeholder="Nome" style={{flex:1}} />

                      <button type="button" className="btn btn-sm" onClick={()=>setFormMassa(f=>({...f,usando_novo_forn_massa:false,fornecedor_novo:''}))}>← Lista</button>

                    </div>}

              </div>

              <div className="form-group"><label>Prazo (dias)</label>

                <input type="number" inputMode="numeric" value={formMassa.dias_prazo}

                  onChange={e=>{const n=parseInt(e.target.value);const venc=n>0?new Date(Date.now()+n*86400000).toISOString().split('T')[0]:'';setFormMassa(f=>({...f,dias_prazo:e.target.value,data_vencimento:venc}))}} placeholder="ex: 30" />

              </div>

              <div className="form-group"><label>Novo vencimento</label>

                <input className={formMassa.dias_prazo?'form-readonly':''} readOnly={!!formMassa.dias_prazo} type={formMassa.dias_prazo?'text':'date'} value={formMassa.dias_prazo?(formMassa.data_vencimento?fmtDate(formMassa.data_vencimento):''):formMassa.data_vencimento} onChange={e=>!formMassa.dias_prazo&&setFormMassa(f=>({...f,data_vencimento:e.target.value}))} style={formMassa.dias_prazo?{fontWeight:600,color:'var(--amber)'}:{}} />

              </div>

            </div>

            <div className="modal-footer">

              <button className="btn" onClick={()=>setModalEditarMassa(false)}>Cancelar</button>

              <button className="btn btn-primary" onClick={confirmarEditarMassa} disabled={saving} style={{flex:1}}>{saving?'Salvando...':'✓ Aplicar alterações'}</button>

            </div>

          </div>

        </div>

      )}



      {modalPagarMassa&&(

        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalPagarMassa(false)}>

          <div className="modal" style={{maxWidth:420}}>

            <div className="modal-header"><h3>Pagar {selecionados.length} custo(s)</h3><button className="modal-close" onClick={()=>setModalPagarMassa(false)}>✕</button></div>

            <div style={{background:'var(--amber-light)',borderRadius:'var(--radius-sm)',padding:'12px 14px',marginBottom:16}}>

              <div style={{fontSize:12,color:'var(--amber)',marginBottom:4}}>{selecionados.length} custo(s) selecionado(s)</div>

              <div style={{fontSize:22,fontWeight:700,fontFamily:'var(--font-display)',color:'var(--amber)'}}>{fmt(totalSelecionado)}</div>

            </div>

            <div className="form-grid">

              <div className="form-group form-full"><label>Pagar com qual conta *</label>

                <select value={pagContaId} onChange={e=>setPagContaId(e.target.value)}>

                  <option value="">— Selecione —</option>

                  {contas.map(c=><option key={c.id} value={c.id}>{tipoIconConta[c.tipo]??'🏦'} {c.nome} — {fmt(c.saldo_atual)}</option>)}

                </select>

              </div>

              <div className="form-group form-full"><label>Data do pagamento</label>

                <input type="date" value={pagData} onChange={e=>setPagData(e.target.value)} />

              </div>

            </div>

            <div className="modal-footer">

              <button className="btn" onClick={()=>setModalPagarMassa(false)}>Cancelar</button>

              <button className="btn btn-primary" onClick={confirmarPagarMassa} disabled={saving} style={{flex:1}}>{saving?'Processando...':'✓ Confirmar pagamento em massa'}</button>

            </div>

          </div>

        </div>

      )}

    </>

  )

}




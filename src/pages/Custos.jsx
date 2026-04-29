import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, statusBadge, today, BtnExportar } from '../lib/utils'

const EMPTY = { lote_id:'', data:today(), categoria_id:'', descricao:'', fornecedor:'', valor:'', status_pagamento:'pendente', dias_prazo:'', data_vencimento:'', tipo_parcelamento:'avista', num_parcelas:'', num_meses:'', observacoes:'' }
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
  const [lotes, setLotes]           = useState([])
  const [categorias, setCategorias] = useState([])
  const [custos, setCustos]         = useState([])
  const [filtrados, setFiltrados]   = useState([])
  const [contas, setContas]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [modalCat, setModalCat]     = useState(false)
  const [modalPagar, setModalPagar] = useState(null)
  const [novaCat, setNovaCat]       = useState('')
  const [form, setForm]             = useState(EMPTY)
  const [editId, setEditId]         = useState(null)
  const [saving, setSaving]         = useState(false)
  const [filtro, setFiltro]         = useState('todos')
  const [dataIni, setDataIni]       = useState('')
  const [dataFim, setDataFim]       = useState('')
  const [ordem, setOrdem]           = useState('desc')
  // Modal pagar
  const [pagContaId, setPagContaId] = useState('')
  const [pagData, setPagData]       = useState(today())
  const lotesRef = React.useRef([])

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])
  useEffect(() => { aplicarFiltros() }, [custos, filtro, dataIni, dataFim, ordem])

  async function load() {
    setLoading(true)
    const [{ data: ls }, { data: cs }, { data: cats }, { data: cfs }] = await Promise.all([
      supabase.from('lotes').select('id,nome').neq('status','inativo').order('nome'),
      supabase.from('custos').select('*,lotes(nome),categorias(nome)').order('data',{ascending:false}).limit(100),
      supabase.from('categorias').select('*').eq('tipo','custo').order('nome'),
      supabase.from('contas_financeiras').select('id,nome,tipo,saldo_atual').eq('ativo',true).order('nome'),
    ])
    lotesRef.current = ls??[]
    setLotes(ls??[]); setCustos(cs??[]); setCategorias(cats??[]); setContas(cfs??[])
    setLoading(false)
  }

  function aplicarFiltros() {
    let lista=[...custos]
    if (filtro==='pendente') lista=lista.filter(c=>['pendente','atrasado'].includes(c.status_pagamento))
    if (filtro==='pago') lista=lista.filter(c=>c.status_pagamento==='pago')
    if (dataIni) lista=lista.filter(c=>c.data>=dataIni)
    if (dataFim) lista=lista.filter(c=>c.data<=dataFim)
    lista.sort((a,b)=>ordem==='asc'?a.data.localeCompare(b.data):b.data.localeCompare(a.data))
    setFiltrados(lista)
  }

  function openModal(c=null) {
    if (c) {
      setForm({lote_id:c.lote_id??'',data:c.data?.split('T')[0]??today(),categoria_id:c.categoria_id??'',descricao:c.descricao,fornecedor:c.fornecedor??'',valor:c.valor,status_pagamento:c.status_pagamento,dias_prazo:'',data_vencimento:c.data_vencimento?.split('T')[0]??'',tipo_parcelamento:'avista',num_parcelas:'',num_meses:'',observacoes:c.observacoes??''})
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
    const {data}=await supabase.from('categorias').insert({nome:novaCat.trim(),tipo:'custo'}).select().single()
    if (data){setCategorias(c=>[...c,data].sort((a,b)=>a.nome.localeCompare(b.nome)));setForm(f=>({...f,categoria_id:data.id}))}
    setNovaCat('');setModalCat(false)
  }

  async function save() {
    if (!form.descricao||!form.valor) return alert('Preencha descrição e valor.')
    setSaving(true)
    const catNome=categorias.find(c=>c.id===form.categoria_id)?.nome??''
    const base={lote_id:form.lote_id||null,data:form.data,categoria_id:form.categoria_id||null,categoria:catNome,descricao:form.descricao,fornecedor:form.fornecedor||null,observacoes:form.observacoes||null}
    if (editId){
      await supabase.from('custos').update({...base,valor:parseFloat(form.valor),status_pagamento:form.status_pagamento,data_vencimento:form.data_vencimento||null}).eq('id',editId)
    } else if (form.tipo_parcelamento==='parcelado'&&parseInt(form.num_parcelas)>1){
      await supabase.rpc('fn_gerar_parcelas_custo',{p_lote_id:form.lote_id||null,p_data_competencia:form.data,p_categoria:catNome,p_descricao:form.descricao,p_fornecedor:form.fornecedor||null,p_valor_total:parseFloat(form.valor),p_num_parcelas:parseInt(form.num_parcelas),p_primeiro_venc:form.data_vencimento,p_observacoes:form.observacoes||null})
    } else if (form.tipo_parcelamento==='mensal'&&parseInt(form.num_meses)>1){
      await supabase.rpc('fn_gerar_mensal_custo',{p_lote_id:form.lote_id||null,p_data_competencia:form.data,p_categoria:catNome,p_descricao:form.descricao,p_fornecedor:form.fornecedor||null,p_valor:parseFloat(form.valor),p_num_meses:parseInt(form.num_meses),p_primeiro_venc:form.data_vencimento,p_observacoes:form.observacoes||null})
    } else {
      await supabase.from('custos').insert({...base,valor:parseFloat(form.valor),status_pagamento:form.status_pagamento,data_vencimento:form.data_vencimento||null,tipo_parcelamento:'avista'})
    }
    setSaving(false);closeModal();load()
  }

  function abrirPagar(custo) {
    setModalPagar(custo)
    setPagContaId(contas[0]?.id??'')
    setPagData(today())
  }

  async function confirmarPagar() {
    if (!pagContaId) return alert('Selecione a conta.')
    setSaving(true)
    const { error } = await supabase.rpc('fn_pagar_custo', {
      p_custo_id: modalPagar.id,
      p_data_pagamento: pagData,
      p_conta_id: pagContaId,
    })
    if (error) { alert('Erro: ' + error.message); setSaving(false); return }
    setSaving(false); setModalPagar(null); load()
  }

  async function excluir(id){
    if (!window.confirm('Excluir este custo?')) return
    await supabase.from('custos').delete().eq('id',id);load()
  }

  const totaisCat = filtrados.reduce((acc,c)=>{const n=c.categorias?.nome??c.categoria??'—';acc[n]=(acc[n]??0)+Number(c.valor);return acc},{})
  const tipoIconConta={caixa:'💵',banco:'🏦',carteira:'👛'}

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
                <thead><tr><th>Data</th><th>Lote</th><th>Categoria</th><th>Descrição</th><th>Fornecedor</th><th>Valor</th><th>Venc.</th><th>Parcela</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtrados.map(c=>{
                    const {cls,label}=statusBadge(c.status_pagamento)
                    return (
                      <tr key={c.id}>
                        <td>{fmtDate(c.data)}</td>
                        <td>{c.lotes?.nome??<span style={{color:'var(--text-muted)',fontSize:11}}>Geral</span>}</td>
                        <td><span className="badge badge-gray">{c.categorias?.nome??c.categoria??'—'}</span></td>
                        <td>{c.descricao}</td>
                        <td style={{color:'var(--text-muted)'}}>{c.fornecedor??'—'}</td>
                        <td style={{fontWeight:600,color:'var(--amber)'}}>{fmt(c.valor)}</td>
                        <td>{c.data_vencimento?<span style={{color:c.status_pagamento==='atrasado'?'var(--red)':'inherit',fontWeight:c.status_pagamento==='atrasado'?600:400}}>{fmtDate(c.data_vencimento)}</span>:'—'}</td>
                        <td style={{fontSize:12,color:'var(--text-muted)'}}>{c.parcela_total>1?`${c.parcela_numero}/${c.parcela_total}`:'—'}{c.tipo_parcelamento==='mensal'&&' 🔁'}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td><div style={{display:'flex',gap:4}}>
                          {['pendente','atrasado'].includes(c.status_pagamento)&&
                            <button className="btn btn-sm btn-primary" onClick={()=>abrirPagar(c)}>✓ Pagar</button>}
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
              <div className="form-group"><label>Data *</label><input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} /></div>
              <div className="form-group"><label>Valor (R$) *</label><input type="number" inputMode="decimal" step="0.01" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} placeholder="0,00" /></div>
              <div className="form-group" style={{display:'flex',gap:8,alignItems:'flex-end'}}>
                <div style={{flex:1}}><label>Categoria</label>
                  <select value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))}>
                    <option value="">— Selecione —</option>
                    {categorias.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <button type="button" className="btn btn-sm" style={{marginBottom:2}} onClick={()=>setModalCat(true)}>+ Nova</button>
              </div>
              <div className="form-group form-full"><label>Descrição *</label><input value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="ex: Adubo NPK 25kg" /></div>
              <div className="form-group"><label>Fornecedor</label><input value={form.fornecedor} onChange={e=>setForm(f=>({...f,fornecedor:e.target.value}))} placeholder="Nome do fornecedor" /></div>
              <div className="form-group"><label>Status</label>
                <select value={form.status_pagamento} onChange={e=>setForm(f=>({...f,status_pagamento:e.target.value}))}>
                  <option value="pendente">A pagar</option><option value="pago">Já pago</option>
                </select>
              </div>
              {!editId&&(<div className="form-group form-full"><label>Tipo</label>
                <select value={form.tipo_parcelamento} onChange={e=>setForm(f=>({...f,tipo_parcelamento:e.target.value,num_parcelas:'',num_meses:''}))}>
                  <option value="avista">À vista</option><option value="parcelado">📦 Parcelado</option><option value="mensal">🔁 Mensal</option>
                </select>
              </div>)}
              {form.tipo_parcelamento==='parcelado'&&!editId&&(
                <div className="form-group"><label>Nº parcelas</label><input type="number" min="2" value={form.num_parcelas} onChange={e=>setForm(f=>({...f,num_parcelas:e.target.value}))} />
                  {form.num_parcelas>1&&form.valor&&<span className="form-hint">Cada: {fmt(parseFloat(form.valor)/parseInt(form.num_parcelas))}</span>}
                </div>
              )}
              {form.tipo_parcelamento==='mensal'&&!editId&&(
                <div className="form-group"><label>Repetir (meses)</label><input type="number" min="2" value={form.num_meses} onChange={e=>setForm(f=>({...f,num_meses:e.target.value}))} /></div>
              )}
              {form.status_pagamento==='pendente'&&<>
                <div className="form-group"><label>Prazo (dias)</label><input type="number" inputMode="numeric" value={form.dias_prazo} onChange={e=>handleDias(e.target.value)} placeholder="30" /></div>
                <div className="form-group"><label>Vencimento</label>
                  <input className={form.dias_prazo?'form-readonly':''} readOnly={!!form.dias_prazo} type={form.dias_prazo?'text':'date'} value={form.dias_prazo?(form.data_vencimento?fmtDate(form.data_vencimento):''):form.data_vencimento} onChange={e=>!form.dias_prazo&&setForm(f=>({...f,data_vencimento:e.target.value}))} style={form.dias_prazo?{fontWeight:600,color:'var(--amber)'}:{}} />
                </div>
              </>}
              <div className="form-group form-full"><label>Observações</label><textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))} /></div>
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

      {/* Modal pagar com seleção de conta */}
      {modalPagar&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalPagar(null)}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header"><h3>Confirmar pagamento</h3><button className="modal-close" onClick={()=>setModalPagar(null)}>✕</button></div>
            <div style={{background:'var(--amber-light)',borderRadius:'var(--radius-sm)',padding:'12px 14px',marginBottom:16}}>
              <div style={{fontSize:12,color:'var(--amber)',marginBottom:4}}>{modalPagar.descricao}{modalPagar.fornecedor&&` — ${modalPagar.fornecedor}`}</div>
              <div style={{fontSize:22,fontWeight:700,fontFamily:'var(--font-display)',color:'var(--amber)'}}>{fmt(modalPagar.valor)}</div>
            </div>
            <div className="form-grid">
              <div className="form-group form-full">
                <label>Pagar com qual conta *</label>
                <select value={pagContaId} onChange={e=>setPagContaId(e.target.value)}>
                  <option value="">— Selecione a conta —</option>
                  {contas.map(c=>(
                    <option key={c.id} value={c.id}>{tipoIconConta[c.tipo]??'🏦'} {c.nome} — saldo: {fmt(c.saldo_atual)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group form-full">
                <label>Data do pagamento</label>
                <input type="date" value={pagData} onChange={e=>setPagData(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModalPagar(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmarPagar} disabled={saving} style={{flex:1}}>{saving?'Confirmando...':'✓ Confirmar pagamento'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

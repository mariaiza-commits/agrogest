import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, statusBadge, today, BtnExportar } from '../lib/utils'

function VencBadge({ dataVenc, status }) {
  if (!dataVenc) return <span style={{color:'var(--text-muted)',fontSize:12}}>—</span>
  const dias = Math.floor((new Date()-new Date(dataVenc))/86400000)
  if (status==='atrasado'||dias>0) return <span className="badge badge-red">🔴 {dias}d</span>
  if (dias>-4) return <span className="badge badge-amber">⚠ {Math.abs(dias)}d</span>
  return <span style={{fontSize:12}}>{fmtDate(dataVenc)}</span>
}

function GrupoReceber({ g, onReceber }) {
  const [open,setOpen]=useState(false)
  const pend=g.vendas_pendentes??[]
  const atrasado=Number(g.total_atrasado)>0
  return (
    <div className="card" style={{marginBottom:10,border:atrasado?'1.5px solid var(--red-mid)':undefined}}>
      <div style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontWeight:600,fontSize:15}}>{g.comprador}</span>
            {atrasado&&<span className="badge badge-red">atrasado</span>}
            {!atrasado&&g.qtd_pendentes>0&&<span className="badge badge-amber">{g.qtd_pendentes} pendente(s)</span>}
          </div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>{g.qtd_pendentes} venda(s) · {g.proximo_vencimento&&`próx: ${fmtDate(g.proximo_vencimento)}`}</div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:20,fontFamily:'var(--font-display)',color:atrasado?'var(--red)':'var(--teal)'}}>{fmt(g.total_pendente)}</div>
          {atrasado&&<div style={{fontSize:11,color:'var(--red)',fontWeight:600}}>{fmt(g.total_atrasado)} atrasado</div>}
        </div>
        <span style={{fontSize:18,color:'var(--text-muted)',transform:open?'rotate(180deg)':'none',transition:'transform .2s'}}>⌄</span>
      </div>
      {open&&(
        <div style={{marginTop:14,borderTop:'1px solid var(--border)',paddingTop:12}}>
          {pend.length===0?<div style={{fontSize:13,color:'var(--text-muted)'}}>Sem pendências ✓</div>:
          <div className="table-wrap"><table>
            <thead><tr><th>Vencimento</th><th>Lote</th><th>Parcela</th><th style={{textAlign:'right'}}>Valor</th><th>Status</th></tr></thead>
            <tbody>{pend.map(v=>{
              const {cls,label}=statusBadge(v.status_pagamento)
              return <tr key={v.id}>
                <td><VencBadge dataVenc={v.data_vencimento} status={v.status_pagamento}/></td>
                <td style={{color:'var(--text-muted)'}}>{v.lote??'—'}</td>
                <td style={{fontSize:12,color:'var(--text-muted)'}}>{v.parcela_total>1?`${v.parcela_numero}/${v.parcela_total}`:'—'}</td>
                <td style={{fontWeight:600,color:'var(--teal)',textAlign:'right'}}>{fmt(v.valor_total)}</td>
                <td><span className={`badge ${cls}`}>{label}</span></td>
              </tr>
            })}</tbody>
          </table></div>}
        </div>
      )}
    </div>
  )
}

function GrupoPagar({ g, onPagar }) {
  const [open,setOpen]=useState(false)
  const pend=g.contas_pendentes??[]
  const atrasado=Number(g.total_atrasado)>0
  return (
    <div className="card" style={{marginBottom:10,border:atrasado?'1.5px solid var(--red-mid)':undefined}}>
      <div style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
            <span style={{fontWeight:600,fontSize:15}}>{g.fornecedor}</span>
            {atrasado&&<span className="badge badge-red">atrasado</span>}
            {!atrasado&&g.qtd_pendentes>0&&<span className="badge badge-amber">{g.qtd_pendentes} pendente(s)</span>}
          </div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:3}}>{g.qtd_pendentes} conta(s) · {g.proximo_vencimento&&`próx: ${fmtDate(g.proximo_vencimento)}`}</div>
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontWeight:700,fontSize:20,fontFamily:'var(--font-display)',color:atrasado?'var(--red)':'var(--amber)'}}>{fmt(g.total_pendente)}</div>
          {atrasado&&<div style={{fontSize:11,color:'var(--red)',fontWeight:600}}>{fmt(g.total_atrasado)} atrasado</div>}
        </div>
        <span style={{fontSize:18,color:'var(--text-muted)',transform:open?'rotate(180deg)':'none',transition:'transform .2s'}}>⌄</span>
      </div>
      {open&&(
        <div style={{marginTop:14,borderTop:'1px solid var(--border)',paddingTop:12}}>
          {pend.length===0?<div style={{fontSize:13,color:'var(--text-muted)'}}>Sem pendências ✓</div>:
          <div className="table-wrap"><table>
            <thead><tr><th>Categoria</th><th>Descrição</th><th>Vencimento</th><th>Parcela</th><th style={{textAlign:'right'}}>Valor</th><th>Status</th></tr></thead>
            <tbody>{pend.map(c=>{
              const {cls,label}=statusBadge(c.status_pagamento)
              return <tr key={c.id}>
                <td><span className="badge badge-gray">{c.categoria}</span></td>
                <td>{c.tipo_parcelamento==='mensal'?'🔁 ':c.tipo_parcelamento==='parcelado'?'📦 ':''}{c.descricao}</td>
                <td><VencBadge dataVenc={c.data_vencimento} status={c.status_pagamento}/></td>
                <td style={{fontSize:12,color:'var(--text-muted)'}}>{c.parcela_total>1?`${c.parcela_numero}/${c.parcela_total}`:'—'}</td>
                <td style={{fontWeight:600,color:'var(--amber)',textAlign:'right'}}>{fmt(c.valor)}</td>
                <td><span className={`badge ${cls}`}>{label}</span></td>
              </tr>
            })}</tbody>
          </table></div>}
        </div>
      )}
    </div>
  )
}

const TIPO_ICONE = { caixa:'💵', banco:'🏦', carteira:'👛' }
const COLS_FLUXO = [
  { label:'Data', accessor: r => fmtDate(r.data) },
  { label:'Conta', key:'conta' },
  { label:'Tipo', key:'tipo' },
  { label:'Origem', key:'origem' },
  { label:'Descrição', key:'descricao' },
  { label:'Valor', accessor: r => fmt(r.valor) },
  { label:'Saldo acumulado', accessor: r => fmt(r.saldo_acumulado) },
]

export default function Financeiro() {
  const [aba,setAba]         = useState('contas')
  const [contas,setContas]   = useState([])
  const [fluxo,setFluxo]     = useState([])
  const [projetado,setProj]  = useState(null)
  const [receber,setRec]     = useState([])
  const [pagar,setPag]       = useState([])
  const [loading,setLoad]    = useState(true)
  // Fluxo filtros
  const [fContaId,setFContaId] = useState('')
  const [fTipo,setFTipo]       = useState('')
  const [fDataIni,setFDataIni] = useState('')
  const [fDataFim,setFDataFim] = useState('')
  // Transferência
  const [tOrigem,setTOrigem]   = useState('')
  const [tDestino,setTDestino] = useState('')
  const [tValor,setTValor]     = useState('')
  const [tData,setTData]       = useState(today())
  const [tDesc,setTDesc]       = useState('Transferência')
  const [transferindo,setTransf] = useState(false)
  // Modal nova conta
  const [modalConta,setModalConta] = useState(false)
  const [formConta,setFormConta]   = useState({nome:'',tipo:'banco'})
  const [editContaId,setEditContaId] = useState(null)

  const load = useCallback(async()=>{
    setLoad(true)
    try {
      const [{data:cs},{data:fl},{data:pj},{data:r},{data:p}] = await Promise.all([
        supabase.from('vw_saldo_contas').select('*'),
        supabase.from('vw_fluxo_caixa').select('*').limit(200),
        supabase.from('vw_saldo_projetado').select('*').single(),
        supabase.from('vw_receber_por_comprador').select('*'),
        supabase.from('vw_pagar_por_fornecedor').select('*'),
      ])
      setContas(cs??[]); setFluxo(fl??[]); setProj(pj)
      setRec(r??[]); setPag(p??[])
    } catch(e){ console.error(e) }
    setLoad(false)
  },[])

  useEffect(()=>{ load() },[load])

  const [modalAjuste, setModalAjuste] = useState(null) // conta a ajustar
  const [ajusteValor, setAjusteValor] = useState('')
  const [ajusteTipo, setAjusteTipo] = useState('ajuste')

  async function excluirMov(id) {
    if (!window.confirm('Excluir esta movimentação? O saldo da conta será recalculado.')) return
    await supabase.from('movimentacoes_financeiras').delete().eq('id', id)
    load()
  }

  async function salvarAjuste() {
    if (!ajusteValor || parseFloat(ajusteValor) <= 0) return alert('Informe o valor.')
    await supabase.from('movimentacoes_financeiras').insert({
      conta_financeira_id: modalAjuste.id,
      tipo: ajusteTipo,
      origem: 'ajuste',
      valor: parseFloat(ajusteValor),
      data: new Date().toISOString().split('T')[0],
      descricao: 'Ajuste manual de saldo'
    })
    setModalAjuste(null); setAjusteValor(''); load()
  }

  async function transferir() {
    if (!tOrigem || !tDestino || !tValor || parseFloat(tValor) <= 0) return alert('Preencha todos os campos com valores válidos.')
    if (tOrigem === tDestino) return alert('Conta de origem e destino não podem ser iguais.')
    setTransf(true)
    const { error } = await supabase.rpc('fn_transferir', {
      p_origem_id: tOrigem,
      p_destino_id: tDestino,
      p_valor: parseFloat(tValor),
      p_data: tData,
      p_descricao: tDesc || 'Transferência'
    })
    if (error) { alert('Erro: ' + error.message); setTransf(false); return }
    setTransf(false); setTValor(''); load()
  }

  async function salvarConta() {
    if (!formConta.nome) return alert('Informe o nome da conta.')
    if (editContaId) await supabase.from('contas_financeiras').update(formConta).eq('id',editContaId)
    else await supabase.from('contas_financeiras').insert(formConta)
    setModalConta(false); setEditContaId(null); setFormConta({nome:'',tipo:'banco'}); load()
  }

  const fluxoFiltrado = fluxo.filter(f=>{
    if (fContaId&&f.conta_financeira_id!==fContaId) return false
    if (fTipo&&f.tipo!==fTipo) return false
    if (fDataIni&&f.data<fDataIni) return false
    if (fDataFim&&f.data>fDataFim) return false
    return true
  })

  const totRec  = receber.reduce((s,r)=>s+Number(r.total_pendente??0),0)
  const totPag  = pagar.reduce((s,p)=>s+Number(p.total_pendente??0),0)
  const totAtrR = receber.reduce((s,r)=>s+Number(r.total_atrasado??0),0)
  const totAtrP = pagar.reduce((s,p)=>s+Number(p.total_atrasado??0),0)

  if (loading) return <div className="loading">Carregando financeiro...</div>

  return (
    <>
      {/* KPIs */}
      {projetado&&(
        <div className="metric-grid" style={{gridTemplateColumns:'repeat(4,1fr)',marginBottom:20}}>
          <div className="metric teal">
            <div className="metric-label">Saldo atual</div>
            <div className="metric-value">{fmt(projetado.saldo_atual_total)}</div>
            <div className="metric-sub">{contas.length} conta(s)</div>
          </div>
          <div className="metric green">
            <div className="metric-label">A receber</div>
            <div className="metric-value">{fmt(projetado.a_receber)}</div>
            {totAtrR>0&&<div style={{fontSize:11,color:'var(--red)',marginTop:4,fontWeight:600}}>🔴 {fmt(totAtrR)} atrasado</div>}
          </div>
          <div className="metric amber">
            <div className="metric-label">A pagar</div>
            <div className="metric-value">{fmt(projetado.a_pagar)}</div>
            {totAtrP>0&&<div style={{fontSize:11,color:'var(--red)',marginTop:4,fontWeight:600}}>🔴 {fmt(totAtrP)} atrasado</div>}
          </div>
          <div className={`metric ${Number(projetado.saldo_projetado)>=0?'green':'red'}`}>
            <div className="metric-label">Saldo projetado</div>
            <div className="metric-value">{fmt(projetado.saldo_projetado)}</div>
            <div className="metric-sub">Após liquidações</div>
          </div>
        </div>
      )}

      <div className="tabs">
        <button className={`tab ${aba==='contas'?'active':''}`} onClick={()=>setAba('contas')}>🏦 Contas</button>
        <button className={`tab ${aba==='fluxo'?'active':''}`} onClick={()=>setAba('fluxo')}>📊 Fluxo de caixa</button>
        <button className={`tab ${aba==='pendencias'?'active':''}`} onClick={()=>setAba('pendencias')}>⏳ Pendências</button>
        <button className={`tab ${aba==='transferencia'?'active':''}`} onClick={()=>setAba('transferencia')}>🔄 Transferência</button>
      </div>

      {/* ABA: CONTAS */}
      {aba==='contas'&&(
        <>
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:12}}>
            <button className="btn btn-primary" onClick={()=>{setFormConta({nome:'',tipo:'banco'});setEditContaId(null);setModalConta(true)}}>+ Nova conta</button>
          </div>
          {contas.length===0
            ? <div className="empty">Nenhuma conta cadastrada.</div>
            : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
                {contas.map(c=>(
                  <div key={c.id} className="card" style={{marginBottom:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                      <div>
                        <div style={{fontSize:18}}>{TIPO_ICONE[c.tipo]??'🏦'}</div>
                        <div style={{fontWeight:600,fontSize:15,marginTop:4}}>{c.nome}</div>
                        <div style={{fontSize:11,color:'var(--text-muted)',textTransform:'uppercase'}}>{c.tipo}</div>
                      </div>
                      <button className="btn btn-sm" onClick={()=>{setFormConta({nome:c.nome,tipo:c.tipo});setEditContaId(c.id);setModalConta(true)}}>✎</button>
                      <button className="btn btn-sm" style={{color:'var(--teal)',borderColor:'var(--teal-light)',background:'var(--teal-light)'}} onClick={()=>{setModalAjuste(c);setAjusteValor('');setAjusteTipo('entrada')}}>± Ajustar</button>
                    </div>
                    <div style={{fontWeight:700,fontSize:24,fontFamily:'var(--font-display)',color:c.saldo_atual>=0?'var(--green)':'var(--red)'}}>{fmt(c.saldo_atual)}</div>
                    <div style={{display:'flex',gap:12,marginTop:10,fontSize:12,color:'var(--text-muted)'}}>
                      <span>↑ {fmt(c.total_entradas)}</span>
                      <span>↓ {fmt(c.total_saidas)}</span>
                    </div>
                  </div>
                ))}
              </div>}
        </>
      )}

      {/* ABA: FLUXO DE CAIXA */}
      {aba==='fluxo'&&(
        <>
          <div className="card" style={{marginBottom:12,padding:'12px 16px'}}>
            <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
              <div className="form-group" style={{marginBottom:0}}><label>Conta</label>
                <select value={fContaId} onChange={e=>setFContaId(e.target.value)}>
                  <option value="">Todas as contas</option>
                  {contas.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="form-group" style={{marginBottom:0}}><label>Tipo</label>
                <select value={fTipo} onChange={e=>setFTipo(e.target.value)}>
                  <option value="">Entrada e saída</option><option value="entrada">Entradas</option><option value="saida">Saídas</option>
                </select>
              </div>
              <div className="form-group" style={{marginBottom:0}}><label>Data inicial</label><input type="date" value={fDataIni} onChange={e=>setFDataIni(e.target.value)} /></div>
              <div className="form-group" style={{marginBottom:0}}><label>Data final</label><input type="date" value={fDataFim} onChange={e=>setFDataFim(e.target.value)} /></div>
              <button className="btn btn-sm" onClick={()=>{setFContaId('');setFTipo('');setFDataIni('');setFDataFim('')}}>Limpar</button>
              <BtnExportar dados={fluxoFiltrado} colunas={COLS_FLUXO} nome="fluxo_caixa" />
            </div>
          </div>
          {fluxoFiltrado.length===0
            ? <div className="empty">Nenhuma movimentação encontrada.</div>
            : <div className="card">
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Data</th><th>Conta</th><th>Tipo</th><th>Origem</th><th>Descrição</th><th style={{textAlign:'right'}}>Valor</th><th style={{textAlign:'right'}}>Saldo acum.</th><th></th></tr></thead>
                    <tbody>
                      {fluxoFiltrado.map(f=>(
                        <tr key={f.id}>
                          <td>{fmtDate(f.data)}</td>
                          <td>{TIPO_ICONE[contas.find(c=>c.id===f.conta_financeira_id)?.tipo]??'🏦'} {f.conta}</td>
                          <td><span className={`badge ${f.tipo==='entrada'?'badge-green':'badge-red'}`}>{f.tipo==='entrada'?'↑ Entrada':'↓ Saída'}</span></td>
                          <td style={{fontSize:12}}><span className="badge badge-gray">{f.origem}</span></td>
                          <td style={{maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.descricao}</td>
                          <td style={{textAlign:'right',fontWeight:600,color:f.tipo==='entrada'?'var(--green)':'var(--red)'}}>{f.tipo==='entrada'?'+':'-'}{fmt(f.valor)}</td>
                          <td style={{textAlign:'right',fontWeight:600,color:Number(f.saldo_acumulado)>=0?'var(--teal)':'var(--red)'}}>{fmt(f.saldo_acumulado)}</td>
                          <td><button className="btn btn-sm btn-danger" onClick={()=>excluirMov(f.id)}>✕</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>}
        </>
      )}

      {/* ABA: PENDÊNCIAS */}
      {aba==='pendencias'&&(
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
            <div className="card" style={{marginBottom:0}}>
              <div className="card-title">💰 A receber ({receber.filter(r=>r.qtd_pendentes>0).length} compradores)</div>
              <div style={{fontSize:24,fontWeight:700,fontFamily:'var(--font-display)',color:'var(--teal)'}}>{fmt(totRec)}</div>
              {totAtrR>0&&<div style={{fontSize:12,color:'var(--red)',fontWeight:600,marginTop:4}}>🔴 {fmt(totAtrR)} em atraso</div>}
            </div>
            <div className="card" style={{marginBottom:0}}>
              <div className="card-title">💸 A pagar ({pagar.filter(p=>p.qtd_pendentes>0).length} fornecedores)</div>
              <div style={{fontSize:24,fontWeight:700,fontFamily:'var(--font-display)',color:'var(--amber)'}}>{fmt(totPag)}</div>
              {totAtrP>0&&<div style={{fontSize:12,color:'var(--red)',fontWeight:600,marginTop:4}}>🔴 {fmt(totAtrP)} em atraso</div>}
            </div>
          </div>
          <div style={{marginBottom:8,fontWeight:600,fontSize:14}}>A receber</div>
          {receber.filter(r=>r.qtd_pendentes>0).length===0
            ? <div className="empty" style={{marginBottom:16}}>Nenhum recebimento pendente ✓</div>
            : receber.filter(r=>r.qtd_pendentes>0).map(r=><GrupoReceber key={r.comprador} g={r} />)}
          <div style={{marginBottom:8,marginTop:16,fontWeight:600,fontSize:14}}>A pagar</div>
          {pagar.filter(p=>p.qtd_pendentes>0).length===0
            ? <div className="empty">Nenhum pagamento pendente ✓</div>
            : pagar.filter(p=>p.qtd_pendentes>0).map(p=><GrupoPagar key={p.fornecedor} g={p} />)}
        </>
      )}

      {/* ABA: TRANSFERÊNCIA */}
      {aba==='transferencia'&&(
        <div className="card" style={{maxWidth:480}}>
          <div className="card-title">🔄 Transferência entre contas</div>
          <div className="form-grid">
            <div className="form-group form-full">
              <label>Conta de origem *</label>
              <select value={tOrigem} onChange={e=>setTOrigem(e.target.value)}>
                <option value="">— Selecione —</option>
                {contas.map(c=><option key={c.id} value={c.id}>{TIPO_ICONE[c.tipo]??'🏦'} {c.nome} — {fmt(c.saldo_atual)}</option>)}
              </select>
            </div>
            <div className="form-group form-full">
              <label>Conta de destino *</label>
              <select value={tDestino} onChange={e=>setTDestino(e.target.value)}>
                <option value="">— Selecione —</option>
                {contas.filter(c=>c.id!==tOrigem).map(c=><option key={c.id} value={c.id}>{TIPO_ICONE[c.tipo]??'🏦'} {c.nome} — {fmt(c.saldo_atual)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Valor (R$) *</label>
              <input type="number" inputMode="decimal" step="0.01" value={tValor} onChange={e=>setTValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="form-group">
              <label>Data</label>
              <input type="date" value={tData} onChange={e=>setTData(e.target.value)} />
            </div>
            <div className="form-group form-full">
              <label>Descrição</label>
              <input value={tDesc} onChange={e=>setTDesc(e.target.value)} placeholder="Transferência" />
            </div>
          </div>
          <button className="btn btn-primary" style={{width:'100%'}} onClick={transferir} disabled={transferindo}>
            {transferindo?'Transferindo...':'🔄 Confirmar transferência'}
          </button>
        </div>
      )}

      {/* Modal ajuste de saldo */}
      {modalAjuste&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalAjuste(null)}>
          <div className="modal" style={{maxWidth:380}}>
            <div className="modal-header">
              <h3>Ajustar saldo — {modalAjuste.nome}</h3>
              <button className="modal-close" onClick={()=>setModalAjuste(null)}>✕</button>
            </div>
            <div style={{background:'var(--teal-light)',borderRadius:'var(--radius-sm)',padding:'10px 14px',marginBottom:16}}>
              <div style={{fontSize:12,color:'var(--teal)'}}>Saldo atual</div>
              <div style={{fontSize:22,fontWeight:700,color:'var(--teal)'}}>{fmt(modalAjuste.saldo_atual)}</div>
            </div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Tipo de ajuste</label>
                <select value={ajusteTipo} onChange={e=>setAjusteTipo(e.target.value)}>
                  <option value="entrada">↑ Entrada (adicionar)</option>
                  <option value="saida">↓ Saída (subtrair)</option>
                </select>
              </div>
              <div className="form-group form-full"><label>Valor (R$) *</label>
                <input type="number" inputMode="decimal" step="0.01" autoFocus value={ajusteValor} onChange={e=>setAjusteValor(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModalAjuste(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarAjuste} style={{flex:1}}>✓ Confirmar ajuste</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal conta */}
      {modalConta&&(
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModalConta(false)}>
          <div className="modal" style={{maxWidth:380}}>
            <div className="modal-header"><h3>{editContaId?'Editar conta':'Nova conta'}</h3><button className="modal-close" onClick={()=>setModalConta(false)}>✕</button></div>
            <div className="form-grid">
              <div className="form-group form-full"><label>Nome *</label><input autoFocus value={formConta.nome} onChange={e=>setFormConta(f=>({...f,nome:e.target.value}))} placeholder="ex: Nubank, Inter, Caixa" /></div>
              <div className="form-group form-full"><label>Tipo</label>
                <select value={formConta.tipo} onChange={e=>setFormConta(f=>({...f,tipo:e.target.value}))}>
                  <option value="caixa">💵 Caixa</option><option value="banco">🏦 Banco</option><option value="carteira">👛 Carteira</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={()=>setModalConta(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvarConta} style={{flex:1}}>{editContaId?'✓ Salvar':'✓ Criar conta'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

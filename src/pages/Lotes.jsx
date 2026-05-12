import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, statusLoteBadge } from '../lib/utils'

// ─── CONFIG TIPOS ────────────────────────────────────────────
const TIPO_CFG = {
  'Adubação':                 { icon:'🌿', bg:'#EAF3DE', color:'#2d6a2d', label:'Adubação' },
  'adubacao':                 { icon:'🌿', bg:'#EAF3DE', color:'#2d6a2d', label:'Adubação' },
  'Aplicação Fitossanitária': { icon:'💊', bg:'#FCEBEB', color:'#A32D2D', label:'Fitossanitário' },
  'fitossanitario':           { icon:'💊', bg:'#FCEBEB', color:'#A32D2D', label:'Fitossanitário' },
  'Aplicação Orgânica':       { icon:'♻️', bg:'#F0FDF4', color:'#166534', label:'Orgânico' },
  'Aplicação':                { icon:'🧪', bg:'#EFF6FF', color:'#1D4ED8', label:'Aplicação' },
  'Plantio':                  { icon:'🌱', bg:'#ECFDF5', color:'#065F46', label:'Plantio' },
  'plantio':                  { icon:'🌱', bg:'#ECFDF5', color:'#065F46', label:'Plantio' },
  'Colheita':                 { icon:'📦', bg:'#FFFBEB', color:'#92400E', label:'Colheita' },
  'colheita':                 { icon:'📦', bg:'#FFFBEB', color:'#92400E', label:'Colheita' },
  'Venda':                    { icon:'💰', bg:'#F0FDF4', color:'#166534', label:'Venda' },
  'irrigacao':                { icon:'💧', bg:'#E6F1FB', color:'#185FA5', label:'Irrigação' },
  'campo':                    { icon:'🔧', bg:'#F1EFE8', color:'#5F5E5A', label:'Campo' },
}
const getCfg = t => TIPO_CFG[t] ?? { icon:'📝', bg:'#F1EFE8', color:'#555', label: t }

// ─── CONFIG STATUS SETOR ─────────────────────────────────────
const STATUS_CFG = {
  saudavel: { emoji:'🟢', label:'Saudável', bg:'#EAF3DE', border:'#C0DD97',          color:'#2d6a2d' },
  atencao:  { emoji:'🟡', label:'Atenção',  bg:'#FAEEDA', border:'#FAC775',          color:'#854F0B' },
  problema: { emoji:'🔴', label:'Problema', bg:'#FCEBEB', border:'#F7C1C1',          color:'#A32D2D' },
  vazio:    { emoji:'⚪', label:'Vazio',    bg:'#F1EFE8', border:'rgba(0,0,0,0.1)', color:'#888' },
}

const chipStyle = active => ({
  fontSize:12, padding:'4px 12px', borderRadius:20, border:'0.5px solid',
  whiteSpace:'nowrap', cursor:'pointer', fontFamily:'inherit',
  background:   active ? '#EAF3DE' : '#F1EFE8',
  color:        active ? '#2d6a2d' : '#666',
  borderColor:  active ? '#C0DD97' : 'rgba(0,0,0,0.1)',
  fontWeight:   active ? 500 : 400,
})

const ESTAGIOS = [
  { value:'jovem',    label:'🌱 Jovem' },
  { value:'producao', label:'🍌 Produção' },
  { value:'final',    label:'🍂 Final' },
]
const EMPTY_LOTE  = { nome:'', area_ha:'', status:'ativo', observacoes:'' }
const EMPTY_SETOR = (n) => ({ nome:`Setor ${n}`, cultura:'', variedade:'', estagio:'producao', area_hectares:'', data_plantio:'' })

// ─── PDF EXPORT ──────────────────────────────────────────────
async function exportarFichaPDF(lote, setoresList, historico) {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  const doc = new jsPDF()
  const hoje = new Date().toLocaleDateString('pt-BR')

  doc.setFillColor(45, 106, 45)
  doc.rect(0, 0, 210, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`Lote ${lote.nome}`, 14, 12)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`${lote.area_ha ?? '—'} ha  ·  AgroGestão  ·  Emitido em ${hoje}`, 14, 20)

  doc.setTextColor(80, 80, 80)
  doc.setFontSize(8)
  const r = lote.r ?? {}
  const kpis = [
    ['RECEITA', Number(r.receita_bruta??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})],
    ['CUSTO',   Number(r.custo_total??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})],
    ['LUCRO',   Number(r.lucro_bruto??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})],
    ['MARGEM',  `${Number(r.margem_pct??0).toFixed(1)}%`],
  ]
  kpis.forEach(([label, val], i) => {
    const x = 14 + i * 46
    doc.setFont('helvetica', 'normal'); doc.text(label, x, 38)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(val, x, 45)
    doc.setFontSize(8)
  })

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(45, 106, 45)
  doc.text('SETORES', 14, 58)
  doc.autoTable({
    startY: 62,
    head: [['Setor', 'Cultura', 'Variedade', 'Área (ha)', 'Status', 'Observação']],
    body: setoresList.map(s => [
      s.nome, s.cultura??'—', s.variedade??'—', s.area_hectares??'—',
      STATUS_CFG[s.status]?.label ?? s.status ?? '—',
      s.ultimo_problema??''
    ]),
    styles:{ fontSize:8, cellPadding:3 },
    headStyles:{ fillColor:[45,106,45], textColor:255, fontStyle:'bold' },
    alternateRowStyles:{ fillColor:[240,245,235] },
  })

  const afterSetores = doc.lastAutoTable.finalY + 8
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(45, 106, 45)
  doc.text('HISTÓRICO DE ATIVIDADES', 14, afterSetores)
  doc.autoTable({
    startY: afterSetores + 4,
    head: [['Data', 'Tipo', 'Setor', 'Descrição', 'Responsável', 'Custo']],
    body: historico.map(a => [
      fmtDate(a.data),
      getCfg(a.tipo).label,
      a.setor ?? '—',
      (a.descricao ?? '—').substring(0, 80),
      a.responsavel ?? '—',
      a.custo_total > 0
        ? Number(a.custo_total).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
        : '—'
    ]),
    styles:{ fontSize:7, cellPadding:2 },
    headStyles:{ fillColor:[45,106,45], textColor:255, fontStyle:'bold' },
    alternateRowStyles:{ fillColor:[240,245,235] },
    columnStyles:{ 3:{ cellWidth:60 } }
  })

  const total = doc.getNumberOfPages()
  for (let p=1; p<=total; p++) {
    doc.setPage(p); doc.setFontSize(7); doc.setTextColor(180,180,180)
    doc.text(`AgroGestão · Lote ${lote.nome} · Página ${p} de ${total}`, 14, 290)
  }
  doc.save(`Lote_${lote.nome}_${hoje.replace(/\//g,'-')}.pdf`)
}

// ════════════════════════════════════════════════════════════
export default function Lotes({ onAddBtn }) {
  const [lotes, setLotes]             = useState([])
  const [resumo, setResumo]           = useState({})
  const [setores, setSetores]         = useState({})
  const [culturasDB, setCulturasDB]   = useState([])
  const [varPorCultura, setVarPorCultura] = useState({})
  const [loading, setLoading]         = useState(true)

  // Modal detalhe
  const [detalhe, setDetalhe]         = useState(null)
  const [detSetores, setDetSetores]   = useState([])
  const [historico, setHistorico]     = useState([])
  const [loadingDet, setLoadingDet]   = useState(false)
  const [filtroHist, setFiltroHist]   = useState('todos')
  const [setorFiltro, setSetorFiltro] = useState('todos')
  const [mapaAberto, setMapaAberto]   = useState(true)

  // Modal editar
  const [modal, setModal]             = useState(false)
  const [form, setForm]               = useState(EMPTY_LOTE)
  const [formSetores, setFormSetores] = useState([EMPTY_SETOR(1)])
  const [editId, setEditId]           = useState(null)
  const [saving, setSaving]           = useState(false)

  // Filtros lista
  const [viewMode, setViewMode]       = useState('tabela')
  const [busca, setBusca]             = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [ordenar, setOrdenar]         = useState('nome')

  useEffect(() => { load() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(() => openModal()) }, [lotes])

  async function load() {
    setLoading(true)
    const [{ data:ls },{ data:rs },{ data:sts },{ data:cults },{ data:vars }] = await Promise.all([
      supabase.from('lotes').select('*').order('nome'),
      supabase.from('vw_resumo_por_lote').select('*'),
      supabase.from('setores').select('*').order('nome'),
      supabase.from('culturas').select('id,nome,icone').eq('ativo',true).is('deleted_at',null).order('nome'),
      supabase.from('setores').select('cultura,variedade').not('variedade','is',null).neq('variedade',''),
    ])
    setLotes(ls??[])
    const m={}; (rs??[]).forEach(r=>{m[r.lote_id]=r}); setResumo(m)
    const s={}; (sts??[]).forEach(st=>{if(!s[st.lote_id])s[st.lote_id]=[];s[st.lote_id].push(st)}); setSetores(s)
    setCulturasDB(cults??[])
    const vmap={}
    ;(vars??[]).forEach(v=>{
      if(!v.cultura||!v.variedade) return
      if(!vmap[v.cultura]) vmap[v.cultura]=new Set()
      vmap[v.cultura].add(v.variedade.trim())
    })
    const vobj={}; Object.entries(vmap).forEach(([k,v])=>{vobj[k]=[...v].sort()})
    setVarPorCultura(vobj)
    setLoading(false)
  }

  async function abrirDetalhe(lote) {
    setDetalhe(lote); setFiltroHist('todos'); setSetorFiltro('todos')
    setMapaAberto(true); setLoadingDet(true)
    const [{ data:sts }, { data:hist }] = await Promise.all([
      supabase.from('setores').select('*').eq('lote_id', lote.id).order('nome'),
      supabase.from('vw_historico_lote').select('*').eq('lote_id', lote.id).order('data', { ascending:false }),
    ])
    setDetSetores(sts ?? [])
    setHistorico(hist ?? [])
    setLoadingDet(false)
  }

  // Filtro combinado: tipo + setor
  const histFiltrado = useMemo(() => {
    return historico.filter(h => {
      const okTipo = filtroHist === 'todos'
        || (filtroHist === 'campo'    && h.origem === 'atividade')
        || (filtroHist === 'producao' && h.origem === 'producao')
        || (filtroHist === 'venda'    && h.origem === 'venda')
        || h.tipo === filtroHist
      const okSetor = setorFiltro === 'todos' || h.setor === detSetores.find(s=>s.id===setorFiltro)?.nome
      return okTipo && okSetor
    })
  }, [historico, filtroHist, setorFiltro, detSetores])

  const stats = useMemo(() => ({
    plantios:  historico.filter(h=>h.tipo==='Plantio').length,
    adubacoes: historico.filter(h=>h.tipo==='Adubação').length,
    fitoss:    historico.filter(h=>h.tipo==='Aplicação Fitossanitária').length,
    totalCx:   historico.filter(h=>h.origem==='producao').reduce((s,h)=>s+Number(h.quantidade??0),0),
    receita:   historico.filter(h=>h.origem==='venda').reduce((s,h)=>s+Number(h.valor??0),0),
  }), [historico])

  const lotesFiltrados = useMemo(() => {
    let lista = lotes.map(l=>({...l, r:resumo[l.id]??{}, sts:setores[l.id]??[]}))
    if (busca) lista = lista.filter(l=>l.nome.toLowerCase().includes(busca.toLowerCase()))
    if (filtroStatus) lista = lista.filter(l=>l.status===filtroStatus)
    lista.sort((a,b)=>{
      if (ordenar==='lucro') return Number(b.r.lucro_bruto??0)-Number(a.r.lucro_bruto??0)
      if (ordenar==='area')  return Number(b.area_ha??0)-Number(a.area_ha??0)
      return a.nome.localeCompare(b.nome)
    })
    return lista
  }, [lotes, resumo, setores, busca, filtroStatus, ordenar])

  function handleQtdSetores(qtd) {
    const n=parseInt(qtd)||1
    setFormSetores(prev=>{
      if(n>prev.length){const novo=[...prev];for(let i=prev.length+1;i<=n;i++)novo.push(EMPTY_SETOR(i));return novo}
      return prev.slice(0,Math.max(n,1))
    })
  }

  function updateSetor(idx,field,value) {
    setFormSetores(prev=>prev.map((s,i)=>{
      if(i!==idx) return s
      if(field==='cultura') return{...s,cultura:value,variedade:''}
      return{...s,[field]:value}
    }))
  }

  async function openModal(lote=null) {
    if(lote){
      setForm({nome:lote.nome,area_ha:lote.area_ha??'',status:lote.status,observacoes:lote.observacoes??''})
      setEditId(lote.id)
      const{data:sts}=await supabase.from('setores').select('*').eq('lote_id',lote.id).order('nome')
      if(sts?.length) setFormSetores(sts.map(s=>({id:s.id,nome:s.nome,cultura:s.cultura??'',variedade:s.variedade??'',estagio:s.estagio??'producao',area_hectares:s.area_hectares??'',data_plantio:s.data_plantio??''})))
      else setFormSetores([EMPTY_SETOR(1)])
    } else {
      setForm(EMPTY_LOTE);setFormSetores([EMPTY_SETOR(1)]);setEditId(null)
    }
    setModal(true)
  }

  async function save() {
    if(!form.nome) return alert('Informe o nome do lote.')
    setSaving(true)
    const payload={nome:form.nome,area_ha:parseFloat(form.area_ha)||null,status:form.status,observacoes:form.observacoes||null,quantidade_setores:formSetores.length}
    let loteId=editId
    if(editId){
      await supabase.from('lotes').update(payload).eq('id',editId)
    } else {
      const{data:nl}=await supabase.from('lotes').insert(payload).select().single()
      loteId=nl.id
    }
    if(editId){
      for(const s of formSetores){
        const d={nome:s.nome,cultura:s.cultura,variedade:s.variedade||null,estagio:s.estagio,area_hectares:s.area_hectares||null,data_plantio:s.data_plantio||null}
        if(s.id) await supabase.from('setores').update(d).eq('id',s.id)
        else await supabase.from('setores').insert({lote_id:loteId,...d})
      }
      const ids=formSetores.filter(s=>s.id).map(s=>s.id)
      if(ids.length) await supabase.from('setores').delete().eq('lote_id',loteId).not('id','in',`(${ids.join(',')})`)
    } else {
      await supabase.from('setores').insert(formSetores.map(s=>({lote_id:loteId,nome:s.nome,cultura:s.cultura,variedade:s.variedade||null,estagio:s.estagio,area_hectares:s.area_hectares||null,data_plantio:s.data_plantio||null})))
    }
    setSaving(false);setModal(false);load()
  }

  async function excluir(id,e) {
    e?.stopPropagation()
    if(!window.confirm('Excluir este lote?')) return
    await supabase.from('lotes').delete().eq('id',id); load()
  }

  if(loading) return <div className="loading">Carregando lotes...</div>

  const totalReceita = lotesFiltrados.reduce((s,l)=>s+Number(l.r.receita_bruta??0),0)
  const totalLucro   = lotesFiltrados.reduce((s,l)=>s+Number(l.r.lucro_bruto??0),0)

  return (
    <>
      {/* ── CONTROLES ── */}
      <div className="card" style={{marginBottom:12,padding:'12px 16px'}}>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-group" style={{marginBottom:0,flex:2,minWidth:140}}>
            <label>Buscar</label>
            <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="ex: A370"/>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label>Status</label>
            <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="ativo">Ativo</option>
              <option value="em_repouso">Em repouso</option>
              <option value="colhido">Colhido</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label>Ordenar</label>
            <select value={ordenar} onChange={e=>setOrdenar(e.target.value)}>
              <option value="nome">Nome</option>
              <option value="lucro">Lucro</option>
              <option value="area">Área</option>
            </select>
          </div>
          <div style={{display:'flex',gap:4}}>
            <button className="btn btn-sm" style={{background:viewMode==='tabela'?'var(--green)':'',color:viewMode==='tabela'?'white':''}} onClick={()=>setViewMode('tabela')}>📋</button>
            <button className="btn btn-sm" style={{background:viewMode==='cards'?'var(--green)':'',color:viewMode==='cards'?'white':''}} onClick={()=>setViewMode('cards')}>🧱</button>
          </div>
        </div>
      </div>

      {/* TOTALIZADORES */}
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        {[
          {label:'Lotes',   val:lotesFiltrados.length},
          {label:'Receita', val:fmt(totalReceita), color:'var(--teal)'},
          {label:'Lucro',   val:fmt(totalLucro),   color:'var(--green)'},
        ].map(k=>(
          <div key={k.label} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:'8px 14px'}}>
            <div style={{fontSize:11,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase'}}>{k.label}</div>
            <div style={{fontSize:16,fontWeight:700,color:k.color??'var(--text)',marginTop:2}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* LISTA */}
      {lotesFiltrados.length===0 ? <div className="empty">Nenhum lote encontrado.</div>
      : viewMode==='tabela' ? (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Lote</th><th>Variedades</th><th>Área</th>
                <th style={{textAlign:'right'}}>Receita</th>
                <th style={{textAlign:'right'}}>Lucro</th>
                <th>Status</th><th></th>
              </tr></thead>
              <tbody>
                {lotesFiltrados.map(l=>{
                  const {cls,label}=statusLoteBadge(l.status)
                  const lucro=Number(l.r.lucro_bruto??0)
                  const varDesc=[...new Set(l.sts.map(s=>s.variedade||s.cultura).filter(Boolean))].join(', ')
                  return(
                    <tr key={l.id} style={{cursor:'pointer'}} onClick={()=>abrirDetalhe(l)}>
                      <td><strong style={{fontSize:14}}>{l.nome}</strong></td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>{varDesc||'—'}</td>
                      <td style={{fontSize:12}}>{l.area_ha?`${l.area_ha} ha`:'—'}</td>
                      <td style={{textAlign:'right',color:'var(--teal)',fontWeight:600}}>{fmt(l.r.receita_bruta)}</td>
                      <td style={{textAlign:'right',fontWeight:700,color:lucro>=0?'var(--green)':'var(--red)'}}>{fmt(lucro)}</td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td><div style={{display:'flex',gap:4}}>
                        <button className="btn btn-sm" onClick={e=>{e.stopPropagation();openModal(l)}}>✎</button>
                        <button className="btn btn-sm btn-danger" onClick={e=>excluir(l.id,e)}>✕</button>
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))',gap:10}}>
          {lotesFiltrados.map(l=>{
            const lucro=Number(l.r.lucro_bruto??0)
            const varDesc=[...new Set(l.sts.map(s=>s.variedade||s.cultura).filter(Boolean))].slice(0,2).join(', ')
            return(
              <div key={l.id} className="card" style={{marginBottom:0,cursor:'pointer',padding:'12px 14px'}} onClick={()=>abrirDetalhe(l)}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <div style={{fontWeight:700,fontSize:15}}>{l.nome}</div>
                  <button className="btn btn-sm" style={{padding:'2px 6px',fontSize:10}} onClick={e=>{e.stopPropagation();openModal(l)}}>✎</button>
                </div>
                {varDesc&&<div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>{varDesc}</div>}
                <div style={{fontWeight:700,fontSize:17,color:lucro>=0?'var(--green)':'var(--red)'}}>{fmt(lucro)}</div>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>{l.sts.length} setor(es) · {l.area_ha||'—'} ha</div>
                <div style={{marginTop:8}}><span style={{fontSize:10,background:'#EAF3DE',color:'#2d6a2d',borderRadius:4,padding:'1px 6px'}}>📋 Histórico</span></div>
              </div>
            )
          })}
          <div className="card" style={{marginBottom:0,display:'flex',alignItems:'center',justifyContent:'center',minHeight:120,cursor:'pointer',border:'1px dashed var(--border)'}} onClick={()=>openModal()}>
            <div style={{textAlign:'center',color:'var(--text-muted)'}}><div style={{fontSize:24}}>+</div><div style={{fontSize:12}}>Novo lote</div></div>
          </div>
        </div>
      )}

      <button className="fab" onClick={()=>openModal()}>+</button>

      {/* ══════════════════════════════════════════════════
          MODAL DETALHE — CADERNO DE CAMPO COMPLETO
      ══════════════════════════════════════════════════ */}
      {detalhe && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setDetalhe(null)}>
          <div className="modal" style={{maxWidth:660,maxHeight:'92vh',display:'flex',flexDirection:'column'}}>

            {/* HEADER */}
            <div className="modal-header" style={{flexShrink:0}}>
              <div>
                <h3 style={{marginBottom:2}}>{detalhe.nome}</h3>
                <div style={{fontSize:12,color:'var(--text-muted)'}}>
                  {detalhe.area_ha?`${detalhe.area_ha} ha · `:''}
                  {detSetores.length} setor(es)
                </div>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button className="btn btn-sm" onClick={()=>{setDetalhe(null);openModal(detalhe)}}>✎ Editar</button>
                <button className="modal-close" onClick={()=>setDetalhe(null)}>✕</button>
              </div>
            </div>

            {/* KPIs */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:'12px 20px',flexShrink:0,borderBottom:'1px solid var(--border)'}}>
              {[
                {label:'Receita', val:fmt(resumo[detalhe.id]?.receita_bruta), color:'var(--teal)'},
                {label:'Custo',   val:fmt(resumo[detalhe.id]?.custo_total),   color:'var(--amber)'},
                {label:'Lucro',   val:fmt(resumo[detalhe.id]?.lucro_bruto),   color:Number(resumo[detalhe.id]?.lucro_bruto??0)>=0?'var(--green)':'var(--red)'},
                {label:'Margem',  val:`${Number(resumo[detalhe.id]?.margem_pct??0).toFixed(1)}%`, color:'var(--text)'},
              ].map(k=>(
                <div key={k.label} style={{background:'var(--bg)',borderRadius:8,padding:'8px 10px',textAlign:'center'}}>
                  <div style={{fontSize:10,color:'var(--text-muted)',fontWeight:600,textTransform:'uppercase'}}>{k.label}</div>
                  <div style={{fontSize:15,fontWeight:700,color:k.color,marginTop:2}}>{k.val}</div>
                </div>
              ))}
            </div>

            <div style={{flex:1,overflowY:'auto',padding:'14px 20px'}}>

              {/* ── MAPA DE SETORES ── */}
              {detSetores.length > 0 && (
                <div style={{marginBottom:16}}>
                  <button onClick={()=>setMapaAberto(v=>!v)} style={{width:'100%',background:'none',border:'none',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0 0 8px',cursor:'pointer',fontWeight:600,fontSize:13,color:'var(--text)'}}>
                    <span>🗺️ Mapa de setores</span>
                    <span style={{fontSize:11,color:'var(--text-muted)'}}>{mapaAberto?'▲ recolher':'▼ expandir'}</span>
                  </button>

                  {mapaAberto && (
                    <>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:8,marginBottom:10}}>
                        {detSetores.map(s=>{
                          const cfg=STATUS_CFG[s.status??'saudavel']??STATUS_CFG.vazio
                          const ativo=setorFiltro===s.id
                          return(
                            <div key={s.id} onClick={()=>setSetorFiltro(ativo?'todos':s.id)} style={{
                              background:cfg.bg, border:`${ativo?'2px':'0.5px'} solid ${cfg.border}`,
                              borderRadius:10, padding:'10px 8px', textAlign:'center',
                              cursor:'pointer', transition:'opacity .15s',
                              opacity:setorFiltro!=='todos'&&!ativo?.5:1,
                            }}>
                              <div style={{fontSize:11,fontWeight:600,color:cfg.color,marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.nome}</div>
                              <div style={{fontSize:22,margin:'4px 0'}}>{cfg.emoji}</div>
                              <div style={{fontSize:11,color:cfg.color}}>{s.variedade||s.cultura||'—'}</div>
                              <div style={{fontSize:9,color:cfg.color,marginTop:2}}>
                                {s.status==='problema'&&s.ultimo_problema ? s.ultimo_problema : cfg.label}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div style={{display:'flex',gap:12,flexWrap:'wrap',marginBottom:4}}>
                        {Object.entries(STATUS_CFG).map(([k,cfg])=>(
                          <span key={k} style={{fontSize:10,color:'#888',display:'flex',alignItems:'center',gap:4}}>{cfg.emoji} {cfg.label}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── RESUMO RÁPIDO ── */}
              {!loadingDet && historico.length > 0 && (
                <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12,padding:'8px 12px',background:'var(--surface)',borderRadius:8,border:'1px solid var(--border)'}}>
                  {[
                    {icon:'🌱', label:`${stats.plantios} plantio(s)`,    show:stats.plantios>0},
                    {icon:'🌿', label:`${stats.adubacoes} adubação(ões)`, show:stats.adubacoes>0},
                    {icon:'💊', label:`${stats.fitoss} fito`,             show:stats.fitoss>0},
                    {icon:'📦', label:`${stats.totalCx} cx`,              show:stats.totalCx>0},
                    {icon:'💰', label:fmt(stats.receita),                 show:stats.receita>0, color:'var(--green)'},
                  ].filter(x=>x.show).map((x,i)=>(
                    <span key={i} style={{fontSize:11,fontWeight:600,color:x.color??'var(--text-muted)',background:'var(--bg)',borderRadius:6,padding:'3px 8px',border:'1px solid var(--border)'}}>
                      {x.icon} {x.label}
                    </span>
                  ))}
                </div>
              )}

              {/* ── FILTROS TIPO ── */}
              <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:8}}>
                {[
                  {key:'todos',      label:'Todos'},
                  {key:'campo',      label:'🌾 Campo'},
                  {key:'Adubação',   label:'🌿 Adubação'},
                  {key:'Aplicação Fitossanitária', label:'💊 Fito'},
                  {key:'Plantio',    label:'🌱 Plantio'},
                  {key:'producao',   label:'📦 Colheita'},
                  {key:'venda',      label:'💰 Venda'},
                ].map(f=>(
                  <button key={f.key} onClick={()=>setFiltroHist(f.key)} style={chipStyle(filtroHist===f.key)}>{f.label}</button>
                ))}
              </div>

              {/* ── FILTROS SETOR ── */}
              {detSetores.length > 1 && (
                <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:12}}>
                  <button onClick={()=>setSetorFiltro('todos')} style={chipStyle(setorFiltro==='todos')}>Todos os setores</button>
                  {detSetores.map(s=>(
                    <button key={s.id} onClick={()=>setSetorFiltro(setorFiltro===s.id?'todos':s.id)} style={chipStyle(setorFiltro===s.id)}>{s.nome}</button>
                  ))}
                </div>
              )}

              {/* ── TIMELINE ── */}
              {loadingDet ? (
                <div style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>Carregando histórico...</div>
              ) : histFiltrado.length===0 ? (
                <div style={{textAlign:'center',padding:24,color:'var(--text-muted)'}}>
                  <div style={{fontSize:28,marginBottom:8}}>📭</div>
                  <div>Nenhum registro encontrado.</div>
                </div>
              ) : (
                <div style={{position:'relative'}}>
                  {histFiltrado.map((h,i)=>{
                    const cfg=getCfg(h.tipo)
                    return(
                      <div key={i} style={{display:'flex',gap:12,position:'relative'}}>
                        {/* Coluna esquerda */}
                        <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:36}}>
                          <div style={{width:36,height:36,borderRadius:'50%',background:cfg.bg,border:`2px solid ${cfg.color}25`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,zIndex:1,flexShrink:0}}>
                            {cfg.icon}
                          </div>
                          {i<histFiltrado.length-1&&(
                            <div style={{width:2,flex:1,minHeight:12,background:'rgba(0,0,0,0.08)',margin:'2px 0'}}/>
                          )}
                        </div>

                        {/* Corpo */}
                        <div style={{flex:1,paddingBottom:14}}>
                          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                            <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                              <span style={{fontSize:10,fontWeight:600,padding:'2px 7px',borderRadius:4,background:cfg.bg,color:cfg.color}}>
                                {cfg.label}
                              </span>
                              {h.setor&&h.setor!=='Geral'&&(
                                <span style={{fontSize:10,color:'#888',background:'#F1EFE8',padding:'2px 6px',borderRadius:4}}>📍 {h.setor}</span>
                              )}
                            </div>
                            <span style={{fontSize:11,color:'#aaa',whiteSpace:'nowrap'}}>{fmtDate(h.data)}</span>
                          </div>

                          <div style={{background:'#f8f7f3',borderRadius:8,padding:'8px 10px'}}>
                            {/* Qtd/valor */}
                            {(h.quantidade>0||h.valor>0)&&(
                              <div style={{display:'flex',gap:8,marginBottom:6}}>
                                {h.quantidade>0&&<span style={{fontSize:11,fontWeight:700,color:cfg.color}}>{h.quantidade} {h.unidade}</span>}
                                {h.valor>0&&<span style={{fontSize:11,fontWeight:700,color:'var(--green)'}}>{fmt(h.valor)}</span>}
                              </div>
                            )}
                            <div style={{fontSize:12,color:'#555',lineHeight:1.5}}>{h.descricao}</div>
                            {/* Responsável + custo (campos novos) */}
                            {(h.responsavel||h.custo_total>0)&&(
                              <div style={{display:'flex',gap:6,marginTop:6,flexWrap:'wrap'}}>
                                {h.responsavel&&(
                                  <span style={{fontSize:10,background:'#F1EFE8',color:'#666',padding:'2px 7px',borderRadius:4}}>👤 {h.responsavel}</span>
                                )}
                                {h.custo_total>0&&(
                                  <span style={{fontSize:10,background:'#FAEEDA',color:'#854F0B',padding:'2px 7px',borderRadius:4}}>💸 {fmt(h.custo_total)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderTop:'0.5px solid rgba(0,0,0,0.1)',flexShrink:0}}>
              <div style={{fontSize:12,color:'#888'}}>{historico.length} registro(s)</div>
              <div style={{display:'flex',gap:8}}>
                <button
                  onClick={()=>exportarFichaPDF({...detalhe,r:resumo[detalhe.id]??{}},detSetores,histFiltrado)}
                  style={{fontSize:12,padding:'6px 14px',borderRadius:8,border:'0.5px solid #C0DD97',background:'#EAF3DE',color:'#2d6a2d',cursor:'pointer',fontFamily:'inherit'}}
                >
                  📄 Exportar PDF
                </button>
                <button
                  onClick={e=>{excluir(detalhe.id,e);setDetalhe(null)}}
                  style={{fontSize:12,padding:'6px 14px',borderRadius:8,border:'0.5px solid #F7C1C1',background:'#FCEBEB',color:'#A32D2D',cursor:'pointer',fontFamily:'inherit'}}
                >
                  ✕ Excluir lote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CRIAR/EDITAR ── */}
      {modal && (
        <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal" style={{maxWidth:580}}>
            <div className="modal-header">
              <h3>{editId?'Editar lote':'Novo lote'}</h3>
              <button className="modal-close" onClick={()=>setModal(false)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>Nome *</label>
                <input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} placeholder="ex: A370"/>
              </div>
              <div className="form-group"><label>Área (ha)</label>
                <input type="number" step="0.1" value={form.area_ha} onChange={e=>setForm(f=>({...f,area_ha:e.target.value}))} placeholder="2.5"/>
              </div>
              <div className="form-group"><label>Status</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                  <option value="ativo">Ativo</option>
                  <option value="em_repouso">Em repouso</option>
                  <option value="colhido">Colhido</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div className="form-group"><label>Nº de setores</label>
                <input type="number" min="1" max="20" value={formSetores.length} onChange={e=>handleQtdSetores(e.target.value)}/>
              </div>
              <div className="form-group form-full"><label>Observações</label>
                <textarea value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}/>
              </div>
            </div>

            <div style={{fontWeight:600,fontSize:13,marginBottom:10,borderTop:'1px solid var(--border)',paddingTop:14}}>
              🌿 Setores ({formSetores.length})
            </div>

            {formSetores.map((s,idx)=>{
              const sugestoes=s.cultura?(varPorCultura[s.cultura]??[]):[]
              return(
                <div key={idx} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',padding:12,marginBottom:10}}>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'flex-end'}}>
                    <div className="form-group" style={{marginBottom:0,flex:1,minWidth:90}}><label>Nome</label>
                      <input value={s.nome} onChange={e=>updateSetor(idx,'nome',e.target.value)} placeholder={`Setor ${idx+1}`}/>
                    </div>
                    <div className="form-group" style={{marginBottom:0,flex:2,minWidth:120}}><label>Cultura</label>
                      <select value={culturasDB.some(c=>c.nome===s.cultura)?s.cultura:'__outra'} onChange={e=>{
                        if(e.target.value!=='__outra') updateSetor(idx,'cultura',e.target.value)
                        else updateSetor(idx,'cultura','')
                      }}>
                        <option value="">— Selecione —</option>
                        {culturasDB.map(c=><option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>)}
                        <option value="__outra">Outra...</option>
                      </select>
                      {!culturasDB.some(c=>c.nome===s.cultura)&&s.cultura!==''&&(
                        <input style={{marginTop:4}} value={s.cultura} onChange={e=>updateSetor(idx,'cultura',e.target.value)} placeholder="Digite a cultura"/>
                      )}
                    </div>
                    <div className="form-group" style={{marginBottom:0,flex:2,minWidth:120}}><label>Variedade</label>
                      {sugestoes.length>0?(
                        <select value={sugestoes.includes(s.variedade)?s.variedade:'__nova'} onChange={e=>{
                          if(e.target.value!=='__nova') updateSetor(idx,'variedade',e.target.value)
                          else updateSetor(idx,'variedade','')
                        }} disabled={!s.cultura}>
                          <option value="">— Selecione —</option>
                          {sugestoes.map(v=><option key={v} value={v}>{v}</option>)}
                          <option value="__nova">+ Nova variedade</option>
                        </select>
                      ):null}
                      {(sugestoes.length===0||!sugestoes.includes(s.variedade))&&(
                        <input style={{marginTop:sugestoes.length>0?4:0}} value={s.variedade} onChange={e=>updateSetor(idx,'variedade',e.target.value)} placeholder={s.cultura?'ex: Nanica, Prata...':'Selecione a cultura'} disabled={!s.cultura}/>
                      )}
                    </div>
                    <div className="form-group" style={{marginBottom:0,flex:2,minWidth:110}}><label>Estágio</label>
                      <select value={s.estagio} onChange={e=>updateSetor(idx,'estagio',e.target.value)}>
                        {ESTAGIOS.map(e=><option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{marginBottom:0,flex:1,minWidth:80}}><label>Área (ha)</label>
                      <input type="number" step="0.01" value={s.area_hectares} onChange={e=>updateSetor(idx,'area_hectares',e.target.value)} placeholder="0.5"/>
                    </div>
                    <div className="form-group" style={{marginBottom:0,flex:1,minWidth:110}}><label>Data plantio</label>
                      <input type="date" value={s.data_plantio} onChange={e=>updateSetor(idx,'data_plantio',e.target.value)}/>
                    </div>
                    {/* Status do setor */}
                    <div className="form-group" style={{marginBottom:0,flex:1,minWidth:110}}><label>Saúde</label>
                      <select value={s.status??'saudavel'} onChange={e=>updateSetor(idx,'status',e.target.value)}>
                        <option value="saudavel">🟢 Saudável</option>
                        <option value="atencao">🟡 Atenção</option>
                        <option value="problema">🔴 Problema</option>
                        <option value="vazio">⚪ Vazio</option>
                      </select>
                    </div>
                  </div>
                </div>
              )
            })}

            <div className="modal-footer">
              <button className="btn" onClick={()=>setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save} disabled={saving} style={{flex:1}}>
                {saving?'Salvando...':editId?'✓ Salvar':'✓ Criar lote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, statusLoteBadge } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

// ─── CONSTANTES ──────────────────────────────────────────────
const ESTAGIOS = ['jovem','producao','final']
const ESTAGIO_LABEL = { jovem:'🌱 Jovem', producao:'🍌 Produção', final:'🍂 Final' }
const STATUS_LOTE = ['ativo','inativo']

const novoSetor = (n) => ({
  _key: Date.now() + n,   // chave temporária para o React (não é ID do banco)
  _id: null,              // null = novo; string = ID existente no banco
  nome: `Setor ${n}`,
  cultura: '',
  variedades: [],         // array de strings
  novaVariedade: '',      // campo de texto para digitar nova variedade
  estagio: 'producao',
  area_hectares: '',
  data_plantio: '',
})

const TIPO_ICON = {
  'Adubação':'🌿','Aplicação Fitossanitária':'💊','Aplicação Orgânica':'♻️',
  'Aplicação':'🧪','Plantio':'🌱','Colheita':'📦','Venda':'💰',
}
const TIPO_COLOR = {
  'Adubação':'#2d6a2d','Aplicação Fitossanitária':'#A32D2D','Aplicação Orgânica':'#166534',
  'Aplicação':'#1D4ED8','Plantio':'#065F46','Colheita':'#92400E','Venda':'#166534',
}
const TIPO_BG = {
  'Adubação':'#EAF3DE','Aplicação Fitossanitária':'#FCEBEB','Aplicação Orgânica':'#F0FDF4',
  'Aplicação':'#EFF6FF','Plantio':'#ECFDF5','Colheita':'#FFFBEB','Venda':'#F0FDF4',
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function Lotes({ onAddBtn }) {
  const { tenantId } = useAuth()
  // dados gerais
  const [lotes, setLotes]       = useState([])
  const [resumo, setResumo]     = useState({})
  const [setsMap, setSetsMap]   = useState({})   // lote_id → setores[]
  const [culturas, setCulturas] = useState([])
  const [loading, setLoading]   = useState(true)

  // modal edição
  const [editAberto, setEditAberto] = useState(false)
  const [editLote, setEditLote]   = useState(null)  // null=novo
  const [fNome, setFNome]         = useState('')
  const [fArea, setFArea]         = useState('')
  const [fStatus, setFStatus]     = useState('ativo')
  const [fObs, setFObs]           = useState('')
  const [fSetores, setFSetores]   = useState([novoSetor(1)])
  const [salvando, setSalvando]   = useState(false)
  const [erroEdit, setErroEdit]   = useState('')

  // modal detalhe
  const [detLote, setDetLote]     = useState(null)
  const [detSets, setDetSets]     = useState([])
  const [hist, setHist]           = useState([])
  const [loadHist, setLoadHist]   = useState(false)
  const [filtHist, setFiltHist]   = useState('todos')

  // filtros lista
  const [busca, setBusca]         = useState('')
  const [fSt, setFSt]             = useState('')
  const [view, setView]           = useState('cards')
  const [varSugestoes, setVarSugestoes] = useState([])
  const [varCadCompleto, setVarCadComp] = useState([]) // { nome, cultura }

  useEffect(() => { loadTudo() }, [])
  useEffect(() => { if (onAddBtn) onAddBtn(abrirNovo) }, [lotes])

  // ─── CARREGA ───────────────────────────────────────────────
  const loadTudo = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    const [
      { data: ls, error: e1 },
      { data: rs },
      { data: sts },
      { data: cs },
      { data: vs2 },
    ] = await Promise.all([
      supabase.from('lotes').select('*').order('nome'),
      supabase.from('vw_resumo_por_lote').select('*'),
      supabase.from('setores').select('*, setor_variedades(id, variedade)').order('nome'),
      supabase.from('culturas').select('id,nome,icone').eq('ativo',true).is('deleted_at',null).order('nome'),
      supabase.from('variedades_cadastradas').select('nome, cultura').order('cultura').order('nome'),
    ])

    if (e1) { console.error('Erro ao carregar lotes:', e1); setLoading(false); return }

    setLotes(ls ?? [])
    const m = {}; (rs ?? []).forEach(r => { m[r.lote_id] = r }); setResumo(m)
    const s = {}
    ;(sts ?? []).forEach(st => {
      if (!s[st.lote_id]) s[st.lote_id] = []
      s[st.lote_id].push(st)
    })
    setSetsMap(s)
    setCulturas(cs ?? [])
    const sugs = (vs2 ?? []).map(v => v.nome).filter(Boolean)
    setVarSugestoes(sugs)
    setVarCadComp(vs2 ?? [])
    if (!silencioso) setLoading(false)
  }, [])

  // ─── ABRE NOVO ─────────────────────────────────────────────
  function abrirNovo() {
    setEditLote(null)
    setFNome(''); setFArea(''); setFStatus('ativo'); setFObs('')
    setFSetores([novoSetor(1)])
    setErroEdit('')
    setEditAberto(true)
  }

  // ─── ABRE EDITAR ───────────────────────────────────────────
  async function abrirEditar(lote) {
    setEditLote(lote)
    setFNome(lote.nome)
    setFArea(lote.area_ha ?? '')
    setFStatus(lote.status ?? 'ativo')
    setFObs(lote.observacoes ?? '')
    setErroEdit('')

    // Busca setores + variedades do banco
    const { data: sts, error } = await supabase
      .from('setores')
      .select('*, setor_variedades(id, variedade)')
      .eq('lote_id', lote.id)
      .order('nome')

    if (error) {
      console.error('Erro ao buscar setores:', error)
      setFSetores([novoSetor(1)])
    } else if (sts && sts.length > 0) {
      setFSetores(sts.map((s, i) => ({
        _key: s.id,
        _id: s.id,
        nome: s.nome ?? '',
        cultura: s.cultura ?? '',
        variedades: s.variedade ? [s.variedade] : (s.setor_variedades ?? []).map(v => v.variedade),
        novaVariedade: '',
        estagio: s.estagio ?? 'producao',
        area_hectares: s.area_hectares ?? '',
        data_plantio: s.data_plantio ?? '',
      })))
    } else {
      setFSetores([novoSetor(1)])
    }

    setEditAberto(true)
  }

  // ─── ATUALIZA CAMPO DO SETOR ────────────────────────────────
  function updSetor(idx, campo, valor) {
    setFSetores(prev => prev.map((s, i) => {
      if (i !== idx) return s
      if (campo === 'cultura') return { ...s, cultura: valor, variedades: [], novaVariedade: '' }
      return { ...s, [campo]: valor }
    }))
  }

  // Adiciona variedade ao setor
  function addVariedade(idx) {
    setFSetores(prev => prev.map((s, i) => {
      if (i !== idx) return s
      const nova = s.novaVariedade.trim().toUpperCase()
      if (!nova || s.variedades.includes(nova)) return { ...s, novaVariedade: '' }
      return { ...s, variedades: [...s.variedades, nova], novaVariedade: '' }
    }))
  }

  // Remove variedade do setor
  function rmVariedade(idx, v) {
    setFSetores(prev => prev.map((s, i) => {
      if (i !== idx) return s
      return { ...s, variedades: s.variedades.filter(x => x !== v) }
    }))
  }

  function addSetor() {
    setFSetores(prev => [...prev, novoSetor(prev.length + 1)])
  }

  function rmSetor(idx) {
    if (fSetores.length === 1) return
    setFSetores(prev => prev.filter((_, i) => i !== idx))
  }

  // ─── SALVA ─────────────────────────────────────────────────
  async function salvar() {
    if (!fNome.trim()) { setErroEdit('Informe o nome do lote.'); return }
    setSalvando(true); setErroEdit('')
    try {
      const setoresPayload = fSetores.map(s => ({
        _id: s._id || null,
        nome: s.nome || 'Setor',
        cultura: s.cultura || null,
        variedade: s.variedades ? s.variedades[0] || null : null,
        estagio: s.estagio || 'producao',
        area_hectares: parseFloat(s.area_hectares) || null,
        data_plantio: s.data_plantio || null,
      }))
      const { error } = await supabase.rpc('fn_salvar_lote_completo', {
        p_lote_id: editLote ? editLote.id : null,
        p_nome: fNome.trim(),
        p_area_ha: parseFloat(fArea) || null,
        p_status: fStatus,
        p_observacoes: fObs || null,
        p_setores: setoresPayload,
        p_tenant_id: tenantId,
      })
      if (error) throw new Error(error.message)
      setEditAberto(false)
      await loadTudo(true)
    } catch(err) { setErroEdit(err.message) }
    finally { setSalvando(false) }
  }

  async function excluir(id, e) {
    e?.stopPropagation()
    if (!window.confirm('Excluir este lote?')) return
    await supabase.from('setores').delete().eq('lote_id', id)
    await supabase.from('lotes').delete().eq('id', id)
    loadTudo()
  }

  // ─── ABRE DETALHE ──────────────────────────────────────────
  async function abrirDetalhe(lote) {
    setDetLote(lote); setFiltHist('todos'); setLoadHist(true)
    const [{ data: sts }, { data: h }] = await Promise.all([
      supabase.from('setores').select('*, setor_variedades(variedade)').eq('lote_id', lote.id).order('nome'),
      supabase.from('vw_historico_lote').select('*').eq('lote_id', lote.id).order('data', { ascending: false }),
    ])
    setDetSets(sts ?? [])
    setHist(h ?? [])
    setLoadHist(false)
  }

  const histFiltrado = useMemo(() => {
    return hist.filter(h => {
      if (filtHist === 'todos') return true
      if (filtHist === 'campo') return h.origem === 'atividade'
      if (filtHist === 'producao') return h.origem === 'producao'
      if (filtHist === 'venda') return h.origem === 'venda'
      return h.tipo === filtHist
    })
  }, [hist, filtHist])

  const lotesFiltrados = useMemo(() => {
    let lista = lotes.map(l => ({ ...l, r: resumo[l.id] ?? {}, sts: setsMap[l.id] ?? [] }))
    if (busca) lista = lista.filter(l => l.nome.toLowerCase().includes(busca.toLowerCase()))
    if (fSt) lista = lista.filter(l => l.status === fSt)
    return lista.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [lotes, resumo, setsMap, busca, fSt])

  if (loading) return <div className="loading">Carregando lotes...</div>

  const totalReceita = lotesFiltrados.reduce((s,l) => s + Number(l.r.receita_bruta ?? 0), 0)
  const totalLucro   = lotesFiltrados.reduce((s,l) => s + Number(l.r.lucro_bruto ?? 0), 0)

  return (
    <>
      {/* ── FILTROS ── */}
      <div className="card" style={{ marginBottom:12, padding:'12px 16px' }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
          <div className="form-group" style={{ marginBottom:0, flex:2, minWidth:140 }}>
            <label>Buscar</label>
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="ex: A363" />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Status</label>
            <select value={fSt} onChange={e => setFSt(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_LOTE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <button className="btn btn-sm" style={{ background:view==='tabela'?'var(--green)':'', color:view==='tabela'?'white':'' }} onClick={() => setView('tabela')}>📋</button>
            <button className="btn btn-sm" style={{ background:view==='cards'?'var(--green)':'',  color:view==='cards'?'white':''  }} onClick={() => setView('cards')}>🧱</button>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        {[
          { label:'Lotes',   val: lotesFiltrados.length },
          { label:'Receita', val: fmt(totalReceita), color:'var(--teal)' },
          { label:'Lucro',   val: fmt(totalLucro),   color:'var(--green)' },
        ].map(k => (
          <div key={k.label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'8px 14px' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase' }}>{k.label}</div>
            <div style={{ fontSize:16, fontWeight:700, color:k.color ?? 'var(--text)', marginTop:2 }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* ── LISTA ── */}
      {lotesFiltrados.length === 0
        ? <div className="empty">Nenhum lote encontrado.</div>
        : view === 'tabela' ? (
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
                  {lotesFiltrados.map(l => {
                    const {cls, label} = statusLoteBadge(l.status)
                    const lucro = Number(l.r.lucro_bruto ?? 0)
                    const varDesc = [...new Set(l.sts.map(s => s.variedade).filter(Boolean))].slice(0,4).join(', ')
                    return (
                      <tr key={l.id} style={{cursor:'pointer'}} onClick={() => abrirDetalhe(l)}>
                        <td><strong>{l.nome}</strong></td>
                        <td style={{fontSize:12, color:'var(--text-muted)'}}>{varDesc || '—'}</td>
                        <td style={{fontSize:12}}>{l.area_ha ? `${l.area_ha} ha` : '—'}</td>
                        <td style={{textAlign:'right', color:'var(--teal)', fontWeight:600}}>{fmt(l.r.receita_bruta)}</td>
                        <td style={{textAlign:'right', fontWeight:700, color:lucro>=0?'var(--green)':'var(--red)'}}>{fmt(lucro)}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td>
                          <div style={{display:'flex', gap:4}} onClick={e => e.stopPropagation()}>
                            <button className="btn btn-sm" onClick={() => abrirEditar(l)}>✎</button>
                            <button className="btn btn-sm btn-danger" onClick={e => excluir(l.id, e)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(175px,1fr))', gap:10}}>
            {lotesFiltrados.map(l => {
              const lucro = Number(l.r.lucro_bruto ?? 0)
              const vars = [...new Set(l.sts.map(s => s.variedade || (s.setor_variedades??[])[0]?.variedade).filter(Boolean))].slice(0,3)
              return (
                <div key={l.id} className="card" style={{marginBottom:0, cursor:'pointer', padding:'12px 14px'}} onClick={() => abrirDetalhe(l)}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                    <div style={{fontWeight:700, fontSize:15}}>{l.nome}</div>
                    <button className="btn btn-sm" style={{padding:'2px 6px', fontSize:10}} onClick={e => { e.stopPropagation(); abrirEditar(l) }}>✎</button>
                  </div>
                  {vars.length > 0 && <div style={{fontSize:11, color:'var(--text-muted)', marginBottom:6}}>{vars.join(', ')}</div>}
                  <div style={{fontWeight:700, fontSize:17, color:lucro>=0?'var(--green)':'var(--red)'}}>{fmt(lucro)}</div>
                  <div style={{fontSize:11, color:'var(--text-muted)', marginTop:4}}>{l.sts.length} setor(es)</div>
                </div>
              )
            })}
            <div className="card" style={{marginBottom:0, display:'flex', alignItems:'center', justifyContent:'center', minHeight:120, cursor:'pointer', border:'1px dashed var(--border)'}} onClick={abrirNovo}>
              <div style={{textAlign:'center', color:'var(--text-muted)'}}><div style={{fontSize:24}}>+</div><div style={{fontSize:12}}>Novo lote</div></div>
            </div>
          </div>
        )}

      <button className="fab" onClick={abrirNovo}>+</button>

      {/* ═══════════════════════════════════════════
          MODAL EDITAR / CRIAR
      ═══════════════════════════════════════════ */}
      {editAberto && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setEditAberto(false)}>
          <div className="modal" style={{maxWidth:620, maxHeight:'92vh', display:'flex', flexDirection:'column'}}>
            <div className="modal-header" style={{flexShrink:0}}>
              <h3>{editLote ? `Editar — ${editLote.nome}` : 'Novo lote'}</h3>
              <button className="modal-close" onClick={() => setEditAberto(false)}>✕</button>
            </div>

            <div style={{flex:1, overflowY:'auto', padding:'0 20px 4px'}}>
              {erroEdit && (
                <div style={{background:'#FCEBEB', color:'#A32D2D', borderRadius:8, padding:'8px 14px', marginBottom:12, fontSize:13}}>
                  ⚠️ {erroEdit}
                </div>
              )}

              {/* Dados do lote */}
              <div className="form-grid" style={{marginBottom:16, paddingTop:16}}>
                <div className="form-group">
                  <label>Nome *</label>
                  <input value={fNome} onChange={e => setFNome(e.target.value)} placeholder="ex: A363" autoFocus />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={fStatus} onChange={e => setFStatus(e.target.value)}>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
                <div className="form-group form-full">
                  <label>Observações</label>
                  <textarea value={fObs} onChange={e => setFObs(e.target.value)} rows={2} />
                </div>
              </div>

              {/* Setores */}
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, borderTop:'1px solid var(--border)', paddingTop:14}}>
                <span style={{fontWeight:600, fontSize:13}}>🌿 Setores ({fSetores.length})</span>
                <button className="btn btn-sm" style={{background:'var(--green)', color:'white'}} onClick={addSetor}>+ Setor</button>
              </div>

              {fSetores.map((s, idx) => (
                <div key={s._key} style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:12}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                    <span style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>
                      {s.nome || `Setor ${idx+1}`}
                      {!s._id && <span style={{fontSize:10, color:'var(--teal)', marginLeft:6, fontWeight:400}}>● novo</span>}
                    </span>
                    {fSetores.length > 1 && (
                      <button className="btn btn-sm btn-danger" style={{fontSize:11}} onClick={() => rmSetor(idx)}>✕ Remover</button>
                    )}
                  </div>

                  <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                    {/* Nome */}
                    <div className="form-group" style={{marginBottom:0, flex:'1 1 100px'}}>
                      <label>Nome do setor</label>
                      <input value={s.nome} onChange={e => updSetor(idx,'nome',e.target.value)} placeholder="ex: Setor 1" />
                    </div>

                    {/* Cultura */}
                    <div className="form-group" style={{marginBottom:0, flex:'2 1 140px'}}>
                      <label>Cultura</label>
                      <select value={s.cultura} onChange={e => updSetor(idx,'cultura',e.target.value)}>
                        <option value="">— Selecione —</option>
                        {culturas.map(c => <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>)}
                        <option value="__outra">Outra...</option>
                      </select>
                      {s.cultura === '__outra' && (
                        <input style={{marginTop:4}} placeholder="Digite a cultura" onChange={e => updSetor(idx,'cultura',e.target.value)} />
                      )}
                    </div>

                    {/* Estágio */}
                    <div className="form-group" style={{marginBottom:0, flex:'1 1 100px'}}>
                      <label>Estágio</label>
                      <select value={s.estagio} onChange={e => updSetor(idx,'estagio',e.target.value)}>
                        {ESTAGIOS.map(e => <option key={e} value={e}>{ESTAGIO_LABEL[e]}</option>)}
                      </select>
                    </div>

                    {/* Área */}
                    <div className="form-group" style={{marginBottom:0, flex:'1 1 80px'}}>
                      <label>Área (ha)</label>
                      <input type="number" step="0.01" value={s.area_hectares} onChange={e => updSetor(idx,'area_hectares',e.target.value)} placeholder="0.5" />
                    </div>

                    {/* Data plantio */}
                    <div className="form-group" style={{marginBottom:0, flex:'1 1 110px'}}>
                      <label>Data plantio</label>
                      <input type="date" value={s.data_plantio} onChange={e => updSetor(idx,'data_plantio',e.target.value)} />
                    </div>
                  </div>

                  {/* Variedade */}
                  <div style={{marginTop:8}}>
                    <label style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', display:'block', marginBottom:6}}>Variedade</label>
                    <select
                      value={s.variedades[0] || ''}
                      onChange={e => {
                        setFSetores(prev => prev.map((ss, ii) =>
                          ii !== idx ? ss : {...ss, variedades: e.target.value ? [e.target.value] : [], novaVariedade: ''}
                        ))
                      }}
                      style={{width:'100%'}}
                      disabled={!s.cultura}
                    >
                      <option value="">-- Selecione a variedade --</option>
                      {varCadCompleto
                        .filter(v => v.cultura === s.cultura)
                        .map(v => <option key={v.nome} value={v.nome}>{v.nome}</option>)}
                    </select>
                    {!s.cultura && <div style={{fontSize:11, color:'var(--amber)', marginTop:3}}>⚠ Selecione a cultura primeiro</div>}
                    {s.cultura && varCadCompleto.filter(v => v.cultura === s.cultura).length === 0 && (
                      <div style={{fontSize:11, color:'var(--amber)', marginTop:3}}>⚠ Nenhuma variedade cadastrada para {s.cultura}. Adicione em Culturas.</div>
                    )}
                    {s.novaVariedade === 'DIGITAR' && (
                      <div style={{display:'flex', gap:6, marginTop:6}}>
                        <input
                          autoFocus
                          placeholder="Digite e pressione Enter..."
                          style={{flex:1, fontSize:13}}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const nova = e.target.value.trim().toUpperCase()
                              if (nova) {
                                setFSetores(prev => prev.map((ss, ii) =>
                                  ii !== idx ? ss : {...ss, variedades: [nova], novaVariedade: ''}
                                ))
                                supabase.from('variedades_cadastradas').insert({nome: nova, tenant_id: tenantId}).then(() =>
                                  setVarSugestoes(prev => [...new Set([...prev, nova])].sort())
                                )
                              }
                            }
                            if (e.key === 'Escape') updSetor(idx, 'novaVariedade', '')
                          }}
                        />
                        <button className="btn btn-sm" style={{background:'var(--green)', color:'white'}}
                          onClick={e => {
                            const input = e.currentTarget.previousSibling
                            const nova = input.value.trim().toUpperCase()
                            if (nova) {
                              setFSetores(prev => prev.map((ss, ii) =>
                                ii !== idx ? ss : {...ss, variedades: [nova], novaVariedade: ''}
                              ))
                              supabase.from('variedades_cadastradas').insert({nome: nova, tenant_id: tenantId}).then(() =>
                                setVarSugestoes(prev => [...new Set([...prev, nova])].sort())
                              )
                            }
                          }}>Salvar</button>
                        <button className="btn btn-sm" onClick={() => updSetor(idx, 'novaVariedade', '')}>X</button>
                      </div>
                    )}
                    {s.variedades[0] && s.novaVariedade !== 'DIGITAR' && (
                      <div style={{marginTop:4, display:'flex', alignItems:'center', gap:6}}>
                        <span style={{background:'#EAF3DE', color:'#2d6a2d', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:600}}>
                          {s.variedades[0]}
                        </span>
                        <button onClick={() => setFSetores(prev => prev.map((ss,ii) => ii!==idx ? ss : {...ss, variedades:[], novaVariedade:''})) } style={{background:'none', border:'none', color:'#A32D2D', cursor:'pointer', fontSize:16, lineHeight:1, padding:0}}>×</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{flexShrink:0}}>
              <button className="btn" onClick={() => setEditAberto(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={salvar} disabled={salvando} style={{flex:1, fontSize:15}}>
                {salvando ? 'Salvando...' : editLote ? '✓ Salvar alterações' : '✓ Criar lote'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MODAL DETALHE + HISTÓRICO
      ═══════════════════════════════════════════ */}
      {detLote && (
        <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && setDetLote(null)}>
          <div className="modal" style={{maxWidth:620, maxHeight:'92vh', display:'flex', flexDirection:'column'}}>

            <div className="modal-header" style={{flexShrink:0}}>
              <div>
                <h3>{detLote.nome}</h3>
                <div style={{fontSize:12, color:'var(--text-muted)'}}>{detLote.area_ha ? `${detLote.area_ha} ha · ` : ''}{detSets.length} setor(es)</div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <button className="btn btn-sm" onClick={() => { setDetLote(null); abrirEditar(detLote) }}>✎ Editar</button>
                <button className="modal-close" onClick={() => setDetLote(null)}>✕</button>
              </div>
            </div>

            {/* KPIs */}
            <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, padding:'12px 20px', flexShrink:0, borderBottom:'1px solid var(--border)'}}>
              {[
                {label:'Receita', val:fmt(resumo[detLote.id]?.receita_bruta), color:'var(--teal)'},
                {label:'Custo',   val:fmt(resumo[detLote.id]?.custo_total),   color:'var(--amber)'},
                {label:'Lucro',   val:fmt(resumo[detLote.id]?.lucro_bruto),   color:Number(resumo[detLote.id]?.lucro_bruto??0)>=0?'var(--green)':'var(--red)'},
                {label:'Margem',  val:`${Number(resumo[detLote.id]?.margem_pct??0).toFixed(1)}%`},
              ].map(k => (
                <div key={k.label} style={{background:'var(--bg)', borderRadius:8, padding:'8px 10px', textAlign:'center'}}>
                  <div style={{fontSize:10, color:'var(--text-muted)', fontWeight:600}}>{k.label}</div>
                  <div style={{fontSize:15, fontWeight:700, color:k.color??'var(--text)', marginTop:2}}>{k.val}</div>
                </div>
              ))}
            </div>

            {/* Setores com variedades */}
            {detSets.length > 0 && (
              <div style={{padding:'10px 20px', flexShrink:0, borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:12, fontWeight:600, color:'var(--text-muted)', marginBottom:8}}>🌿 Setores</div>
                <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
                  {detSets.map(s => {
                    const vars = s.variedade ? [s.variedade] : (s.setor_variedades ?? []).map(v => v.variedade).filter(Boolean)
                    return (
                      <div key={s.id} style={{background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', fontSize:12}}>
                        <strong>{s.nome}</strong>
                        {vars.length > 0 && (
                          <div style={{display:'flex', gap:4, flexWrap:'wrap', marginTop:4}}>
                            {vars.map(v => (
                              <span key={v} style={{fontSize:10, background:'#EAF3DE', color:'#2d6a2d', borderRadius:4, padding:'1px 6px', fontWeight:600}}>{v}</span>
                            ))}
                          </div>
                        )}
                        {s.area_hectares && <div style={{fontSize:10, color:'var(--text-muted)', marginTop:3}}>{s.area_hectares} ha</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Filtros */}
            <div style={{display:'flex', gap:6, padding:'10px 20px', flexShrink:0, overflowX:'auto', borderBottom:'1px solid var(--border)'}}>
              {[
                {k:'todos',    l:'Todos'},
                {k:'campo',    l:'🌾 Campo'},
                {k:'Adubação', l:'🌿 Adubação'},
                {k:'Aplicação Fitossanitária', l:'💊 Fito'},
                {k:'Plantio',  l:'🌱 Plantio'},
                {k:'producao', l:'📦 Colheita'},
                {k:'venda',    l:'💰 Venda'},
              ].map(f => (
                <button key={f.k} onClick={() => setFiltHist(f.k)} style={{
                  fontSize:11, padding:'4px 10px', borderRadius:16, border:'0.5px solid',
                  cursor:'pointer', whiteSpace:'nowrap',
                  background: filtHist===f.k ? 'var(--green)' : 'var(--bg)',
                  color:      filtHist===f.k ? 'white' : 'var(--text-muted)',
                  borderColor:filtHist===f.k ? 'var(--green)' : 'var(--border)',
                }}>{f.l}</button>
              ))}
            </div>

            {/* Timeline */}
            <div style={{flex:1, overflowY:'auto', padding:'14px 20px'}}>
              {loadHist ? (
                <div style={{textAlign:'center', padding:24, color:'var(--text-muted)'}}>Carregando histórico...</div>
              ) : histFiltrado.length === 0 ? (
                <div style={{textAlign:'center', padding:24, color:'var(--text-muted)'}}>📭 Sem registros</div>
              ) : histFiltrado.map((h, i) => {
                const icon  = TIPO_ICON[h.tipo]  ?? '📝'
                const color = TIPO_COLOR[h.tipo] ?? '#555'
                const bg    = TIPO_BG[h.tipo]    ?? '#F1EFE8'
                return (
                  <div key={i} style={{display:'flex', gap:12}}>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:36}}>
                      <div style={{width:36, height:36, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0}}>{icon}</div>
                      {i < histFiltrado.length-1 && <div style={{width:2, flex:1, minHeight:12, background:'rgba(0,0,0,0.08)', margin:'2px 0'}}/>}
                    </div>
                    <div style={{flex:1, paddingBottom:14}}>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:4}}>
                        <span style={{fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:4, background:bg, color}}>{h.tipo}</span>
                        <span style={{fontSize:11, color:'#aaa'}}>{fmtDate(h.data)}</span>
                      </div>
                      <div style={{background:'#f8f7f3', borderRadius:8, padding:'8px 10px', fontSize:12, color:'#555', lineHeight:1.5}}>
                        {h.quantidade > 0 && <div style={{fontWeight:700, color, marginBottom:4}}>{h.quantidade} {h.unidade}</div>}
                        {h.valor > 0 && <div style={{fontWeight:700, color:'var(--green)', marginBottom:4}}>{fmt(h.valor)}</div>}
                        {h.descricao}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', borderTop:'1px solid var(--border)', flexShrink:0}}>
              <span style={{fontSize:12, color:'var(--text-muted)'}}>{hist.length} registro(s)</span>
              <button className="btn btn-danger" onClick={e => { excluir(detLote.id, e); setDetLote(null) }}>✕ Excluir lote</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

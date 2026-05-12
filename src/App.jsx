import React, { useState, useRef, lazy, Suspense, createContext, useContext } from 'react'
import Login from './pages/Login'
import { useOfflineSync } from './hooks/useOfflineSync'
import OfflineBar from './components/OfflineBar'

// Hook embutido
function useIsMobile(bp) {
  const [m, setM] = React.useState(() => window.innerWidth < (bp || 768))
  React.useEffect(() => {
    const h = () => setM(window.innerWidth < (bp || 768))
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [bp])
  return m
}

// Context para compartilhar offline.save com as páginas
export const OfflineContext = createContext(null)
export function useOffline() { return useContext(OfflineContext) }

// ─── LAZY PAGES ──────────────────────────────────────────────
const Dashboard    = lazy(() => import('./pages/Dashboard'))
const Lotes        = lazy(() => import('./pages/Lotes'))
const Producao     = lazy(() => import('./pages/Producao'))
const Vendas       = lazy(() => import('./pages/Vendas'))
const Custos       = lazy(() => import('./pages/Custos'))
const Financeiro   = lazy(() => import('./pages/Financeiro'))
const Estoque      = lazy(() => import('./pages/Estoque'))
const Atividades   = lazy(() => import('./pages/Atividades'))
const Programacao  = lazy(() => import('./pages/Programacao'))
const Clientes     = lazy(() => import('./pages/Clientes'))
const Fornecedores = lazy(() => import('./pages/Fornecedores'))
const Culturas     = lazy(() => import('./pages/Culturas'))

const PAGE_LABELS = {
  Dashboard:'Dashboard', Lotes:'Lotes / Piquetes', Culturas:'Culturas',
  Producao:'Produção', Atividades:'Atividades', Programacao:'Programação',
  Estoque:'Estoque', Vendas:'Vendas', Custos:'Custos', Financeiro:'Financeiro',
  Clientes:'Clientes', Fornecedores:'Fornecedores',
}
const ADD_LABELS = {
  Lotes:'+ Novo lote', Culturas:'+ Nova cultura', Producao:'+ Nova carga',
  Vendas:'+ Nova venda', Custos:'+ Novo custo', Estoque:'+ Novo insumo',
  Atividades:'+ Nova atividade', Programacao:'+ Nova programação',
  Clientes:'+ Novo cliente', Fornecedores:'+ Novo fornecedor',
}
const SHEETS = {
  campo: { label:'Campo', items:[
    { icon:'🗺️', label:'Lotes / Piquetes', page:'Lotes' },
    { icon:'🌱', label:'Culturas', page:'Culturas' },
    { icon:'🌾', label:'Produção', page:'Producao' },
    { icon:'🔧', label:'Atividades', page:'Atividades' },
    { icon:'📆', label:'Programação', page:'Programacao' },
  ]},
  financeiro: { label:'Financeiro', items:[
    { icon:'🛒', label:'Vendas', page:'Vendas' },
    { icon:'💸', label:'Custos', page:'Custos' },
    { icon:'🏦', label:'Financeiro', page:'Financeiro' },
  ]},
  mais: { label:'Mais', items:[
    { icon:'👥', label:'Clientes', page:'Clientes' },
    { icon:'🏭', label:'Fornecedores', page:'Fornecedores' },
  ]}
}
const MOBILE_TABS = [
  { id:'hoje',       icon:'📅', label:'Hoje',       page:'Dashboard' },
  { id:'campo',      icon:'🌾', label:'Campo',      sheet:'campo',      pages:['Lotes','Culturas','Producao','Atividades','Programacao'] },
  { id:'financeiro', icon:'💰', label:'Financeiro', sheet:'financeiro', pages:['Vendas','Custos','Financeiro'] },
  { id:'estoque',    icon:'📦', label:'Estoque',    page:'Estoque' },
  { id:'mais',       icon:'⚙️', label:'Mais',       sheet:'mais',       pages:['Clientes','Fornecedores'] },
]
const DESKTOP_NAV = [
  { icon:'📅', label:'Dashboard',        page:'Dashboard' },
  { icon:'🗺️', label:'Lotes / Piquetes', page:'Lotes' },
  { icon:'🌱', label:'Culturas',          page:'Culturas' },
  { icon:'🌾', label:'Produção',           page:'Producao' },
  { icon:'🔧', label:'Atividades',         page:'Atividades' },
  { icon:'📆', label:'Programação',        page:'Programacao' },
  { icon:'📦', label:'Estoque',            page:'Estoque' },
  { icon:'🛒', label:'Vendas',             page:'Vendas' },
  { icon:'💸', label:'Custos',             page:'Custos' },
  { icon:'🏦', label:'Financeiro',         page:'Financeiro' },
  { icon:'👥', label:'Clientes',           page:'Clientes' },
  { icon:'🏭', label:'Fornecedores',       page:'Fornecedores' },
]

function isTabActive(tab, p) { return tab.page ? p===tab.page : tab.pages?.includes(p) }
function PageLoader() { return <div style={{textAlign:'center',padding:40,color:'#888'}}>Carregando...</div> }

function Pages({ currentPage, setPage, sair, addRef }) {
  function reg(fn) { addRef.current = fn }
  return (
    <Suspense fallback={<PageLoader/>}>
      {currentPage==='Dashboard'    && <Dashboard onNavigate={setPage} currentPage={currentPage} onSair={sair}/>}
      {currentPage==='Lotes'        && <Lotes       onAddBtn={reg}/>}
      {currentPage==='Culturas'     && <Culturas     onAddBtn={reg}/>}
      {currentPage==='Producao'     && <Producao     onAddBtn={reg}/>}
      {currentPage==='Vendas'       && <Vendas       onAddBtn={reg}/>}
      {currentPage==='Custos'       && <Custos       onAddBtn={reg}/>}
      {currentPage==='Financeiro'   && <Financeiro/>}
      {currentPage==='Estoque'      && <Estoque      onAddBtn={reg}/>}
      {currentPage==='Atividades'   && <Atividades   onAddBtn={reg}/>}
      {currentPage==='Programacao'  && <Programacao  onAddBtn={reg}/>}
      {currentPage==='Clientes'     && <Clientes     onAddBtn={reg}/>}
      {currentPage==='Fornecedores' && <Fornecedores onAddBtn={reg}/>}
    </Suspense>
  )
}

// ═══════════════════════════════════════════════════════════
// LAYOUT MOBILE
// ═══════════════════════════════════════════════════════════
function MobileLayout({ currentPage, setPage, sair, offline }) {
  const [openSheet, setOpenSheet] = useState(null)
  const addRef = useRef(null)

  function pressTab(tab) {
    if (tab.sheet) { setOpenSheet(openSheet===tab.sheet?null:tab.sheet) }
    else { setPage(tab.page); setOpenSheet(null); addRef.current=null }
  }
  function selectSheet(page) { setPage(page); setOpenSheet(null); addRef.current=null }
  const sheet = openSheet ? SHEETS[openSheet] : null

  // Offset do conteúdo aumenta se OfflineBar estiver visível
  const hasBar = !offline.isOnline || offline.pendingCount > 0 || offline.syncStatus
  const topOffset = hasBar ? 82 : 60

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      {/* HEADER */}
      <div style={{position:'fixed',top:0,left:0,right:0,zIndex:200,background:'white',borderBottom:'0.5px solid rgba(0,0,0,0.1)',height:52,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px'}}>
        <span style={{fontSize:16,fontWeight:500,color:'#2d6a2d'}}>🍌 AgroGestão</span>
        <span style={{fontSize:14,color:'#555',position:'absolute',left:'50%',transform:'translateX(-50%)',whiteSpace:'nowrap'}}>
          {PAGE_LABELS[currentPage]??currentPage}
        </span>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {/* Indicador de pendentes no header */}
          {offline.pendingCount > 0 && (
            <span style={{fontSize:10,background:'#854F0B',color:'white',borderRadius:10,padding:'1px 6px',fontWeight:600}}>
              {offline.pendingCount}⏳
            </span>
          )}
          {ADD_LABELS[currentPage]&&(
            <button onClick={()=>addRef.current?.()} style={{fontSize:11,background:'var(--green)',color:'white',border:'none',borderRadius:8,padding:'5px 10px',cursor:'pointer',fontWeight:600}}>
              {ADD_LABELS[currentPage]}
            </button>
          )}
        </div>
      </div>

      {/* BARRA OFFLINE */}
      <OfflineBar {...offline} onSync={offline.triggerSync} />

      {/* CONTEÚDO */}
      <div style={{paddingTop:topOffset,paddingBottom:'calc(70px + env(safe-area-inset-bottom, 0px))'}}>
        <div style={{padding:'12px 16px'}}>
          <Pages currentPage={currentPage} setPage={setPage} sair={sair} addRef={addRef}/>
        </div>
      </div>

      {/* OVERLAY */}
      {openSheet&&<div onClick={()=>setOpenSheet(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:300}}/>}

      {/* SHEET */}
      {sheet&&(
        <div style={{position:'fixed',bottom:0,left:0,right:0,zIndex:400,background:'white',borderRadius:'20px 20px 0 0',padding:'20px 16px',paddingBottom:'calc(20px + env(safe-area-inset-bottom, 0px))'}}>
          <div style={{width:40,height:4,background:'rgba(0,0,0,0.15)',borderRadius:2,margin:'0 auto 16px'}}/>
          <div style={{fontSize:13,fontWeight:600,color:'#888',marginBottom:14,textAlign:'center',textTransform:'uppercase',letterSpacing:'.5px'}}>{sheet.label}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {sheet.items.map(item=>(
              <button key={item.page} onClick={()=>selectSheet(item.page)} style={{background:currentPage===item.page?'#EAF3DE':'white',border:currentPage===item.page?'1px solid #C0DD97':'0.5px solid rgba(0,0,0,0.1)',borderRadius:12,padding:16,display:'flex',flexDirection:'column',alignItems:'center',gap:8,cursor:'pointer'}}>
                <span style={{fontSize:32}}>{item.icon}</span>
                <span style={{fontSize:13,color:currentPage===item.page?'#2d6a2d':'#333',textAlign:'center',fontWeight:currentPage===item.page?600:400}}>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAB BAR */}
      <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'white',borderTop:'0.5px solid rgba(0,0,0,0.1)',display:'flex',justifyContent:'space-around',alignItems:'flex-start',padding:'8px 0',paddingBottom:'calc(8px + env(safe-area-inset-bottom, 0px))',zIndex:500}}>
        {MOBILE_TABS.map(tab=>{
          const active=isTabActive(tab,currentPage); const so=openSheet===tab.sheet
          return(
            <button key={tab.id} onClick={()=>pressTab(tab)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,minWidth:60,minHeight:44,justifyContent:'center',cursor:'pointer',WebkitTapHighlightColor:'transparent',border:'none',padding:'4px 8px',borderRadius:12,background:(active||so)?'#EAF3DE':'none'}}>
              <span style={{fontSize:24,lineHeight:1}}>{tab.icon}</span>
              <span style={{fontSize:11,fontWeight:(active||so)?600:400,color:(active||so)?'#2d6a2d':'#888'}}>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// LAYOUT DESKTOP
// ═══════════════════════════════════════════════════════════
function DesktopLayout({ currentPage, setPage, sair }) {
  const addRef = useRef(null)

  if (currentPage === 'Dashboard') {
    return (
      <Suspense fallback={<PageLoader/>}>
        <Dashboard onNavigate={setPage} currentPage={currentPage} onSair={sair}/>
      </Suspense>
    )
  }

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#FAFAFA'}}>
      <div style={{width:200,flexShrink:0,background:'white',borderRight:'0.5px solid rgba(0,0,0,0.1)',display:'flex',flexDirection:'column',height:'100vh',overflowY:'auto'}}>
        <div style={{padding:'18px 16px 12px',borderBottom:'0.5px solid rgba(0,0,0,0.08)'}}>
          <div style={{fontSize:16,fontWeight:600,color:'#2d6a2d',cursor:'pointer'}} onClick={()=>setPage('Dashboard')}>🍌 AgroGestão</div>
          <div style={{fontSize:11,color:'#aaa',marginTop:2}}>Jaíba · MG</div>
        </div>
        <nav style={{flex:1,padding:'8px 0'}}>
          {DESKTOP_NAV.map(item=>(
            <button key={item.page} onClick={()=>setPage(item.page)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'8px 16px',border:'none',cursor:'pointer',textAlign:'left',background:currentPage===item.page?'#EAF3DE':'none',color:currentPage===item.page?'#2d6a2d':'#666',fontWeight:currentPage===item.page?500:400,fontSize:13}}>
              <span style={{fontSize:14}}>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div style={{borderTop:'0.5px solid rgba(0,0,0,0.08)',padding:'10px 0'}}>
          <button onClick={sair} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'8px 16px',border:'none',cursor:'pointer',background:'none',color:'#888',fontSize:13}}>
            <span>🚪</span><span>Sair</span>
          </button>
        </div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{height:48,background:'white',borderBottom:'0.5px solid rgba(0,0,0,0.1)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:600,color:'#333'}}>{PAGE_LABELS[currentPage]}</span>
          {ADD_LABELS[currentPage]&&<button className="btn btn-primary" onClick={()=>addRef.current?.()}>{ADD_LABELS[currentPage]}</button>}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
          <Pages currentPage={currentPage} setPage={setPage} sair={sair} addRef={addRef}/>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [logado, setLogado]           = useState(localStorage.getItem('frutminas_auth')==='true')
  const [currentPage, setCurrentPage] = useState('Dashboard')
  const isMobile = useIsMobile(768)
  const offline  = useOfflineSync()

  if (!logado) return <Login onLogin={()=>setLogado(true)}/>
  function sair() { localStorage.removeItem('frutminas_auth'); setLogado(false) }

  return (
    <OfflineContext.Provider value={offline}>
      {isMobile
        ? <MobileLayout currentPage={currentPage} setPage={setCurrentPage} sair={sair} offline={offline}/>
        : <DesktopLayout currentPage={currentPage} setPage={setCurrentPage} sair={sair}/>}
    </OfflineContext.Provider>
  )
}

import React, { useState, useRef, lazy, Suspense } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import TenantSelector from './pages/TenantSelector'
import {
  LayoutDashboard, Map, Leaf, Wheat, Wrench, CalendarDays,
  Package, ShoppingCart, TrendingDown, Landmark, Users, Factory,
  BarChart2, LogOut, ChevronRight, Menu, X
} from 'lucide-react'

function useIsMobile(bp) {
  const [m, setM] = React.useState(() => window.innerWidth < (bp || 768))
  React.useEffect(() => {
    const h = () => setM(window.innerWidth < (bp || 768))
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [bp])
  return m
}

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
const Relatorios   = lazy(() => import('./pages/Relatorios'))
const Culturas     = lazy(() => import('./pages/Culturas'))

const PAGE_LABELS = {
  Dashboard:'Dashboard', Lotes:'Lotes / Piquetes', Culturas:'Culturas',
  Producao:'Produção', Atividades:'Atividades', Programacao:'Programação',
  Estoque:'Estoque', Vendas:'Vendas', Custos:'Custos', Financeiro:'Financeiro',
  Clientes:'Clientes', Fornecedores:'Fornecedores', Relatorios:'Relatórios',
}

const ADD_LABELS = {
  Lotes:'+ Novo lote', Culturas:'+ Nova cultura', Producao:'+ Nova carga',
  Vendas:'+ Nova venda', Custos:'+ Novo custo', Estoque:'+ Novo insumo',
  Atividades:'+ Nova atividade', Programacao:'+ Nova programação',
  Clientes:'+ Novo cliente', Fornecedores:'+ Novo fornecedor',
}

const DESKTOP_NAV = [
  {
    section: null,
    items: [
      { Icon: LayoutDashboard, label:'Dashboard', page:'Dashboard' },
    ]
  },
  {
    section: 'Campo',
    items: [
      { Icon: Map,         label:'Lotes / Piquetes', page:'Lotes' },
      { Icon: Leaf,        label:'Culturas',          page:'Culturas' },
      { Icon: Wheat,       label:'Produção',           page:'Producao' },
      { Icon: Wrench,      label:'Atividades',         page:'Atividades' },
      { Icon: CalendarDays,label:'Programação',        page:'Programacao' },
    ]
  },
  {
    section: 'Financeiro',
    items: [
      { Icon: ShoppingCart,  label:'Vendas',      page:'Vendas' },
      { Icon: TrendingDown,  label:'Custos',      page:'Custos' },
      { Icon: Landmark,      label:'Financeiro',  page:'Financeiro' },
    ]
  },
  {
    section: 'Geral',
    items: [
      { Icon: Package,  label:'Estoque',      page:'Estoque' },
      { Icon: Users,    label:'Clientes',     page:'Clientes' },
      { Icon: Factory,  label:'Fornecedores', page:'Fornecedores' },
      { Icon: BarChart2,label:'Relatórios',   page:'Relatorios' },
    ]
  },
]

// flat list for mobile tabs
const MOBILE_TABS = [
  { id:'hoje',       Icon: LayoutDashboard, label:'Hoje',       page:'Dashboard' },
  { id:'campo',      Icon: Wheat,           label:'Campo',      sheet:'campo',      pages:['Lotes','Culturas','Producao','Atividades','Programacao'] },
  { id:'financeiro', Icon: Landmark,        label:'Financeiro', sheet:'financeiro', pages:['Vendas','Custos','Financeiro'] },
  { id:'estoque',    Icon: Package,         label:'Estoque',    page:'Estoque' },
  { id:'mais',       Icon: Menu,            label:'Mais',       sheet:'mais',       pages:['Clientes','Fornecedores','Estoque','Relatorios'] },
]

const SHEETS = {
  campo: { label:'Campo', items:[
    { Icon: Map,          label:'Lotes / Piquetes', page:'Lotes' },
    { Icon: Leaf,         label:'Culturas',          page:'Culturas' },
    { Icon: Wheat,        label:'Produção',           page:'Producao' },
    { Icon: Wrench,       label:'Atividades',         page:'Atividades' },
    { Icon: CalendarDays, label:'Programação',        page:'Programacao' },
  ]},
  financeiro: { label:'Financeiro', items:[
    { Icon: ShoppingCart, label:'Vendas',     page:'Vendas' },
    { Icon: TrendingDown, label:'Custos',     page:'Custos' },
    { Icon: Landmark,     label:'Financeiro', page:'Financeiro' },
  ]},
  mais: { label:'Mais', items:[
    { Icon: Users,     label:'Clientes',     page:'Clientes' },
    { Icon: Factory,   label:'Fornecedores', page:'Fornecedores' },
    { Icon: BarChart2, label:'Relatórios',   page:'Relatorios' },
    { Icon: Package,   label:'Estoque',      page:'Estoque' },
  ]}
}

function isTabActive(tab, p) { return tab.page ? p===tab.page : tab.pages?.includes(p) }
function PageLoader() { return <div style={{textAlign:'center',padding:40,color:'#888'}}>Carregando...</div> }

function PageContent({ currentPage, setPage, sair, addRef }) {
  function reg(fn) { addRef.current = fn }
  return (
    <Suspense fallback={<PageLoader/>}>
      {currentPage==='Dashboard'    && <Dashboard/>}
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
      {currentPage==='Relatorios'   && <Relatorios/>}
    </Suspense>
  )
}

/* ─── LOGO ─────────────────────────────────────────────────── */
function Logo({ size = 'md' }) {
  const isLg = size === 'lg'
  return (
    <div style={{ display:'flex', alignItems:'center', gap: isLg ? 10 : 8 }}>
      <div style={{
        width: isLg ? 36 : 28, height: isLg ? 36 : 28,
        background: 'linear-gradient(135deg, var(--green-mid) 0%, var(--green-dark) 100%)',
        borderRadius: isLg ? 10 : 8,
        display:'flex', alignItems:'center', justifyContent:'center',
        flexShrink: 0,
        boxShadow: '0 2px 6px rgba(59,109,17,.35)',
      }}>
        <Leaf size={isLg ? 20 : 15} color="white" strokeWidth={2.2}/>
      </div>
      <span style={{
        fontFamily:'var(--font-display)', fontWeight:600,
        fontSize: isLg ? 22 : 16,
        color:'var(--green-dark)', letterSpacing:'-.3px',
      }}>
        AgroGestão
      </span>
    </div>
  )
}

/* ─── BANNER INSTALAR iOS ───────────────────────────────────── */
function IosBanner() {
  const [visible, setVisible] = React.useState(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isInApp = window.navigator.standalone === true
    const dismissed = localStorage.getItem('ag_ios_banner') === '1'
    return isIos && !isInApp && !dismissed
  })

  if (!visible) return null

  function dismiss() {
    localStorage.setItem('ag_ios_banner', '1')
    setVisible(false)
  }

  return (
    <div style={{
      position:'fixed', bottom:'calc(68px + env(safe-area-inset-bottom, 0px))',
      left:12, right:12, zIndex:600,
      background:'var(--green-dark)', color:'white',
      borderRadius:14, padding:'14px 16px',
      boxShadow:'0 4px 20px rgba(0,0,0,0.25)',
      display:'flex', alignItems:'flex-start', gap:12,
    }}>
      <div style={{fontSize:26,flexShrink:0}}>📲</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>Instalar AgroGestão</div>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.8)',lineHeight:1.5}}>
          Toque em <strong style={{color:'white'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{verticalAlign:'middle',marginBottom:1}}>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </strong> no Safari e depois em <strong style={{color:'white'}}>"Adicionar à Tela de Início"</strong>
        </div>
      </div>
      <button onClick={dismiss} style={{
        background:'rgba(255,255,255,0.15)', border:'none', color:'white',
        borderRadius:8, width:28, height:28, fontSize:16,
        cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
      }}>✕</button>
    </div>
  )
}

/* ─── MOBILE LAYOUT ─────────────────────────────────────────── */
function MobileLayout({ currentPage, setPage, sair }) {
  const [openSheet, setOpenSheet] = useState(null)
  const addRef = useRef(null)

  function pressTab(tab) {
    if (tab.sheet) { setOpenSheet(openSheet===tab.sheet?null:tab.sheet) }
    else { setPage(tab.page); setOpenSheet(null); addRef.current=null }
  }
  function selectSheet(page) { setPage(page); setOpenSheet(null); addRef.current=null }
  const sheet = openSheet ? SHEETS[openSheet] : null

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)'}}>
      {/* topbar */}
      <div style={{
        position:'fixed',top:0,left:0,right:0,zIndex:200,
        background:'white',borderBottom:'1px solid var(--border)',
        height:54,display:'flex',alignItems:'center',
        justifyContent:'space-between',padding:'0 14px',
        gap:8,
      }}>
        {/* Logo só no Dashboard, senão mostra o título */}
        {currentPage === 'Dashboard'
          ? <Logo/>
          : <span style={{fontSize:15,fontWeight:700,color:'var(--text)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
              {PAGE_LABELS[currentPage]??currentPage}
            </span>
        }
        {/* Botão de adicionar — ícone "+" no mobile */}
        {ADD_LABELS[currentPage] && (
          <button
            onClick={()=>addRef.current?.()}
            className="btn btn-primary btn-sm"
            style={{flexShrink:0,display:'flex',alignItems:'center',gap:4}}
          >
            <span style={{fontSize:16,lineHeight:1}}>+</span>
            <span style={{fontSize:12}}>Novo</span>
          </button>
        )}
      </div>

      <div style={{
        paddingTop:54,
        paddingBottom:'calc(68px + env(safe-area-inset-bottom, 0px))',
        paddingLeft:'env(safe-area-inset-left, 0px)',
        paddingRight:'env(safe-area-inset-right, 0px)',
      }}>
        <div style={{padding:'14px 12px'}}>
          <PageContent currentPage={currentPage} setPage={setPage} sair={sair} addRef={addRef}/>
        </div>
      </div>

      <IosBanner/>

      {openSheet&&<div onClick={()=>setOpenSheet(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:300}}/>}

      {sheet&&(
        <div style={{
          position:'fixed',bottom:0,left:0,right:0,zIndex:400,
          background:'white',borderRadius:'20px 20px 0 0',
          padding:'20px 16px',
          paddingBottom:'calc(20px + env(safe-area-inset-bottom, 0px))',
        }}>
          <div style={{width:36,height:4,background:'var(--gray-100)',borderRadius:2,margin:'0 auto 16px'}}/>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text-muted)',marginBottom:14,textAlign:'center',textTransform:'uppercase',letterSpacing:'1px'}}>{sheet.label}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {sheet.items.map(item=>{
              const active = currentPage===item.page
              return (
                <button key={item.page} onClick={()=>selectSheet(item.page)} style={{
                  background: active ? 'var(--green-light)' : 'white',
                  border: active ? '1.5px solid var(--green-mid)' : '1px solid var(--border)',
                  borderRadius:12,padding:16,
                  display:'flex',flexDirection:'column',alignItems:'center',gap:8,
                  cursor:'pointer',
                }}>
                  <item.Icon size={24} color={active ? 'var(--green)' : 'var(--text-muted)'} strokeWidth={1.8}/>
                  <span style={{fontSize:13,color:active?'var(--green-dark)':'var(--text)',textAlign:'center',fontWeight:active?600:400}}>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <nav style={{
        position:'fixed',bottom:0,left:0,right:0,
        background:'white',borderTop:'1px solid var(--border)',
        display:'flex',justifyContent:'space-around',alignItems:'center',
        paddingTop:6,
        paddingBottom:'calc(6px + env(safe-area-inset-bottom, 0px))',
        zIndex:500,
        boxShadow:'0 -2px 12px rgba(0,0,0,0.07)',
      }}>
        {MOBILE_TABS.map(tab=>{
          const active = isTabActive(tab,currentPage)
          const so = openSheet===tab.sheet
          const highlighted = active || so
          return(
            <button key={tab.id} onClick={()=>pressTab(tab)} style={{
              display:'flex',flexDirection:'column',alignItems:'center',gap:2,
              flex:1,minHeight:50,justifyContent:'center',
              cursor:'pointer',WebkitTapHighlightColor:'transparent',
              border:'none',background:'none',padding:'4px 0',
            }}>
              <div style={{
                width:40,height:28,borderRadius:14,
                display:'flex',alignItems:'center',justifyContent:'center',
                background: highlighted ? 'var(--green-light)' : 'transparent',
                transition:'background .15s',
              }}>
                <tab.Icon size={20} color={highlighted?'var(--green)':'var(--text-muted)'} strokeWidth={highlighted?2.2:1.8}/>
              </div>
              <span style={{fontSize:10,fontWeight:highlighted?600:400,color:highlighted?'var(--green)':'var(--text-muted)'}}>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/* ─── DESKTOP LAYOUT ────────────────────────────────────────── */
function DesktopLayout({ currentPage, setPage, sair }) {
  const addRef = useRef(null)
  const { tenants, tenantId } = useAuth()
  const tenantName = tenants.find(t => t.tenant_id === tenantId)?.tenants?.nome ?? ''

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'var(--bg)'}}>
      {/* Sidebar */}
      <div style={{
        width:220,flexShrink:0,
        background:'white',
        borderRight:'1px solid var(--border)',
        display:'flex',flexDirection:'column',
        height:'100vh',overflowY:'auto',
      }}>
        {/* Logo */}
        <div style={{padding:'20px 18px 16px',borderBottom:'1px solid var(--border)'}}>
          <Logo/>
          {tenantName && (
            <div style={{fontSize:11,color:'var(--text-muted)',marginTop:6,paddingLeft:2,
              display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'var(--green-mid)',flexShrink:0}}/>
              {tenantName}
            </div>
          )}
        </div>

        {/* Nav sections */}
        <nav style={{flex:1,padding:'10px 10px',overflowY:'auto'}}>
          {DESKTOP_NAV.map((group, gi) => (
            <div key={gi} style={{marginBottom: group.section ? 4 : 0}}>
              {group.section && (
                <div style={{
                  fontSize:10,fontWeight:700,color:'var(--text-muted)',
                  textTransform:'uppercase',letterSpacing:'1px',
                  padding:'10px 12px 4px',
                }}>
                  {group.section}
                </div>
              )}
              {group.items.map(item => {
                const active = currentPage === item.page
                return (
                  <button key={item.page} onClick={()=>setPage(item.page)} style={{
                    width:'100%',display:'flex',alignItems:'center',gap:9,
                    padding:'8px 12px',marginBottom:1,
                    border:'none',cursor:'pointer',textAlign:'left',
                    borderRadius:8,
                    background: active ? 'var(--green-light)' : 'none',
                    color: active ? 'var(--green-dark)' : 'var(--text-muted)',
                    fontWeight: active ? 600 : 400,
                    fontSize:13.5,
                    fontFamily:'var(--font)',
                    borderLeft: active ? '3px solid var(--green)' : '3px solid transparent',
                    transition:'all 0.1s',
                  }}
                  onMouseEnter={e=>{if(!active){e.currentTarget.style.background='var(--green-light)';e.currentTarget.style.color='var(--green-dark)'}}}
                  onMouseLeave={e=>{if(!active){e.currentTarget.style.background='none';e.currentTarget.style.color='var(--text-muted)'}}}>
                    <item.Icon size={15} strokeWidth={active?2.2:1.8}/>
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{borderTop:'1px solid var(--border)',padding:'10px 10px'}}>
          <button onClick={sair} style={{
            width:'100%',display:'flex',alignItems:'center',gap:9,
            padding:'8px 12px',border:'none',cursor:'pointer',
            background:'none',color:'var(--text-muted)',fontSize:13.5,
            fontFamily:'var(--font)',borderRadius:8,
            transition:'all 0.1s',
          }}
          onMouseEnter={e=>{e.currentTarget.style.background='var(--red-light)';e.currentTarget.style.color='var(--red)'}}
          onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='var(--text-muted)'}}>
            <LogOut size={15} strokeWidth={1.8}/>
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Topbar */}
        <div style={{
          height:52,background:'white',
          borderBottom:'1px solid var(--border)',
          display:'flex',alignItems:'center',
          justifyContent:'space-between',
          padding:'0 24px',flexShrink:0,
        }}>
          <span style={{fontSize:15,fontWeight:600,color:'var(--text)',letterSpacing:'-.2px'}}>
            {PAGE_LABELS[currentPage]??'Dashboard'}
          </span>
          {ADD_LABELS[currentPage]&&(
            <button className="btn btn-primary" onClick={()=>addRef.current?.()}>
              {ADD_LABELS[currentPage]}
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
          <PageContent currentPage={currentPage} setPage={setPage} sair={sair} addRef={addRef}/>
        </div>
      </div>
    </div>
  )
}

/* ─── APP ROOT ──────────────────────────────────────────────── */
function AppInner() {
  const { user, tenantId, loading, signOut } = useAuth()
  const [currentPage, setCurrentPage] = useState('Dashboard')
  const isMobile = useIsMobile(768)

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
        <Logo size="lg"/>
        <div style={{ color:'var(--text-muted)', fontSize:13 }}>Carregando...</div>
      </div>
    </div>
  )

  if (!user) return <Login />
  if (!tenantId) return <TenantSelector />

  return isMobile
    ? <MobileLayout  currentPage={currentPage} setPage={setCurrentPage} sair={signOut}/>
    : <DesktopLayout currentPage={currentPage} setPage={setCurrentPage} sair={signOut}/>
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

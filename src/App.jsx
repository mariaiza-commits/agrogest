import React, { useState, useRef } from 'react'
import Login        from './pages/Login'
import Dashboard    from './pages/Dashboard'
import Lotes        from './pages/Lotes'
import Producao     from './pages/Producao'
import Vendas       from './pages/Vendas'
import Custos       from './pages/Custos'
import Financeiro   from './pages/Financeiro'
import Estoque      from './pages/Estoque'
import Atividades   from './pages/Atividades'
import Programacao  from './pages/Programacao'

// ─── ESTRUTURA DE MÓDULOS ────────────────────────────────────
const MODULOS = [
  {
    id: 'campo',
    label: 'Gestão do Campo',
    icon: '🌿',
    pages: [
      { key: 'lotes',       label: 'Lotes / Piquetes', icon: '◫', add: '+ Novo lote' },
      { key: 'producao',    label: 'Produção',          icon: '📦', add: '+ Nova carga' },
      { key: 'atividades',  label: 'Atividades',        icon: '🛠️', add: '+ Nova atividade' },
      { key: 'programacao', label: 'Programação',       icon: '📅', add: '+ Nova programação' },
      { key: 'estoque',     label: 'Estoque',           icon: '🏪', add: '+ Novo insumo' },
    ]
  },
  {
    id: 'financeiro',
    label: 'Gestão do Dinheiro',
    icon: '💰',
    pages: [
      { key: 'vendas',      label: 'Vendas',       icon: '↗', add: '+ Nova venda' },
      { key: 'custos',      label: 'Custos',       icon: '↙', add: '+ Novo custo' },
      { key: 'financeiro',  label: 'Financeiro',   icon: '🏦', add: null },
    ]
  }
]

const ALL_PAGES = MODULOS.flatMap(m => m.pages)
const PAGE_MAP  = Object.fromEntries(ALL_PAGES.map(p => [p.key, p]))

export default function App() {
  const [page, setPage]   = useState('dashboard')
  const [logado, setLogado] = useState(localStorage.getItem('frutminas_auth') === 'true')
  const [collapsed, setCollapsed] = useState({}) // módulos colapsados
  const addRef = useRef(null)

  if (!logado) return <Login onLogin={() => setLogado(true)} />

  function sair() { localStorage.removeItem('frutminas_auth'); setLogado(false) }
  function navigate(p) { addRef.current = null; setPage(p) }
  function registerAddBtn(fn) { addRef.current = fn }
  function toggleModulo(id) { setCollapsed(c => ({ ...c, [id]: !c[id] })) }

  const currentPage = PAGE_MAP[page]

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-logo">
          <h1>AgroGestão</h1>
          <p>Jaíba · MG</p>
        </div>

        <nav className="sidebar-nav">
          {/* Dashboard */}
          <button
            className={`nav-item ${page === 'dashboard' ? 'active' : ''}`}
            onClick={() => navigate('dashboard')}
          >
            <span className="nav-icon">▦</span>
            <span>Dashboard</span>
          </button>

          {/* Módulos agrupados */}
          {MODULOS.map(modulo => (
            <div key={modulo.id} style={{ marginTop: 8 }}>
              {/* Cabeçalho do módulo */}
              <button
                onClick={() => toggleModulo(modulo.id)}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 16px', cursor: 'pointer',
                  color: 'var(--text-muted)', fontSize: 11,
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px',
                }}
              >
                <span>{modulo.icon}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{modulo.label}</span>
                <span style={{ fontSize: 10 }}>{collapsed[modulo.id] ? '▶' : '▼'}</span>
              </button>

              {/* Itens do módulo */}
              {!collapsed[modulo.id] && modulo.pages.map(p => (
                <button
                  key={p.key}
                  className={`nav-item ${page === p.key ? 'active' : ''}`}
                  onClick={() => navigate(p.key)}
                  style={{ paddingLeft: 28 }}
                >
                  <span className="nav-icon" style={{ fontSize: 13 }}>{p.icon}</span>
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          AgroGestão v2.0
          <button
            onClick={sair}
            style={{ display:'block', marginTop:8, background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:12, padding:0 }}
          >
            🚪 Sair
          </button>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <h2>
            {page === 'dashboard' ? 'Dashboard' : currentPage?.label}
          </h2>
          <div className="topbar-actions">
            {currentPage?.add && (
              <button className="btn btn-primary" onClick={() => addRef.current?.()}>
                {currentPage.add}
              </button>
            )}
          </div>
        </div>

        <div className="content">
          {page === 'dashboard'   && <Dashboard />}
          {page === 'lotes'       && <Lotes       onAddBtn={registerAddBtn} />}
          {page === 'producao'    && <Producao     onAddBtn={registerAddBtn} />}
          {page === 'vendas'      && <Vendas       onAddBtn={registerAddBtn} />}
          {page === 'custos'      && <Custos       onAddBtn={registerAddBtn} />}
          {page === 'financeiro'  && <Financeiro />}
          {page === 'estoque'     && <Estoque      onAddBtn={registerAddBtn} />}
          {page === 'atividades'  && <Atividades   onAddBtn={registerAddBtn} />}
          {page === 'programacao' && <Programacao  onAddBtn={registerAddBtn} />}
        </div>
      </div>
    </div>
  )
}

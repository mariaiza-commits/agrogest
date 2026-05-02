import React, { useState, useRef } from 'react'
import Login         from './pages/Login'
import Dashboard     from './pages/Dashboard'
import Lotes         from './pages/Lotes'
import Producao      from './pages/Producao'
import Vendas        from './pages/Vendas'
import Custos        from './pages/Custos'
import Financeiro    from './pages/Financeiro'
import Estoque       from './pages/Estoque'
import Atividades    from './pages/Atividades'
import Programacao   from './pages/Programacao'

const PAGES = {
  dashboard:   { label: 'Dashboard',    icon: '▦' },
  lotes:       { label: 'Lotes',        icon: '◫' },
  producao:    { label: 'Produção',     icon: '◉' },
  vendas:      { label: 'Vendas',       icon: '↗' },
  custos:      { label: 'Custos',       icon: '↙' },
  financeiro:  { label: 'Financeiro',   icon: '⊟' },
  estoque:     { label: 'Estoque',      icon: '📦' },
  atividades:  { label: 'Atividades',   icon: '🌿' },
  programacao: { label: 'Programação',  icon: '📅' },
}

const ADD_LABELS = {
  lotes:       '+ Novo lote',
  producao:    '+ Nova colheita',
  vendas:      '+ Nova venda',
  custos:      '+ Novo custo',
  estoque:     '+ Novo insumo',
  atividades:  '+ Nova atividade',
  programacao: '+ Nova programação',
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [logado, setLogado] = useState(localStorage.getItem('frutminas_auth') === 'true')
  const addRef = useRef(null)

  if (!logado) return <Login onLogin={() => setLogado(true)} />

  function sair() { localStorage.removeItem('frutminas_auth'); setLogado(false) }
  function navigate(p) { addRef.current = null; setPage(p) }
  function registerAddBtn(fn) { addRef.current = fn }

  return (
    <div className="app">
      <div className="sidebar">
        <div className="sidebar-logo">
          <h1>FrutMinas</h1>
          <p>Jaíba · MG</p>
        </div>
        <nav className="sidebar-nav">
          {Object.entries(PAGES).map(([key, { label, icon }]) => (
            <button key={key} className={`nav-item ${page === key ? 'active' : ''}`} onClick={() => navigate(key)}>
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          FrutMinas v2.0
          <button onClick={sair} style={{display:'block',marginTop:8,background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:12,padding:0}}>
            🚪 Sair
          </button>
        </div>
      </div>

      <div className="main">
        <div className="topbar">
          <h2>{PAGES[page]?.label}</h2>
          <div className="topbar-actions">
            {ADD_LABELS[page] && (
              <button className="btn btn-primary" onClick={() => addRef.current?.()}>
                {ADD_LABELS[page]}
              </button>
            )}
          </div>
        </div>
        <div className="content">
          {page === 'dashboard'   && <Dashboard />}
          {page === 'lotes'       && <Lotes      onAddBtn={registerAddBtn} />}
          {page === 'producao'    && <Producao   onAddBtn={registerAddBtn} />}
          {page === 'vendas'      && <Vendas     onAddBtn={registerAddBtn} />}
          {page === 'custos'      && <Custos     onAddBtn={registerAddBtn} />}
          {page === 'financeiro'  && <Financeiro />}
          {page === 'estoque'     && <Estoque    onAddBtn={registerAddBtn} />}
          {page === 'atividades'  && <Atividades onAddBtn={registerAddBtn} />}
          {page === 'programacao' && <Programacao onAddBtn={registerAddBtn} />}
        </div>
      </div>
    </div>
  )
}

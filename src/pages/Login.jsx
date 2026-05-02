import React, { useState } from 'react'

// Senha definida aqui — troque para a senha que quiser
const SENHA_CORRETA = 'frutminas2026'

export default function Login({ onLogin }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      if (senha === SENHA_CORRETA) {
        localStorage.setItem('frutminas_auth', 'true')
        onLogin()
      } else {
        setErro(true)
        setSenha('')
      }
      setLoading(false)
    }, 500)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '40px 36px',
        width: '100%',
        maxWidth: 380,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🌿</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>
            FrutMinas
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Jaíba · MG — Gestão Agrícola
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ fontWeight: 600 }}>Senha de acesso</label>
            <input
              type="password"
              value={senha}
              onChange={e => { setSenha(e.target.value); setErro(false) }}
              placeholder="Digite a senha"
              autoFocus
              style={{
                border: erro ? '1.5px solid var(--red)' : undefined,
                fontSize: 16,
              }}
            />
            {erro && (
              <span style={{ fontSize: 12, color: 'var(--red)', marginTop: 4, display: 'block' }}>
                Senha incorreta. Tente novamente.
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', fontSize: 16, padding: '12px' }}
            disabled={loading || !senha}
          >
            {loading ? 'Verificando...' : '→ Entrar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-muted)' }}>
          FrutMinas v2.0
        </div>
      </div>
    </div>
  )
}

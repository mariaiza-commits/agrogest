import React from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function TenantSelector() {
  const { tenants, selectTenant, signOut } = useAuth()

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)', padding: 24,
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '40px 36px',
        width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>
            Selecione sua fazenda
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            Você tem acesso a {tenants.length} fazenda{tenants.length !== 1 ? 's' : ''}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tenants.map(t => (
            <button
              key={t.tenant_id}
              onClick={() => selectTenant(t.tenant_id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 20px', border: '1px solid var(--border)',
                borderRadius: 12, background: 'white', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--green)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,109,17,0.15)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.boxShadow = 'none'
              }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: '#EAF3DE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>
                🌾
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#333' }}>{t.tenants?.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {t.role === 'owner' ? 'Proprietário' : t.role === 'admin' ? 'Administrador' : 'Visualizador'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'var(--green)', fontSize: 18 }}>→</div>
            </button>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <button onClick={signOut} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
          }}>
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}

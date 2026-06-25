import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://juqvvdnybhwelctlhdlr.supabase.co'
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cXZ2ZG55Ymh3ZWxjdGxoZGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzYxMTcsImV4cCI6MjA5MjkxMjExN30.3sddN3zuQvwnUHzO4yUpQVnIA07qY6H23PfeHTau0fg'

// Todas as chamadas ao Supabase via fetch puro — zero SDK, zero travamento
async function signInDirectFetch(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error_description || json.msg || 'Erro ao fazer login')
  return json
}

async function fetchTenantsRaw(userId, accessToken) {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/user_tenants?select=tenant_id,role,tenants(id,nome,slug)&user_id=eq.${userId}`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${accessToken}` } }
    )
    if (!res.ok) return []
    return await res.json() ?? []
  } catch { return [] }
}

const AuthContext = createContext(null)

// Verifica se o token salvo ainda é válido SEM fazer chamada de rede
function getStoredSession() {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
    if (!key) return null
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!parsed) return null

    // Suporta dois formatos de armazenamento do Supabase JS v2
    const session = parsed.currentSession ?? parsed
    const expiresAt = session?.expires_at ?? parsed?.expiresAt ?? 0

    if (Date.now() / 1000 > expiresAt) {
      // Token expirado — limpa tudo imediatamente
      localStorage.removeItem(key)
      localStorage.removeItem('ag_tenant_id')
      return null
    }
    return session
  } catch {
    return null
  }
}

async function fetchTenants(userId) {
  try {
    const { data } = await supabase
      .from('user_tenants')
      .select('tenant_id, role, tenants(id, nome, slug)')
      .eq('user_id', userId)
    return data ?? []
  } catch {
    return []
  }
}

function pickTenant(list, saved) {
  if (!list.length) return null
  const found = list.find(t => t.tenant_id === saved)
  return found ? found.tenant_id : list[0].tenant_id
}

export function AuthProvider({ children }) {
  // Verifica sessão localmente — síncrono, sem rede
  const storedSession = getStoredSession()
  const savedTenant   = storedSession ? localStorage.getItem('ag_tenant_id') : null

  const [user,     setUser]     = useState(null)
  const [tenants,  setTenants]  = useState([])
  const [tenantId, setTenantId] = useState(savedTenant)
  const [loading,  setLoading]  = useState(!!storedSession) // loading só se há sessão válida

  useEffect(() => {
    let cancelled = false

    if (storedSession?.user) {
      fetchTenantsRaw(storedSession.user.id, storedSession.access_token).then(list => {
        if (cancelled) return
        const tid = pickTenant(list, savedTenant)
        setUser(storedSession.user)
        setTenants(list)
        if (tid) { setTenantId(tid); localStorage.setItem('ag_tenant_id', tid) }
        setLoading(false)
      }).catch(() => {
        if (!cancelled) setLoading(false)
      })
    }
    // Se não há sessão, loading já é false — mostra login direto

    // Escuta mudanças de auth (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return
      if (event === 'SIGNED_IN' && session?.user) {
        const list = await fetchTenants(session.user.id)
        if (cancelled) return
        const tid = pickTenant(list, localStorage.getItem('ag_tenant_id'))
        setUser(session.user)
        setTenants(list)
        if (tid) { setTenantId(tid); localStorage.setItem('ag_tenant_id', tid) }
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null); setTenants([]); setTenantId(null)
        localStorage.removeItem('ag_tenant_id')
        setLoading(false)
      }
    })

    const t = setTimeout(() => { if (!cancelled) setLoading(false) }, 5000)

    return () => { cancelled = true; clearTimeout(t); subscription.unsubscribe() }
  }, [])

  async function signIn(email, password) {
    // Fetch direto ao endpoint de auth — sem SDK, sem mutex, sem travamento
    const session = await signInDirectFetch(email, password)
    const user = session.user
    if (!user) throw new Error('Usuário não encontrado')

    // Salva sessão no localStorage para o próximo carregamento
    const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
    localStorage.setItem(storageKey, JSON.stringify(session))

    // Redireciona imediatamente — sem esperar nada
    setUser(user)
    setLoading(false)

    // Tenants via fetch puro em background
    fetchTenantsRaw(user.id, session.access_token).then(list => {
      const tid = pickTenant(list, localStorage.getItem('ag_tenant_id'))
      setTenants(list)
      if (tid) { setTenantId(tid); localStorage.setItem('ag_tenant_id', tid) }
    }).catch(() => {})

    return session
  }

  async function signOut() {
    await supabase.auth.signOut()
    localStorage.removeItem('ag_tenant_id')
  }

  function selectTenant(id) {
    setTenantId(id)
    localStorage.setItem('ag_tenant_id', id)
  }

  return (
    <AuthContext.Provider value={{ user, tenants, tenantId, loading, signIn, signOut, selectTenant }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

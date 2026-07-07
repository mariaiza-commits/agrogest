import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const TENANTS_KEY = 'ag_tenants_cache'

// ─── helpers ────────────────────────────────────────────────────────────────

function pickTenant(list, saved) {
  if (!list.length) return null
  const found = list.find(t => t.tenant_id === saved)
  return found ? found.tenant_id : list[0].tenant_id
}

function jwtExpired(session) {
  if (!session?.expires_at) return true
  return Date.now() / 1000 > session.expires_at - 10
}

function readCache() {
  try {
    const raw = localStorage.getItem(TENANTS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCache(user, tenants, tenantId) {
  try {
    localStorage.setItem(TENANTS_KEY, JSON.stringify({ user, tenants, tenantId }))
  } catch {}
}

function clearCache() {
  localStorage.removeItem(TENANTS_KEY)
  localStorage.removeItem('ag_tenant_id')
}

async function fetchTenants(userId) {
  try {
    const { data } = await supabase
      .from('user_tenants')
      .select('tenant_id, role, tenants(id, nome, slug)')
      .eq('user_id', userId)
    return data ?? []
  } catch { return [] }
}

// ─── provider ───────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const cache = readCache()

  const [user,           setUser]          = useState(cache?.user     ?? null)
  const [tenants,        setTenants]       = useState(cache?.tenants  ?? [])
  const [tenantId,       setTenantId]      = useState(cache?.tenantId ?? null)
  const [loading,        setLoading]       = useState(!cache)
  const [sessionReady,   setSessionReady]  = useState(false)
  const [sessionVersion, setSessionVersion] = useState(0)
  const [authError,      setAuthError]     = useState(false)
  // true após fetchTenants completar no SIGNED_IN (ou quando há cache).
  const [tenantResolved, setTenantResolved] = useState(!!cache)

  const readyRef = useRef(false)

  function markReady(error = false) {
    readyRef.current = true
    if (error) setAuthError(true)
    setSessionReady(true)
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled) return

        if (event === 'INITIAL_SESSION') {
          if (!session?.user) {
            clearCache()
            setUser(null); setTenants([]); setTenantId(null)
            setTenantResolved(false)
            markReady()

          } else if (!jwtExpired(session)) {
            setUser(session.user)
            const currentCache = readCache()
            if (!currentCache || currentCache.user?.id !== session.user.id) {
              const list = await fetchTenants(session.user.id)
              if (cancelled) return
              const tid = pickTenant(list, localStorage.getItem('ag_tenant_id'))
              setTenants(list); setTenantId(tid ?? null)
              if (tid) localStorage.setItem('ag_tenant_id', tid)
              saveCache(session.user, list, tid)
            } else {
              fetchTenants(session.user.id).then(list => {
                if (cancelled || !list.length) return
                const tid = pickTenant(list, localStorage.getItem('ag_tenant_id'))
                setTenants(list)
                if (tid) { setTenantId(tid); localStorage.setItem('ag_tenant_id', tid) }
                saveCache(session.user, list, tid)
              })
            }
            setTenantResolved(true)
            markReady()
          }
          // Token expirado: aguarda TOKEN_REFRESHED ou SIGNED_OUT

        } else if (event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            setUser(session.user)
            const currentCache = readCache()
            if (!currentCache?.tenants?.length || currentCache.user?.id !== session.user.id) {
              const list = await fetchTenants(session.user.id)
              if (cancelled) return
              const tid = pickTenant(list, localStorage.getItem('ag_tenant_id'))
              setTenants(list); setTenantId(tid ?? null)
              if (tid) localStorage.setItem('ag_tenant_id', tid)
              saveCache(session.user, list, tid)
            }
          }
          setTenantResolved(true)
          markReady()
          setSessionVersion(v => v + 1)

        } else if (event === 'SIGNED_IN') {
          setUser(session.user)
          const list = await fetchTenants(session.user.id)
          if (cancelled) return
          const tid = pickTenant(list, localStorage.getItem('ag_tenant_id'))
          setTenants(list); setTenantId(tid ?? null)
          if (tid) localStorage.setItem('ag_tenant_id', tid)
          saveCache(session.user, list, tid)
          setTenantResolved(true)
          markReady()
          setSessionVersion(v => v + 1)

        } else if (event === 'SIGNED_OUT') {
          clearCache()
          setUser(null); setTenants([]); setTenantId(null)
          setTenantResolved(false)
          markReady()
        }
      }
    )

    const t = setTimeout(() => {
      if (!cancelled && !readyRef.current) markReady(true)
    }, 12000)

    return () => { cancelled = true; clearTimeout(t); subscription.unsubscribe() }
  }, [])

  // ─── ações públicas ───────────────────────────────────────────────────────

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message || 'Credenciais inválidas')
    return data.session
  }

  function signOut() {
    clearCache()
    setUser(null); setTenants([]); setTenantId(null)
    setTenantResolved(false)
    setSessionReady(true); setLoading(false)
    // Chama sem await — com no-op lock não trava.
    // Cancela timers internos do SDK e limpa o sessionStorage desta aba.
    supabase.auth.signOut().catch(() => {})
  }

  function selectTenant(id) {
    setTenantId(id)
    localStorage.setItem('ag_tenant_id', id)
    if (user && tenants.length) saveCache(user, tenants, id)
  }

  return (
    <AuthContext.Provider value={{
      user, tenants, tenantId, tenantResolved,
      loading, sessionReady, sessionVersion, authError,
      signIn, signOut, selectTenant,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

import React, { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [tenants, setTenants]   = useState([])
  const [tenantId, setTenantId] = useState(null)
  const [loading, setLoading]   = useState(true)
  const initialized = useRef(false)

  async function loadTenants(userId) {
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

  function applyTenant(tenantList) {
    if (!tenantList.length) return
    const saved = localStorage.getItem('ag_tenant_id')
    const found = tenantList.find(t => t.tenant_id === saved)
    if (found) {
      setTenantId(found.tenant_id)
    } else {
      setTenantId(tenantList[0].tenant_id)
      localStorage.setItem('ag_tenant_id', tenantList[0].tenant_id)
    }
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return

        if (session?.user) {
          const list = await loadTenants(session.user.id)
          if (cancelled) return
          setUser(session.user)
          setTenants(list)
          applyTenant(list)
        }
      } catch {
        // falha silenciosa — usuário não autenticado
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Timeout de segurança: nunca fica preso mais de 6 segundos
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 6000)

    init().then(() => clearTimeout(timeout))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return

      if (event === 'SIGNED_IN' && session?.user) {
        // Só recarrega tenants se ainda não inicializou com esse usuário
        if (!initialized.current || user?.id !== session.user.id) {
          initialized.current = true
          const list = await loadTenants(session.user.id)
          if (!cancelled) {
            setUser(session.user)
            setTenants(list)
            applyTenant(list)
            setLoading(false)
          }
        }
      } else if (event === 'SIGNED_OUT') {
        initialized.current = false
        setUser(null)
        setTenants([])
        setTenantId(null)
        localStorage.removeItem('ag_tenant_id')
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
      }
    })

    return () => {
      cancelled = true
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    localStorage.removeItem('ag_tenant_id')
  }

  function selectTenant(id) {
    setTenantId(id)
    localStorage.setItem('ag_tenant_id', id)
  }

  const value = { user, tenants, tenantId, loading, signIn, signOut, selectTenant }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

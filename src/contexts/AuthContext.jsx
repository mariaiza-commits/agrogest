import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [tenants, setTenants]       = useState([])
  const [tenantId, setTenantId]     = useState(null)
  const [loading, setLoading]       = useState(true)

  // Carrega fazendas do usuário após login
  async function loadTenants(userId) {
    const { data } = await supabase
      .from('user_tenants')
      .select('tenant_id, role, tenants(id, nome, slug)')
      .eq('user_id', userId)
    return data ?? []
  }

  // Restaura tenant salvo no localStorage (para não pedir seleção a cada refresh)
  function restoreTenant(tenantList) {
    const saved = localStorage.getItem('ag_tenant_id')
    const found = tenantList.find(t => t.tenant_id === saved)
    if (found) {
      setTenantId(found.tenant_id)
      return true
    }
    if (tenantList.length === 1) {
      setTenantId(tenantList[0].tenant_id)
      localStorage.setItem('ag_tenant_id', tenantList[0].tenant_id)
      return true
    }
    return false
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        const list = await loadTenants(session.user.id)
        setTenants(list)
        restoreTenant(list)
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        const list = await loadTenants(session.user.id)
        setTenants(list)
        restoreTenant(list)
      } else {
        setUser(null)
        setTenants([])
        setTenantId(null)
        localStorage.removeItem('ag_tenant_id')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUp(email, password, farmName) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { farm_name: farmName } },
    })
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

  const value = { user, tenants, tenantId, loading, signIn, signUp, signOut, selectTenant }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}

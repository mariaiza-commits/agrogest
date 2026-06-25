import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

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
  // Lê localStorage de forma síncrona — sem esperar nada
  const savedTenant = localStorage.getItem('ag_tenant_id')

  const [user,     setUser]     = useState(null)
  const [tenants,  setTenants]  = useState([])
  const [tenantId, setTenantId] = useState(savedTenant)

  // Se há tenant salvo, começa sem loading (app abre na hora)
  // Se não há, mostra loading só até o Supabase responder
  const [loading, setLoading] = useState(!savedTenant)

  useEffect(() => {
    let cancelled = false

    // Verifica sessão em background — não bloqueia a UI se savedTenant existe
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (cancelled) return

      if (session?.user) {
        const list = await fetchTenants(session.user.id)
        if (cancelled) return

        const tid = pickTenant(list, savedTenant)
        setUser(session.user)
        setTenants(list)
        if (tid) {
          setTenantId(tid)
          localStorage.setItem('ag_tenant_id', tid)
        }
      } else {
        // Sem sessão válida — limpa tudo, inclusive qualquer token expirado
        // Isso libera o mutex interno do Supabase para o próximo signIn não travar
        await supabase.auth.signOut().catch(() => {})
        setUser(null)
        setTenants([])
        setTenantId(null)
        localStorage.removeItem('ag_tenant_id')
      }
      setLoading(false)
    }).catch(async () => {
      if (!cancelled) {
        await supabase.auth.signOut().catch(() => {})
        setLoading(false)
      }
    })

    // Timeout de segurança absoluto: 5s e libera de qualquer jeito
    const t = setTimeout(() => { if (!cancelled) setLoading(false) }, 5000)

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
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user)
      }
    })

    return () => { cancelled = true; clearTimeout(t); subscription.unsubscribe() }
  }, [])

  async function signIn(email, password) {
    // Garante que não há operação de refresh pendente travando o signIn
    await supabase.auth.signOut().catch(() => {})
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Garante que tenants são carregados mesmo se onAuthStateChange não disparar
    if (data?.user) {
      const list = await fetchTenants(data.user.id)
      const tid = pickTenant(list, localStorage.getItem('ag_tenant_id'))
      setUser(data.user)
      setTenants(list)
      if (tid) { setTenantId(tid); localStorage.setItem('ag_tenant_id', tid) }
    }
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

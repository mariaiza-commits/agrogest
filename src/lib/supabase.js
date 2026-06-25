import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://juqvvdnybhwelctlhdlr.supabase.co'
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1cXZ2ZG55Ymh3ZWxjdGxoZGxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzYxMTcsImV4cCI6MjA5MjkxMjExN30.3sddN3zuQvwnUHzO4yUpQVnIA07qY6H23PfeHTau0fg'

// CRÍTICO: limpa token expirado ANTES de createClient
// Se não fizer isso, createClient já inicia tentando renovar o token
// e bloqueia todas as operações de auth subsequentes (incluindo signIn)
;(function clearExpiredSupabaseToken() {
  try {
    const key = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (!key) return
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (!stored) return
    const session = stored.currentSession ?? stored
    const expiresAt = session?.expires_at ?? stored?.expiresAt ?? 0
    if (Date.now() / 1000 > expiresAt) {
      localStorage.removeItem(key)
      localStorage.removeItem('ag_tenant_id')
    }
  } catch {}
})()

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
  }
})

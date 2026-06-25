import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DB_NAME = 'agrogestao_offline'
const DB_VERSION = 1
const STORE_NAME = 'pending_ops'

// ─── IndexedDB ───────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('table', 'table', { unique: false })
        store.createIndex('synced', 'synced', { unique: false })
      }
    }
  })
}

async function savePendingOp(op) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.add({ ...op, synced: false, created_at: new Date().toISOString() })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getPendingOps() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const idx = store.index('synced')
    const req = idx.getAll(false)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function markAsSynced(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const record = getReq.result
      if (record) {
        record.synced = true
        const putReq = store.put(record)
        putReq.onsuccess = () => resolve()
        putReq.onerror = () => reject(putReq.error)
      } else resolve()
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

async function countPending() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const idx = store.index('synced')
    const req = idx.count(false)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ─── SINCRONIZADOR ───────────────────────────────────────────
async function syncAll(onProgress) {
  const ops = await getPendingOps()
  if (!ops.length) return { synced: 0, errors: 0 }

  let synced = 0, errors = 0

  for (const op of ops) {
    try {
      if (op.action === 'insert') {
        const { error } = await supabase.from(op.table).insert(op.data)
        if (error) throw error
      } else if (op.action === 'update') {
        const { error } = await supabase.from(op.table).update(op.data).eq('id', op.data.id)
        if (error) throw error
      } else if (op.action === 'delete') {
        const { error } = await supabase.from(op.table).delete().eq('id', op.data.id)
        if (error) throw error
      }
      await markAsSynced(op.id)
      synced++
      onProgress?.({ synced, total: ops.length })
    } catch (err) {
      console.error('Erro ao sincronizar:', op, err)
      errors++
    }
  }

  return { synced, errors }
}

// ─── HOOK PRINCIPAL ──────────────────────────────────────────
export function useOfflineSync(tenantId) {
  const [isOnline, setIsOnline]       = useState(navigator.onLine)
  const [pendingCount, setPending]    = useState(0)
  const [syncing, setSyncing]         = useState(false)
  const [lastSync, setLastSync]       = useState(null)
  const [syncStatus, setSyncStatus]   = useState(null) // 'ok' | 'error' | null

  // Atualiza contador de pendentes
  const refreshCount = useCallback(async () => {
    try { const n = await countPending(); setPending(n) } catch {}
  }, [])

  useEffect(() => {
    refreshCount()

    const onOnline  = () => { setIsOnline(true);  triggerSync() }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    // Ouve mensagens do Service Worker
    const onMessage = e => { if (e.data?.type === 'SYNC_PENDING') triggerSync() }
    navigator.serviceWorker?.addEventListener('message', onMessage)

    return () => {
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [refreshCount])

  const triggerSync = useCallback(async () => {
    if (syncing || !navigator.onLine) return
    const count = await countPending()
    if (!count) return

    setSyncing(true)
    try {
      const result = await syncAll()
      if (result.synced > 0) {
        setLastSync(new Date())
        setSyncStatus('ok')
        await refreshCount()
        setTimeout(() => setSyncStatus(null), 3000)
      }
      if (result.errors > 0) setSyncStatus('error')
    } catch { setSyncStatus('error') }
    finally { setSyncing(false) }
  }, [syncing, refreshCount])

  // Função para salvar offline (uso nos formulários)
  const saveOffline = useCallback(async (table, action, data) => {
    await savePendingOp({ table, action, data })
    await refreshCount()
  }, [refreshCount])

  // Wrapper inteligente: tenta online, cai para offline
  const save = useCallback(async (table, action, data) => {
    // Injeta tenant_id em inserts/updates
    const payload = (action !== 'delete' && tenantId)
      ? { tenant_id: tenantId, ...data }
      : data

    if (!navigator.onLine) {
      await saveOffline(table, action, payload)
      return { offline: true, data: payload }
    }
    try {
      let result
      if (action === 'insert') result = await supabase.from(table).insert(payload).select().single()
      else if (action === 'update') result = await supabase.from(table).update(payload).eq('id', payload.id).select().single()
      else if (action === 'delete') result = await supabase.from(table).delete().eq('id', data.id)
      if (result?.error) throw result.error
      return { offline: false, data: result?.data }
    } catch {
      // Falhou online — salva offline
      await saveOffline(table, action, payload)
      return { offline: true, data: payload }
    }
  }, [saveOffline, tenantId])

  return { isOnline, pendingCount, syncing, lastSync, syncStatus, save, triggerSync }
}

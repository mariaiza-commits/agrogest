import React from 'react'

export default function OfflineBar({ isOnline, pendingCount, syncing, syncStatus, onSync }) {
  if (isOnline && pendingCount === 0 && !syncStatus) return null

  let bg, color, icon, msg

  if (!isOnline) {
    bg = '#854F0B'; color = 'white'; icon = '📵'
    msg = pendingCount > 0 ? `Offline · ${pendingCount} lançamento(s) pendente(s)` : 'Você está offline. Dados salvos localmente.'
  } else if (syncing) {
    bg = '#185FA5'; color = 'white'; icon = '🔄'
    msg = `Sincronizando ${pendingCount} lançamento(s)...`
  } else if (pendingCount > 0) {
    bg = '#854F0B'; color = 'white'; icon = '⏳'
    msg = `${pendingCount} lançamento(s) aguardando sincronização`
  } else if (syncStatus === 'ok') {
    bg = '#2d6a2d'; color = 'white'; icon = '✅'
    msg = 'Dados sincronizados com sucesso!'
  } else if (syncStatus === 'error') {
    bg = '#A32D2D'; color = 'white'; icon = '⚠️'
    msg = 'Erro ao sincronizar. Tente novamente.'
  } else return null

  return (
    <div style={{ position:'fixed', top:52, left:0, right:0, zIndex:190, background:bg, color, padding:'6px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, fontSize:12, fontWeight:500 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span>{icon}</span>
        <span>{msg}</span>
      </div>
      {isOnline && pendingCount > 0 && !syncing && (
        <button onClick={onSync} style={{ background:'rgba(255,255,255,0.25)', border:'none', color, borderRadius:6, padding:'3px 10px', cursor:'pointer', fontSize:11, fontWeight:600 }}>
          Sincronizar agora
        </button>
      )}
    </div>
  )
}

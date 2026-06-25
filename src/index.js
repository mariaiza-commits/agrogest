import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Remove qualquer service worker existente e limpa todos os caches
// Isso elimina de vez qualquer problema de cache/tela travada
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  })
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)))
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)

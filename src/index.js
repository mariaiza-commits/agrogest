import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Registra SW para PWA — força atualização imediata se há nova versão
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').then(reg => {
      reg.update()
    }).catch(() => {})
  })
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)

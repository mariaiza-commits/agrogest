import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Registra o Service Worker para PWA (offline + instalável)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(reg => console.log('SW registrado:', reg.scope))
      .catch(err => console.warn('SW falhou:', err))
  })
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)

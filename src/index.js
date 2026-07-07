import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Garante que qualquer service worker antigo seja removido (sem criar ciclo de cache)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister())
  })
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)

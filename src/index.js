import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Remove qualquer service worker antigo em cache
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister())
  })
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)

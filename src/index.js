import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Registra SW para PWA ser instalável — sem lógica de reload
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {})
  })
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)

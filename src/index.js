import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Desregistra qualquer service worker instalado e limpa caches
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
  caches.keys().then(ks => ks.forEach(k => caches.delete(k)))
}

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(<React.StrictMode><App /></React.StrictMode>)

# 🌿 AgroGestão

Sistema de gestão rural multi-cultura — Jaíba · MG

## 📋 Sobre

O AgroGestão é uma plataforma completa de gestão agrícola e financeira para produtores rurais, suportando múltiplas culturas (banana, gado, café, milho, etc.).

## 🚀 Tecnologias

- **Frontend:** React 18
- **Banco:** Supabase (PostgreSQL)
- **Deploy:** Vercel

## ⚙️ Instalação

```bash
git clone https://github.com/mariaiza-commits/bananagest.git
cd bananagest
npm install
cp .env.example .env   # Configure suas credenciais
npm start
```

## 🔑 Variáveis de ambiente

```
REACT_APP_SUPABASE_URL=https://SEU_PROJETO.supabase.co
REACT_APP_SUPABASE_KEY=sua_chave_anon_aqui
```

> ⚠️ Nunca commite o `.env` com chaves reais.

## 📁 Estrutura

```
src/
├── components/  → UI reutilizável
├── hooks/       → Lógica de dados
├── lib/         → supabase.js, utils.js
└── pages/       → Dashboard, Lotes, Vendas, etc.
```

## 🗺️ Roadmap

- [ ] Supabase Auth multi-usuário
- [ ] Modo offline
- [ ] App mobile nativo
- [ ] Multi-tenant SaaS

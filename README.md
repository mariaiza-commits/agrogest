# BananaGest — Sistema de Gestão de Plantio de Banana

## Como rodar localmente

```bash
# 1. Instalar dependências
npm install

# 2. Rodar em desenvolvimento
npm start
# Abre em http://localhost:3000
```

## Como publicar na Vercel (grátis)

1. Crie conta em https://vercel.com (pode entrar com GitHub)
2. Instale a CLI: `npm install -g vercel`
3. Na pasta do projeto, rode: `vercel`
4. Siga as instruções — em 2 minutos o sistema estará no ar com URL pública

## Estrutura do projeto

```
src/
  lib/
    supabase.js   ← conexão com o banco
    utils.js      ← formatação de moeda, datas, badges
  pages/
    Dashboard.jsx ← KPIs e gráficos
    Lotes.jsx     ← CRUD de talhões
    Producao.jsx  ← registro de colheitas
    Vendas.jsx    ← registro de vendas
    Custos.jsx    ← registro de custos
    Financeiro.jsx← contas a receber / pagar
  App.jsx         ← navegação e layout
  index.css       ← estilos globais
```

## Banco de dados

Supabase: https://juqvvdnybhwelctlhdlr.supabase.co

Todas as tabelas, views e funções foram criadas via script SQL.

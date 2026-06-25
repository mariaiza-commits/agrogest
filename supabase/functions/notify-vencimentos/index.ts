import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  // Busca todos os tenants ativos
  const { data: tenants } = await supabase.from('tenants').select('id, nome')
  if (!tenants?.length) return new Response('Sem tenants', { status: 200 })

  const hoje = new Date().toISOString().split('T')[0]
  const em7d = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  let enviados = 0

  for (const tenant of tenants) {
    // Busca contas vencendo em até 7 dias ou atrasadas
    const { data: contas } = await supabase
      .from('vw_contas_a_receber')
      .select('comprador, data_vencimento, valor_total, dias_atraso, status_pagamento')
      .lte('data_vencimento', em7d)

    if (!contas?.length) continue

    const atrasadas  = contas.filter(c => c.dias_atraso > 0)
    const vencendo   = contas.filter(c => c.dias_atraso <= 0)
    const totalPend  = contas.reduce((s, c) => s + Number(c.valor_total ?? 0), 0)

    // Busca email do dono do tenant
    const { data: membros } = await supabase
      .from('user_tenants')
      .select('user_id')
      .eq('tenant_id', tenant.id)
      .eq('role', 'owner')
      .limit(1)

    if (!membros?.length) continue

    const { data: { user } } = await supabase.auth.admin.getUserById(membros[0].user_id)
    if (!user?.email) continue

    const fmtBRL = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    const fmtDate = (d: string) => { const [y,m,day] = d.split('-'); return `${day}/${m}/${y}` }

    const linhasAtrasadas = atrasadas.map(c =>
      `<tr style="background:#fff5f5"><td>${c.comprador}</td><td>${fmtDate(c.data_vencimento)}</td><td style="color:#d94040;font-weight:600">${c.dias_atraso}d atrasado</td><td>${fmtBRL(c.valor_total)}</td></tr>`
    ).join('')

    const linhasVencendo = vencendo.map(c =>
      `<tr><td>${c.comprador}</td><td>${fmtDate(c.data_vencimento)}</td><td style="color:#ba7517">${Math.abs(c.dias_atraso)}d restante(s)</td><td>${fmtBRL(c.valor_total)}</td></tr>`
    ).join('')

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:sans-serif;color:#1c1c1a;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:#27500a;border-radius:10px;padding:20px 24px;margin-bottom:24px">
    <h1 style="color:white;margin:0;font-size:20px">🌿 AgroGestão</h1>
    <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px">Resumo de contas — ${tenant.nome}</p>
  </div>

  <p style="font-size:15px">Olá! Aqui está o resumo das suas contas a receber para hoje, <strong>${fmtDate(hoje)}</strong>.</p>

  <div style="background:#f4f3ee;border-radius:8px;padding:14px 18px;margin:16px 0;display:flex;justify-content:space-between">
    <span style="font-size:13px;color:#6b6b66">Total pendente</span>
    <span style="font-size:18px;font-weight:700;color:#0f6e56">${fmtBRL(totalPend)}</span>
  </div>

  ${atrasadas.length > 0 ? `
  <h3 style="color:#a32d2d;font-size:14px;margin:20px 0 8px">🔴 Contas atrasadas (${atrasadas.length})</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#a32d2d;color:white">
      <th style="padding:8px;text-align:left">Cliente</th>
      <th style="padding:8px;text-align:left">Vencimento</th>
      <th style="padding:8px;text-align:left">Situação</th>
      <th style="padding:8px;text-align:right">Valor</th>
    </tr></thead>
    <tbody>${linhasAtrasadas}</tbody>
  </table>` : ''}

  ${vencendo.length > 0 ? `
  <h3 style="color:#ba7517;font-size:14px;margin:20px 0 8px">⚠️ Vencendo em 7 dias (${vencendo.length})</h3>
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#ba7517;color:white">
      <th style="padding:8px;text-align:left">Cliente</th>
      <th style="padding:8px;text-align:left">Vencimento</th>
      <th style="padding:8px;text-align:left">Situação</th>
      <th style="padding:8px;text-align:right">Valor</th>
    </tr></thead>
    <tbody>${linhasVencendo}</tbody>
  </table>` : ''}

  <p style="margin-top:24px;font-size:12px;color:#6b6b66">
    Acesse <a href="https://bananagest.vercel.app" style="color:#3b6d11">bananagest.vercel.app</a> para registrar recebimentos.
  </p>
</body>
</html>`

    // Envia via Resend
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'AgroGestão <notificacoes@agrogestao.app>',
        to: [user.email],
        subject: `📋 ${atrasadas.length > 0 ? `⚠️ ${atrasadas.length} conta(s) atrasada(s) — ` : ''}Contas a receber hoje · ${tenant.nome}`,
        html,
      }),
    })

    enviados++
  }

  return new Response(JSON.stringify({ ok: true, enviados }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

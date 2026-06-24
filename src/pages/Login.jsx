import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Leaf, ArrowRight, Mail, Lock, Home, CheckCircle } from 'lucide-react'

function Logo() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{
        width:38, height:38,
        background:'white',
        borderRadius:11,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 2px 8px rgba(0,0,0,.15)',
      }}>
        <Leaf size={20} color="var(--green)" strokeWidth={2.2}/>
      </div>
      <span style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:22,color:'white',letterSpacing:'-.3px'}}>
        AgroGestão
      </span>
    </div>
  )
}

const FEATURES = [
  'Gestão de lotes e produção',
  'Controle financeiro completo',
  'Vendas e contas a receber',
  'Relatórios e dashboard',
]

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]       = useState('login')
  const [email, setEmail]     = useState('')
  const [senha, setSenha]     = useState('')
  const [fazenda, setFazenda] = useState('')
  const [erro, setErro]       = useState('')
  const [loading, setLoading] = useState(false)
  const [signupOk, setSignupOk] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, senha)
      } else {
        if (!fazenda.trim()) { setErro('Informe o nome da sua fazenda.'); setLoading(false); return }
        await signUp(email, senha, fazenda.trim())
        setSignupOk(true)
      }
    } catch (err) {
      setErro(err.message || 'Erro ao autenticar. Verifique suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'var(--bg)' }}>

      {/* ── Painel esquerdo (visível só em desktop) ── */}
      <div style={{
        width:420, flexShrink:0,
        background:'linear-gradient(160deg, var(--green) 0%, var(--green-dark) 100%)',
        display:'flex', flexDirection:'column', justifyContent:'space-between',
        padding:'40px 44px',
      }} className="login-panel">
        <Logo/>

        <div>
          <div style={{fontSize:32,fontWeight:700,color:'white',lineHeight:1.25,fontFamily:'var(--font-display)',marginBottom:16}}>
            Gestão agrícola<br/>simples e eficiente
          </div>
          <p style={{fontSize:15,color:'rgba(255,255,255,0.72)',lineHeight:1.6,marginBottom:32}}>
            Controle sua fazenda de qualquer lugar. Produção, vendas e financeiro em um só lugar.
          </p>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {FEATURES.map(f => (
              <div key={f} style={{display:'flex',alignItems:'center',gap:10}}>
                <CheckCircle size={16} color="rgba(255,255,255,0.85)" strokeWidth={2}/>
                <span style={{fontSize:14,color:'rgba(255,255,255,0.85)'}}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>
          © 2025 AgroGestão · v2.0
        </div>
      </div>

      {/* ── Painel direito — formulário ── */}
      <div style={{
        flex:1, display:'flex', alignItems:'center', justifyContent:'center',
        padding:24,
      }}>
        <div style={{width:'100%',maxWidth:400}}>

          {/* Só em mobile mostra o logo aqui */}
          <div className="login-logo-mobile" style={{textAlign:'center',marginBottom:32,display:'none'}}>
            <div style={{
              width:52,height:52,
              background:'linear-gradient(135deg, var(--green-mid), var(--green-dark))',
              borderRadius:15,margin:'0 auto 12px',
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>
              <Leaf size={26} color="white" strokeWidth={2.2}/>
            </div>
            <div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:24,color:'var(--green-dark)'}}>
              AgroGestão
            </div>
          </div>

          <div style={{marginBottom:32}}>
            <h1 style={{fontSize:22,fontWeight:700,color:'var(--text)',letterSpacing:'-.3px',marginBottom:6}}>
              {mode === 'login' ? 'Bem-vindo de volta' : 'Criar sua conta'}
            </h1>
            <p style={{fontSize:14,color:'var(--text-muted)'}}>
              {mode === 'login'
                ? 'Entre com suas credenciais para continuar.'
                : 'Preencha os dados para começar gratuitamente.'}
            </p>
          </div>

          {/* Toggle login / signup */}
          <div style={{display:'flex',marginBottom:28,background:'var(--gray-50)',borderRadius:10,padding:3,border:'1px solid var(--border)'}}>
            {['login','signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setErro('') }} style={{
                flex:1,padding:'8px 0',border:'none',borderRadius:8,cursor:'pointer',
                fontWeight:600,fontSize:13,fontFamily:'var(--font)',
                background: mode===m ? 'white' : 'transparent',
                color: mode===m ? 'var(--green-dark)' : 'var(--text-muted)',
                boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition:'all .15s',
              }}>
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          {signupOk ? (
            <div style={{textAlign:'center',padding:'32px 0'}}>
              <div style={{
                width:64,height:64,borderRadius:'50%',
                background:'var(--green-light)',
                display:'flex',alignItems:'center',justifyContent:'center',
                margin:'0 auto 20px',
              }}>
                <CheckCircle size={32} color="var(--green)" strokeWidth={2}/>
              </div>
              <p style={{fontWeight:700,fontSize:18,marginBottom:8}}>Cadastro realizado!</p>
              <p style={{fontSize:14,color:'var(--text-muted)',marginBottom:24,lineHeight:1.6}}>
                Verifique seu e-mail para confirmar a conta e então faça login.
              </p>
              <button className="btn btn-primary" style={{width:'100%'}}
                onClick={() => { setMode('login'); setSignupOk(false) }}>
                Ir para o login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
              {mode === 'signup' && (
                <div className="form-group">
                  <label>Nome da fazenda</label>
                  <div style={{position:'relative'}}>
                    <Home size={15} color="var(--text-muted)" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)'}}/>
                    <input type="text" value={fazenda} onChange={e=>setFazenda(e.target.value)}
                      placeholder="Ex: Fazenda São João" autoFocus required
                      style={{paddingLeft:36}}/>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>E-mail</label>
                <div style={{position:'relative'}}>
                  <Mail size={15} color="var(--text-muted)" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)'}}/>
                  <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                    placeholder="seu@email.com" autoFocus={mode==='login'} required
                    style={{paddingLeft:36}}/>
                </div>
              </div>

              <div className="form-group">
                <label>Senha</label>
                <div style={{position:'relative'}}>
                  <Lock size={15} color="var(--text-muted)" style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)'}}/>
                  <input type="password" value={senha} onChange={e=>setSenha(e.target.value)}
                    placeholder={mode==='signup'?'Mínimo 6 caracteres':'Sua senha'} required
                    style={{paddingLeft:36}}/>
                </div>
              </div>

              {erro && (
                <div style={{
                  fontSize:13,color:'var(--red)',
                  padding:'10px 14px',
                  background:'var(--red-light)',
                  borderRadius:8,
                  border:'1px solid rgba(163,45,45,0.2)',
                }}>
                  {erro}
                </div>
              )}

              <button type="submit" className="btn btn-primary"
                style={{width:'100%',fontSize:14,padding:'12px',marginTop:4,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}
                disabled={loading||!email||!senha}>
                {loading ? 'Aguarde...' : (
                  <>
                    {mode==='login' ? 'Entrar' : 'Criar conta'}
                    <ArrowRight size={16}/>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

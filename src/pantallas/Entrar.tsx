import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { Icono, MensajeError } from '../comun'

export function Entrar() {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setAviso(null)
    setEnviando(true)
    if (modo === 'entrar') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: clave })
      if (error) setError(traducir(error.message))
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: clave, options: { data: { nombre } } })
      if (error) setError(traducir(error.message))
      else if (!data.session) setAviso('Listo. Le llegó un correo para confirmar la cuenta; después vuelva aquí y entre.')
    }
    setEnviando(false)
  }

  return (
    <div className="app">
      <form className="contenido" onSubmit={enviar} style={{ justifyContent: 'center' }}>
        <div className="cabeza">
          <div className="crece">
            <h1>Presupuesto</h1>
            <span className="sub">Su presupuesto y los gastos que comparte</span>
          </div>
        </div>
        <div className="segs" role="tablist">
          <button type="button" className={`seg ${modo === 'entrar' ? 'on' : ''}`} onClick={() => setModo('entrar')}>
            Entrar
          </button>
          <button type="button" className={`seg ${modo === 'crear' ? 'on' : ''}`} onClick={() => setModo('crear')}>
            Crear cuenta
          </button>
        </div>
        {modo === 'crear' && (
          <label className="campo">
            <span>Nombre</span>
            <input className="inp" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoComplete="given-name" />
          </label>
        )}
        <label className="campo">
          <span>Correo</span>
          <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <div style={{ position: 'relative' }}>
            <input
              className="inp"
              type={verClave ? 'text' : 'password'}
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              required
              minLength={6}
              autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
              style={{ paddingRight: 52 }}
            />
            <button
              type="button"
              onClick={() => setVerClave(!verClave)}
              aria-label={verClave ? 'Ocultar contraseña' : 'Ver contraseña'}
              aria-pressed={verClave}
              style={{ position: 'absolute', right: 2, top: 2, bottom: 2, width: 48, border: 'none', background: 'none', color: 'var(--suave)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icono n={verClave ? 'ojo-tachado' : 'ojo'} />
            </button>
          </div>
        </label>
        <MensajeError texto={error} />
        {aviso && <div className="aviso">{aviso}</div>}
        <button className="btn verde" disabled={enviando}>
          {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  )
}

// Mensajes de Supabase en palabras claras.
function traducir(m: string): string {
  if (m === 'Invalid login credentials') return 'Correo o contraseña incorrectos.'
  if (m === 'Failed to fetch' || m.includes('NetworkError')) return 'No se pudo conectar con el servidor. Revise el internet o que Supabase esté configurado en .env.local.'
  if (m.includes('already registered')) return 'Ese correo ya tiene cuenta. Toque "Entrar".'
  if (m.includes('Email not confirmed')) return 'Falta confirmar el correo: busque el mensaje de Supabase en su bandeja.'
  if (m.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  return m
}

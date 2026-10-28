import { useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { MensajeError } from '../comun'

export function Entrar() {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
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
      if (error) setError(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos.' : error.message)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: clave, options: { data: { nombre } } })
      if (error) setError(error.message)
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
          <input
            className="inp"
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            required
            minLength={6}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          />
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

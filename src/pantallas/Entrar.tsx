import { useState, type FormEvent } from 'react'
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { auth, mensaje } from '../firebase'
import { Icono, MensajeError } from '../comun'

export function Entrar() {
  const [modo, setModo] = useState<'entrar' | 'crear'>('entrar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      if (modo === 'entrar') {
        await signInWithEmailAndPassword(auth, email.trim(), clave)
      } else {
        sessionStorage.setItem('nombre-nuevo', nombre.trim())
        const r = await createUserWithEmailAndPassword(auth, email.trim(), clave)
        await updateProfile(r.user, { displayName: nombre.trim() })
      }
    } catch (e) {
      setError(mensaje(e))
      setEnviando(false)
    }
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
        <button className="btn verde" disabled={enviando}>
          {modo === 'entrar' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>
    </div>
  )
}


import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth, configurado } from './firebase'
import { aceptarInvitaciones, guardarPerfil, leerPerfil } from './datos'
import { Icono, Sesion, type Vista } from './comun'
import type { Perfil } from './tipos'
import { Entrar } from './pantallas/Entrar'
import { Inicio } from './pantallas/Inicio'
import { Presupuesto } from './pantallas/Presupuesto'
import { Cuentas } from './pantallas/Cuentas'
import { Grupos, GrupoDetalle } from './pantallas/Grupos'
import { NuevoGasto } from './pantallas/NuevoGasto'
import { Pagos } from './pantallas/Pagos'

const TABS: { p: Vista['p']; t: string; i: string }[] = [
  { p: 'inicio', t: 'Inicio', i: 'inicio' },
  { p: 'presupuesto', t: 'Presupuesto', i: 'presupuesto' },
  { p: 'grupos', t: 'Grupos', i: 'grupos' },
  { p: 'pagos', t: 'Pagos', i: 'pagos' },
]

const TAB_DE: Partial<Record<Vista['p'], Vista['p']>> = { cuentas: 'presupuesto', grupo: 'grupos', gasto: 'grupos' }

export function App() {
  const [sesion, setSesion] = useState<User | null | undefined>(undefined)
  const [yo, setYo] = useState<Perfil | null>(null)
  const [vista, setVista] = useState<Vista>({ p: 'inicio' })

  useEffect(() => {
    if (!configurado) return
    return onAuthStateChanged(auth, setSesion)
  }, [])

  useEffect(() => {
    if (!sesion) {
      setYo(null)
      return
    }
    cargarPerfil(sesion).then(setYo)
  }, [sesion])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [vista])

  if (!configurado) {
    return (
      <div className="app">
        <div className="contenido">
          <h1>Falta conectar Firebase</h1>
          <p className="suave">
            Copie <code>.env.example</code> como <code>.env.local</code>, ponga los datos de su proyecto de Firebase y vuelva a abrir la app.
          </p>
        </div>
      </div>
    )
  }
  if (sesion === undefined) return null
  if (!sesion) return <Entrar />
  if (!yo) return null

  const activo = TAB_DE[vista.p] ?? vista.p
  return (
    <Sesion.Provider value={{ yo, ir: setVista, salir: () => signOut(auth) }}>
      <div className="app">
        {vista.p === 'inicio' && <Inicio />}
        {vista.p === 'presupuesto' && <Presupuesto />}
        {vista.p === 'cuentas' && <Cuentas />}
        {vista.p === 'grupos' && <Grupos />}
        {vista.p === 'grupo' && <GrupoDetalle id={vista.id} />}
        {vista.p === 'gasto' && <NuevoGasto grupoId={vista.grupoId} volver={vista.volver} />}
        {vista.p === 'pagos' && <Pagos />}
        <nav className="nav" aria-label="Secciones">
          <div>
            {TABS.map((t) => (
              <button key={t.p} className={`tab ${activo === t.p ? 'on' : ''}`} onClick={() => setVista({ p: t.p } as Vista)} aria-current={activo === t.p ? 'page' : undefined}>
                <Icono n={t.i} />
                {t.t}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </Sesion.Provider>
  )
}

// Lee (o crea) el perfil y se une a los grupos donde lo invitaron.
async function cargarPerfil(u: User): Promise<Perfil> {
  const email = u.email ?? ''
  let perfil = await leerPerfil(u.uid).catch(() => null)
  if (!perfil) {
    const nombre = sessionStorage.getItem('nombre-nuevo') || u.displayName || email.split('@')[0]
    perfil = { id: u.uid, nombre, email }
    await guardarPerfil(perfil).catch(() => undefined)
    sessionStorage.removeItem('nombre-nuevo')
  }
  await aceptarInvitaciones(perfil).catch(() => undefined)
  return perfil
}

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configurado, supabase } from './supabase'
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
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined)
  const [yo, setYo] = useState<Perfil | null>(null)
  const [vista, setVista] = useState<Vista>({ p: 'inicio' })

  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => setSesion(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSesion(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!sesion) return setYo(null)
    const u = sesion.user
    supabase.rpc('aceptar_invitaciones').then(() =>
      supabase
        .from('perfiles')
        .select('id, nombre, email')
        .eq('id', u.id)
        .maybeSingle()
        .then(({ data }) => setYo((data as Perfil | null) ?? { id: u.id, nombre: u.email ?? '', email: u.email ?? '' })),
    )
  }, [sesion])

  useEffect(() => window.scrollTo(0, 0), [vista])

  if (!configurado) {
    return (
      <div className="app">
        <div className="contenido">
          <h1>Falta conectar Supabase</h1>
          <p className="suave">
            Copie <code>.env.example</code> como <code>.env.local</code>, ponga la URL y la anon key de su proyecto y vuelva a abrir la app.
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
    <Sesion.Provider value={{ yo, ir: setVista, salir: () => supabase.auth.signOut() }}>
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

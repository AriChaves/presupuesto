import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { mensaje } from './firebase'
import { gastosYPagos, misGrupos } from './datos'
import type { Gasto, Grupo, Miembro, PagoGrupo, Perfil } from './tipos'

// ───────────── Navegación ─────────────
export type Vista =
  | { p: 'inicio' }
  | { p: 'presupuesto' }
  | { p: 'cuentas' }
  | { p: 'grupos' }
  | { p: 'grupo'; id: string }
  | { p: 'gasto'; grupoId?: string; volver: Vista }
  | { p: 'pagos' }

type Ctx = { yo: Perfil; ir: (v: Vista) => void; salir: () => void }
export const Sesion = createContext<Ctx>(null as unknown as Ctx)
export const useSesion = () => useContext(Sesion)

// ───────────── Carga de datos ─────────────
export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [vuelta, setVuelta] = useState(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fn = useCallback(cargar, deps)
  useEffect(() => {
    let vivo = true
    fn()
      .then((d) => vivo && (setDatos(d), setError(null)))
      .catch((e: unknown) => vivo && setError(mensaje(e)))
    return () => {
      vivo = false
    }
  }, [fn, vuelta])
  return { datos, error, recargar: () => setVuelta((v) => v + 1) }
}

export type DatosGrupos = {
  grupos: Grupo[]
  miembros: Miembro[]
  perfiles: Record<string, Perfil>
  gastos: Gasto[]
  pagos: PagoGrupo[]
}

// Trae mis grupos con sus miembros, gastos y pagos.
export async function cargarGrupos(): Promise<DatosGrupos> {
  const grupos = await misGrupos()
  const todo = await Promise.all(grupos.map((g) => gastosYPagos(g.id)))
  const miembros = grupos.flatMap((g) => g.miembros.map((user_id) => ({ grupo_id: g.id, user_id })))
  const perfiles: Record<string, Perfil> = {}
  for (const g of grupos) for (const [id, nombre] of Object.entries(g.nombres ?? {})) perfiles[id] = { id, nombre, email: '' }
  return { grupos, miembros, perfiles, gastos: todo.flatMap((x) => x.gastos), pagos: todo.flatMap((x) => x.pagos) }
}

// Corre una escritura y muestra el error en pantalla si falla.
export function useHacer(setError: (e: string | null) => void, recargar: () => void) {
  return async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(mensaje(e))
    }
    recargar()
  }
}

export function nombreDe(perfiles: Record<string, Perfil>, id: string, yo: string): string {
  if (id === yo) return 'Vos'
  return perfiles[id]?.nombre || perfiles[id]?.email || 'Alguien'
}

export function inicial(texto: string): string {
  return (texto.trim()[0] ?? '?').toUpperCase()
}

// ───────────── Piezas visuales ─────────────
const ICONOS: Record<string, ReactNode> = {
  inicio: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  presupuesto: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  grupos: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M15 14.5a5 5 0 0 1 6.5 5.5" />
    </>
  ),
  pagos: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  atras: <path d="M15 5l-7 7 7 7" />,
  mas: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12l5 5 9-10" />,
  candado: (
    <>
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
    </>
  ),
  basura: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  ojo: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'ojo-tachado': (
    <>
      <path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.6 3.6M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </>
  ),
}

export function Icono({ n, t = 22, grosor = 2 }: { n: string; t?: number; grosor?: number }) {
  return (
    <svg width={t} height={t} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONOS[n]}
    </svg>
  )
}

export function Atras({ a }: { a: Vista }) {
  const { ir } = useSesion()
  return (
    <button className="atras" aria-label="Volver" onClick={() => ir(a)}>
      <Icono n="atras" />
    </button>
  )
}

export function Check({ on, alCambiar, etiqueta }: { on: boolean; alCambiar: () => void; etiqueta: string }) {
  return (
    <button className={`chk ${on ? 'on' : ''}`} onClick={alCambiar} aria-pressed={on} aria-label={etiqueta}>
      {on && (
        <span style={{ color: '#fff', display: 'flex' }}>
          <Icono n="check" t={15} grosor={3} />
        </span>
      )}
    </button>
  )
}

export function MensajeError({ texto }: { texto: string | null }) {
  return texto ? <div className="error" role="alert">{texto}</div> : null
}

export function Cargando() {
  return <div className="vacio">Cargando…</div>
}

// Convierte "12,500" o "12500.5" en número.
export function leerMonto(t: string): number {
  const n = Number(t.replace(/[₡\s,]/g, ''))
  return Number.isFinite(n) ? n : 0
}

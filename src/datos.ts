// Todo lo que se lee y escribe en Firestore.
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Gasto, Grupo, PagoGrupo, Perfil, Renglon } from './tipos'
import { sobranteArrastrado, type PorMoneda } from './dinero'

const uid = () => {
  const u = auth.currentUser
  if (!u) throw new Error('Tiene que entrar primero.')
  return u.uid
}

// ───────────── Perfil ─────────────
export async function guardarPerfil(p: Perfil) {
  await setDoc(doc(db, 'usuarios', p.id), { nombre: p.nombre, email: p.email }, { merge: true })
}

export async function leerPerfil(id: string): Promise<Perfil | null> {
  const s = await getDoc(doc(db, 'usuarios', id))
  return s.exists() ? ({ id, ...s.data() } as Perfil) : null
}

// ───────────── Lo personal: usuarios/{uid}/{coleccion} ─────────────
export type ColPersonal = 'cuentas' | 'sobres' | 'plantillas' | 'renglones' | 'prestamos'

const personal = (col: ColPersonal) => collection(db, 'usuarios', uid(), col)

export async function listar<T extends { id: string }>(col: ColPersonal, ...filtros: QueryConstraint[]): Promise<T[]> {
  const s = await getDocs(query(personal(col), ...filtros))
  const lista = s.docs.map((d) => ({ id: d.id, ...d.data() }) as T & { orden?: number; nombre?: string })
  return lista.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || (a.nombre ?? '').localeCompare(b.nombre ?? ''))
}

export const agregar = (col: ColPersonal, datos: object) => addDoc(personal(col), datos)
export const cambiar = (col: ColPersonal, id: string, datos: object) => updateDoc(doc(personal(col), id), datos)
export const borrar = (col: ColPersonal, id: string) => deleteDoc(doc(personal(col), id))
export { increment, where }

// ───────────── Grupos: grupos/{gid} con gastos y pagos ─────────────
type GrupoDoc = Omit<Grupo, 'id'>

export async function misGrupos(): Promise<Grupo[]> {
  const s = await getDocs(query(collection(db, 'grupos'), where('miembros', 'array-contains', uid())))
  return s.docs.map((d) => ({ id: d.id, ...(d.data() as GrupoDoc) })).sort((a, b) => a.nombre.localeCompare(b.nombre))
}

export async function gastosYPagos(gid: string): Promise<{ gastos: Gasto[]; pagos: PagoGrupo[] }> {
  const [g, p] = await Promise.all([getDocs(collection(db, 'grupos', gid, 'gastos')), getDocs(collection(db, 'grupos', gid, 'pagos'))])
  return {
    gastos: g.docs.map((d) => ({ id: d.id, grupo_id: gid, ...d.data() }) as Gasto).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    pagos: p.docs.map((d) => ({ id: d.id, grupo_id: gid, ...d.data() }) as PagoGrupo).sort((a, b) => b.fecha.localeCompare(a.fecha)),
  }
}

export async function crearGrupo(nombre: string, yo: Perfil): Promise<string> {
  const r = await addDoc(collection(db, 'grupos'), {
    nombre,
    creadoPor: yo.id,
    miembros: [yo.id],
    nombres: { [yo.id]: yo.nombre },
    invitados: [],
    creadoEn: serverTimestamp(),
  })
  return r.id
}

export const invitar = (gid: string, email: string) => updateDoc(doc(db, 'grupos', gid), { invitados: arrayUnion(email.toLowerCase()) })
export const quitarInvitacion = (gid: string, email: string) => updateDoc(doc(db, 'grupos', gid), { invitados: arrayRemove(email) })

// Alguien del grupo que todavía no tiene cuenta.
export async function agregarPersona(gid: string, nombre: string): Promise<string> {
  const pid = `p_${Math.random().toString(36).slice(2, 10)}`
  await updateDoc(doc(db, 'grupos', gid), { [`personas.${pid}`]: { nombre } })
  return pid
}

// Cuando esa persona ya entró con su cuenta: lo anotado a su nombre pasa a ser suyo.
export const vincularPersona = (gid: string, pid: string, uid: string) => updateDoc(doc(db, 'grupos', gid), { [`vinculos.${pid}`]: uid })

export const salirDeGrupo = (gid: string) =>
  updateDoc(doc(db, 'grupos', gid), { miembros: arrayRemove(uid()), [`nombres.${uid()}`]: deleteField() })

// Al entrar, se une a los grupos donde invitaron su correo.
export async function aceptarInvitaciones(yo: Perfil) {
  const email = yo.email.toLowerCase()
  const s = await getDocs(query(collection(db, 'grupos'), where('invitados', 'array-contains', email)))
  await Promise.all(
    s.docs.map((d) =>
      updateDoc(d.ref, { miembros: arrayUnion(yo.id), invitados: arrayRemove(email), [`nombres.${yo.id}`]: yo.nombre }),
    ),
  )
}

export async function agregarGasto(gid: string, g: Omit<Gasto, 'id' | 'grupo_id'>): Promise<string> {
  const r = await addDoc(collection(db, 'grupos', gid, 'gastos'), { ...g, creadoPor: uid(), creadoEn: serverTimestamp() })
  return r.id
}

export const borrarGasto = (gid: string, id: string) => deleteDoc(doc(db, 'grupos', gid, 'gastos', id))

export const agregarPago = (gid: string, p: Omit<PagoGrupo, 'id' | 'grupo_id'>) => addDoc(collection(db, 'grupos', gid, 'pagos'), p)
export const borrarPago = (gid: string, id: string) => deleteDoc(doc(db, 'grupos', gid, 'pagos', id))

// Avisa cuando alguien del grupo anota o borra algo (no al conectar).
export function escucharGrupo(gid: string, alCambiar: () => void): () => void {
  const saltarPrimera = () => {
    let primera = true
    return () => {
      if (primera) primera = false
      else alCambiar()
    }
  }
  const quitar = [
    onSnapshot(collection(db, 'grupos', gid, 'gastos'), saltarPrimera()),
    onSnapshot(collection(db, 'grupos', gid, 'pagos'), saltarPrimera()),
    onSnapshot(doc(db, 'grupos', gid), saltarPrimera()),
  ]
  return () => quitar.forEach((q) => q())
}

// ───────────── Sobrante que pasa al mes siguiente ─────────────
export async function leerDesdeMes(): Promise<string | null> {
  const s = await getDoc(doc(db, 'usuarios', uid()))
  return (s.data()?.desdeMes as string | undefined) ?? null
}

export const guardarDesdeMes = (desdeMes: string | null) => setDoc(doc(db, 'usuarios', uid()), { desdeMes }, { merge: true })

// Lo que viene sobrando de los meses anteriores a `mes`, por moneda (0 si está apagado).
export async function cargarArrastre(mes: string): Promise<PorMoneda> {
  const desde = await leerDesdeMes()
  if (!desde || mes <= desde) return { CRC: 0, USD: 0 }
  const anteriores = await listar<Renglon>('renglones', where('mes', '>=', desde), where('mes', '<', mes))
  return { CRC: sobranteArrastrado(anteriores, desde, mes, 'CRC'), USD: sobranteArrastrado(anteriores, desde, mes, 'USD') }
}

// Tipo de cambio de ARi que escribió la última vez (colones por dólar).
export type TipoARi = { compra: number; venta: number }

export async function leerTipoARi(): Promise<TipoARi | null> {
  const s = await getDoc(doc(db, 'usuarios', uid()))
  return (s.data()?.tipoARi as TipoARi | undefined) ?? null
}

export const guardarTipoARi = (tipoARi: TipoARi) => setDoc(doc(db, 'usuarios', uid()), { tipoARi }, { merge: true })

// Meses a los que ya se les puso solo lo de cada mes (gastos fijos, transporte), para no volver
// a ponerlo si después lo borra.
export type Puesto = 'fijosPuestos' | 'transportePuesto'

export async function yaPuesto(mes: string, que: Puesto): Promise<boolean> {
  const s = await getDoc(doc(db, 'usuarios', uid()))
  return Boolean(s.data()?.[que]?.[mes])
}

export const marcarPuesto = (mes: string, que: Puesto) => setDoc(doc(db, 'usuarios', uid()), { [que]: { [mes]: true } }, { merge: true })

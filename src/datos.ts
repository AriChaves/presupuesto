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
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { Gasto, Grupo, PagoGrupo, Perfil } from './tipos'

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
export { where }

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

import type { Division, Moneda, Parte } from './dinero'

export type Perfil = { id: string; nombre: string; email: string }
// personas: gente del grupo que todavía no tiene cuenta (se anotan gastos a su nombre).
// vinculos: cuando esa persona entra con su cuenta, su id de persona apunta a su usuario.
export type Grupo = {
  id: string
  nombre: string
  creadoPor: string
  miembros: string[]
  nombres: Record<string, string>
  invitados: string[]
  personas?: Record<string, { nombre: string }>
  vinculos?: Record<string, string>
}
export type Miembro = { grupo_id: string; user_id: string }

export type Gasto = {
  id: string
  grupo_id: string
  fecha: string
  descripcion: string
  categoria: string
  monto: number
  pagado_por: string
  division: Division
  medio: string
  partes: Parte[]
}

export type PagoGrupo = { id: string; grupo_id: string; de: string; a: string; monto: number; fecha: string; nota: string }

export type Cuenta = { id: string; nombre: string; tipo: string; efectivo_suelto: number; orden: number; moneda?: Moneda }
export type Sobre = { id: string; nombre: string; monto: number; cuenta_id: string | null; orden: number; moneda?: Moneda }

// 'cambio': pasar plata de una moneda a otra. Va en pareja (sale de una, entra en la otra) con el mismo cambio_id.
export type TipoRenglon = 'entrada' | 'fijo' | 'extra' | 'transporte' | 'cambio'
export type Plantilla = { id: string; tipo: 'entrada' | 'fijo'; nombre: string; monto: number; dia_vence: number | null; cuenta_id: string | null; orden: number; moneda?: Moneda }
export type Renglon = {
  id: string
  mes: string
  tipo: TipoRenglon
  nombre: string
  monto: number
  hecho: boolean
  dia_vence: number | null
  cuenta_id: string | null
  gasto_id: string | null
  orden: number
  moneda?: Moneda
  cambio_id?: string
  grupo_id?: string
}

export type Prestamo = {
  id: string
  nombre: string
  direccion: 'debo' | 'me_deben'
  monto_total: number
  cuota: number
  cuotas_total: number
  cuotas_pagadas: number
  dia_pago: number | null
  cuenta_id: string | null
}

// Cálculos de plata: formato, división de gastos, saldos y próximos pagos.

export type Division = 'mitad' | 'partes' | 'solo'
export type Parte = { user_id: string; monto: number }
export type GastoConPartes = { pagado_por: string; monto: number; partes: Parte[] }
export type Pago = { de: string; a: string; monto: number }
export type Transferencia = { de: string; a: string; monto: number }

const redondear = (n: number) => Math.round(n * 100) / 100

export function colones(n: number): string {
  const signo = n < 0 ? '−' : ''
  return `${signo}₡${Math.round(Math.abs(n)).toLocaleString('en-US')}`
}

export type Moneda = 'CRC' | 'USD'
export const MONEDAS: Moneda[] = ['CRC', 'USD']
export const SIMBOLO: Record<Moneda, string> = { CRC: '₡', USD: '$' }

// Colones sin decimales; dólares con centavos.
export function dinero(n: number, moneda: Moneda = 'CRC'): string {
  if (moneda === 'CRC') return colones(n)
  const signo = n < 0 ? '−' : ''
  return `${signo}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type PorMoneda = Record<Moneda, number>

export function sumarPorMoneda(items: { monto: number; moneda?: Moneda }[]): PorMoneda {
  const t: PorMoneda = { CRC: 0, USD: 0 }
  for (const it of items) t[it.moneda ?? 'CRC'] = redondear(t[it.moneda ?? 'CRC'] + (Number(it.monto) || 0))
  return t
}

// "₡8,901 · $120.00": los colones siempre; los dólares solo si hay.
export function textoMonedas(t: PorMoneda): string {
  return t.USD !== 0 ? (t.CRC !== 0 ? `${dinero(t.CRC)} · ${dinero(t.USD, 'USD')}` : dinero(t.USD, 'USD')) : dinero(t.CRC)
}

export function mesDe(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
}

export function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number)
  return mesDe(new Date(a, m - 1 + delta, 1))
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function nombreMes(mes: string, conAnio = true): string {
  const [a, m] = mes.split('-').map(Number)
  const n = MESES[m - 1]
  const cap = n[0].toUpperCase() + n.slice(1)
  return conAnio ? `${cap} ${a}` : cap
}

export function mesCorto(mes: string): string {
  return MESES[Number(mes.split('-')[1]) - 1].slice(0, 3)
}

// Reparte un gasto entre los miembros. "solo" = todo es de quien pagó.
export function dividir(
  monto: number,
  division: Division,
  miembros: string[],
  pagadoPor: string,
  manual: Record<string, number> = {},
): Parte[] {
  if (division === 'solo') return [{ user_id: pagadoPor, monto: redondear(monto) }]
  if (division === 'partes') {
    return miembros
      .map((id) => ({ user_id: id, monto: redondear(manual[id] ?? 0) }))
      .filter((p) => p.monto !== 0)
  }
  const n = miembros.length
  if (n === 0) return []
  const base = Math.floor((monto * 100) / n) / 100
  const sobra = redondear(monto - base * n)
  return miembros.map((id, i) => ({ user_id: id, monto: redondear(i === 0 ? base + sobra : base) }))
}

// Saldo neto por persona: positivo = le deben, negativo = debe.
export function saldosNetos(gastos: GastoConPartes[], pagos: Pago[]): Record<string, number> {
  const neto: Record<string, number> = {}
  const sumar = (id: string, n: number) => {
    neto[id] = redondear((neto[id] ?? 0) + n)
  }
  for (const g of gastos) {
    sumar(g.pagado_por, Number(g.monto))
    for (const p of g.partes) sumar(p.user_id, -Number(p.monto))
  }
  for (const p of pagos) {
    sumar(p.de, Number(p.monto))
    sumar(p.a, -Number(p.monto))
  }
  return neto
}

// Convierte saldos netos en la menor lista razonable de "X le debe a Y".
export function liquidar(neto: Record<string, number>): Transferencia[] {
  const deben = Object.entries(neto).filter(([, n]) => n < -0.5).map(([id, n]) => ({ id, n: -n }))
  const reciben = Object.entries(neto).filter(([, n]) => n > 0.5).map(([id, n]) => ({ id, n }))
  deben.sort((a, b) => b.n - a.n)
  reciben.sort((a, b) => b.n - a.n)
  const out: Transferencia[] = []
  let i = 0
  let j = 0
  while (i < deben.length && j < reciben.length) {
    const monto = Math.min(deben[i].n, reciben[j].n)
    out.push({ de: deben[i].id, a: reciben[j].id, monto: redondear(monto) })
    deben[i].n -= monto
    reciben[j].n -= monto
    if (deben[i].n < 0.5) i++
    if (reciben[j].n < 0.5) j++
  }
  return out
}

// `fecha` manda cuando viene (quincenas, meses siguientes); si no, `dia` es un día del mes de hoy.
export type Vencimiento = { nombre: string; monto: number; dia: number; detalle?: string; moneda?: Moneda; fecha?: Date }
export type ProximoPago = Vencimiento & { fecha: Date; dias: number; estado: string }

// Ordena lo pendiente del mes por fecha y le pone "Vencido", "Hoy", "Mañana" o "En N días".
export function proximosPagos(items: Vencimiento[], hoy: Date): ProximoPago[] {
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const ultimo = new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate()
  return items
    .map((it) => {
      const fecha = it.fecha ? new Date(it.fecha.getFullYear(), it.fecha.getMonth(), it.fecha.getDate()) : new Date(h.getFullYear(), h.getMonth(), Math.min(it.dia, ultimo))
      const dias = Math.round((fecha.getTime() - h.getTime()) / 86400000)
      const estado =
        dias < 0 ? `Vencido · hace ${-dias} ${-dias === 1 ? 'día' : 'días'}` : dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`
      return { ...it, fecha, dias, estado }
    })
    .sort((a, b) => a.dias - b.dias)
}

export type RenglonMes = { mes: string; tipo: string; monto: number; hecho: boolean; moneda?: Moneda }

// Resumen de un mes en una moneda. Un cambio de moneda trae su signo: − sale, + entra.
export function resumenMes(renglones: RenglonMes[], moneda: Moneda, arrastre = 0) {
  const deMoneda = renglones.filter((r) => r.hecho && (r.moneda ?? 'CRC') === moneda)
  const suma = (f: (r: RenglonMes) => boolean) => redondear(deMoneda.filter(f).reduce((s, r) => s + r.monto, 0))
  const entradas = redondear(suma((r) => r.tipo === 'entrada') + arrastre)
  const cambio = suma((r) => r.tipo === 'cambio')
  const gasto = suma((r) => r.tipo !== 'entrada' && r.tipo !== 'cambio')
  return { entradas, cambio, gasto, sobrante: redondear(entradas + cambio - gasto) }
}

// Lo que viene sobrando de los meses anteriores: desde `desde` hasta antes de `mes`.
// Cada mes pasa al siguiente lo que entró menos lo que se gastó (solo lo marcado), por moneda.
// Solo pasa lo que sobra: si un mes queda en negativo, el siguiente empieza en cero.
export function sobranteArrastrado(renglones: RenglonMes[], desde: string | null, mes: string, moneda: Moneda = 'CRC'): number {
  if (!desde || mes <= desde) return 0
  // Mes por mes: lo que sobra pasa al siguiente; si queda en negativo, no se pasa nada.
  let pasa = 0
  for (let m = desde; m < mes; m = moverMes(m, 1)) {
    const neto = renglones
      .filter((r) => r.hecho && r.mes === m && (r.moneda ?? 'CRC') === moneda)
      .reduce((s, r) => s + (r.tipo === 'entrada' || r.tipo === 'cambio' ? r.monto : -r.monto), 0)
    pasa = Math.max(0, redondear(pasa + neto))
  }
  return pasa
}

// Cuántos colones faltan para cubrir lo planeado en colones del mes (marcado o no),
// con lo que ya hay: entradas recibidas, lo que viene del mes anterior y lo cambiado.
export function colonesQueFaltan(renglones: RenglonMes[], arrastreCRC = 0): number {
  const crc = renglones.filter((r) => (r.moneda ?? 'CRC') === 'CRC')
  const planeado = crc.filter((r) => r.tipo !== 'entrada' && r.tipo !== 'cambio').reduce((s, r) => s + r.monto, 0)
  const hay =
    crc.filter((r) => r.tipo === 'entrada' && r.hecho).reduce((s, r) => s + r.monto, 0) +
    crc.filter((r) => r.tipo === 'cambio').reduce((s, r) => s + r.monto, 0) +
    arrastreCRC
  return Math.max(0, redondear(planeado - hay))
}

export type CambioGuardado = RenglonMes & { cambio_id?: string; creadoEn?: number }

// Colones por dólar del cambio más reciente (para sugerir cuánto cambiar la próxima vez).
export function ultimoTipoDeCambio(cambios: CambioGuardado[]): number | null {
  const pares = new Map<string, CambioGuardado[]>()
  for (const c of cambios) if (c.cambio_id) pares.set(c.cambio_id, [...(pares.get(c.cambio_id) ?? []), c])
  let mejor: { clave: string; tipo: number } | null = null
  for (const par of pares.values()) {
    const usd = par.find((c) => c.moneda === 'USD')
    const crc = par.find((c) => (c.moneda ?? 'CRC') === 'CRC')
    if (!usd || !crc || usd.monto === 0) continue
    const clave = `${par[0].mes}-${String(par[0].creadoEn ?? 0).padStart(15, '0')}`
    if (!mejor || clave > mejor.clave) mejor = { clave, tipo: Math.abs(crc.monto / usd.monto) }
  }
  return mejor ? redondear(mejor.tipo) : null
}

// Dólares a cambiar para recibir esos colones, redondeado hacia arriba al centavo.
export function dolaresParaCambiar(colones: number, tipo: number): number {
  if (colones <= 0 || tipo <= 0) return 0
  return Math.ceil((colones / tipo) * 100) / 100
}

// Lo que llega al cambiar: dólares × tipo, o colones ÷ tipo (el tipo siempre es colones por dólar).
export function convertir(monto: number, de: Moneda, tipo: number): number {
  if (monto <= 0 || tipo <= 0) return 0
  return redondear(de === 'USD' ? monto * tipo : monto / tipo)
}

// Las quincenas de un mes: la "30" se paga con lo del 30 del mes anterior y la "15" el 15 del mes.
// Ej.: noviembre → 30 oct y 15 nov. En un mes corto, el 30 cae el último día.
export function fechaQuincena(mes: string, dia: number): Date {
  const [a, m] = mes.split('-').map(Number)
  if (dia <= 15) return new Date(a, m - 1, dia)
  const ultimo = new Date(a, m - 1, 0).getDate()
  return new Date(a, m - 2, Math.min(dia, ultimo))
}

// "30 oct", "15 nov".
export function textoFecha(f: Date): string {
  return `${f.getDate()} ${MESES[f.getMonth()].slice(0, 3)}`
}

// Sobres que cuentan como ahorro: los que dicen "ahorro" en el nombre.
export const esAhorro = (nombre: string) => /ahorro/i.test(nombre)

// Total de los ahorros en una sola moneda con el tipo de ARi del momento:
// en colones, los dólares a lo que ARi compra; en dólares, los colones a lo que ARi vende.
export function totalAhorros(sobres: { nombre: string; monto: number; moneda?: Moneda }[], compra: number, venta: number) {
  const t = sumarPorMoneda(sobres.filter((s) => esAhorro(s.nombre)))
  return {
    ...t,
    enColones: compra > 0 ? redondear(t.CRC + t.USD * compra) : null,
    enDolares: venta > 0 ? redondear(t.USD + t.CRC / venta) : null,
  }
}

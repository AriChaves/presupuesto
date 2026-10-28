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

export type Vencimiento = { nombre: string; monto: number; dia: number; detalle?: string }
export type ProximoPago = Vencimiento & { fecha: Date; dias: number; estado: string }

// Ordena lo pendiente del mes por fecha y le pone "Vencido", "Hoy", "Mañana" o "En N días".
export function proximosPagos(items: Vencimiento[], hoy: Date): ProximoPago[] {
  const h = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const ultimo = new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate()
  return items
    .map((it) => {
      const fecha = new Date(h.getFullYear(), h.getMonth(), Math.min(it.dia, ultimo))
      const dias = Math.round((fecha.getTime() - h.getTime()) / 86400000)
      const estado =
        dias < 0 ? `Vencido · hace ${-dias} ${-dias === 1 ? 'día' : 'días'}` : dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `En ${dias} días`
      return { ...it, fecha, dias, estado }
    })
    .sort((a, b) => a.dias - b.dias)
}

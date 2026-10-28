import { describe, expect, it } from 'vitest'
import { colones, dividir, liquidar, moverMes, nombreMes, proximosPagos, saldosNetos, sobranteArrastrado } from './dinero'

describe('colones', () => {
  it('formatea con separador de miles', () => {
    expect(colones(30273.91)).toBe('₡30,274')
    expect(colones(-2500)).toBe('−₡2,500')
  })
})

describe('meses', () => {
  it('mueve entre años', () => {
    expect(moverMes('2026-01', -1)).toBe('2025-12')
    expect(moverMes('2026-12', 1)).toBe('2027-01')
    expect(nombreMes('2026-11')).toBe('Noviembre 2026')
  })
})

describe('dividir', () => {
  it('mitad y mitad reparte el sobrante', () => {
    const p = dividir(8901, 'mitad', ['ari', 'fabi'], 'ari')
    expect(p).toEqual([
      { user_id: 'ari', monto: 4450.5 },
      { user_id: 'fabi', monto: 4450.5 },
    ])
    const t = dividir(100, 'mitad', ['a', 'b', 'c'], 'a')
    expect(t.reduce((s, x) => s + x.monto, 0)).toBeCloseTo(100)
  })
  it('solo mío deja todo a quien pagó', () => {
    expect(dividir(5000, 'solo', ['ari', 'fabi'], 'fabi')).toEqual([{ user_id: 'fabi', monto: 5000 }])
  })
  it('por partes usa los montos escritos', () => {
    expect(dividir(7481, 'partes', ['a', 'b', 'c'], 'a', { a: 1247, b: 6234 })).toEqual([
      { user_id: 'a', monto: 1247 },
      { user_id: 'b', monto: 6234 },
    ])
  })
})

describe('saldos', () => {
  it('reproduce agosto del Excel: Fabi pagó todo, Ari ya abonó 1,248.5', () => {
    const gastos = [{ pagado_por: 'fabi', monto: 63044.82, partes: dividir(63044.82, 'mitad', ['ari', 'fabi'], 'fabi') }]
    const neto = saldosNetos(gastos, [{ de: 'ari', a: 'fabi', monto: 1248.5 }])
    expect(neto.ari).toBeCloseTo(-30273.91)
    expect(neto.fabi).toBeCloseTo(30273.91)
    const t = liquidar(neto)
    expect(t).toHaveLength(1)
    expect(t[0].de).toBe('ari')
    expect(t[0].a).toBe('fabi')
    expect(t[0].monto).toBeCloseTo(30273.91)
  })
  it('sin deudas no hay transferencias', () => {
    expect(liquidar(saldosNetos([], []))).toEqual([])
  })
})

describe('próximos pagos', () => {
  it('ordena y etiqueta según hoy', () => {
    const hoy = new Date(2026, 10, 27)
    const r = proximosPagos(
      [
        { nombre: 'Ahorro', monto: 120000, dia: 30 },
        { nombre: 'GYM', monto: 32000, dia: 25 },
        { nombre: 'Préstamo', monto: 10000, dia: 28 },
        { nombre: 'Luz', monto: 10000, dia: 27 },
      ],
      hoy,
    )
    expect(r.map((x) => `${x.nombre}:${x.estado}`)).toEqual([
      'GYM:Vencido · hace 2 días',
      'Luz:Hoy',
      'Préstamo:Mañana',
      'Ahorro:En 3 días',
    ])
  })
  it('el día 31 cae en el último día de un mes corto', () => {
    const r = proximosPagos([{ nombre: 'X', monto: 1, dia: 31 }], new Date(2026, 1, 10))
    expect(r[0].fecha.getDate()).toBe(28)
  })
})

describe('sobrante que pasa al mes siguiente', () => {
  const r = (mes: string, tipo: string, monto: number, hecho = true) => ({ mes, tipo, monto, hecho })
  const datos = [
    r('2026-10', 'entrada', 152600), // antes de empezar: no cuenta
    r('2026-11', 'entrada', 157691.29),
    r('2026-11', 'entrada', 152600, false), // no recibido: no cuenta
    r('2026-11', 'fijo', 48469.11),
    r('2026-11', 'extra', 60000),
    r('2026-11', 'transporte', 40321.44),
    r('2026-11', 'fijo', 120000, false), // no pagado: no cuenta
    r('2026-12', 'entrada', 150000),
    r('2026-12', 'fijo', 200000),
  ]
  it('noviembre empieza en cero', () => {
    expect(sobranteArrastrado(datos, '2026-11', '2026-11')).toBe(0)
  })
  it('diciembre recibe el sobrante de noviembre (como el Excel: 8,900.74)', () => {
    expect(sobranteArrastrado(datos, '2026-11', '2026-12')).toBeCloseTo(8900.74)
  })
  it('enero arrastra lo de noviembre y diciembre, aunque diciembre quede en negativo', () => {
    expect(sobranteArrastrado(datos, '2026-11', '2027-01')).toBeCloseTo(8900.74 + 150000 - 200000)
  })
  it('apagado no arrastra nada', () => {
    expect(sobranteArrastrado(datos, null, '2026-12')).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { colones, colonesQueFaltan, convertir, dinero, totalAhorros, fechaQuincena, textoFecha, dividir, dolaresParaCambiar, ultimoTipoDeCambio, liquidar, moverMes, nombreMes, proximosPagos, resumenMes, saldosNetos, sobranteArrastrado, sumarPorMoneda, textoMonedas } from './dinero'

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
  it('si diciembre queda en negativo, a enero no pasa nada', () => {
    expect(sobranteArrastrado(datos, '2026-11', '2027-01')).toBe(0)
  })
  it('un mes negativo no le quita al que viene después', () => {
    const d2 = [
      r('2026-11', 'entrada', 100),
      r('2026-11', 'fijo', 140), // noviembre queda en −40: no pasa
      r('2026-12', 'entrada', 300),
      r('2026-12', 'fijo', 100), // diciembre sobra 200
    ]
    expect(sobranteArrastrado(d2, '2026-11', '2026-12')).toBe(0)
    expect(sobranteArrastrado(d2, '2026-11', '2027-01')).toBe(200)
  })
  it('apagado no arrastra nada', () => {
    expect(sobranteArrastrado(datos, null, '2026-12')).toBe(0)
  })
})

describe('dos monedas', () => {
  it('formatea dólares con centavos', () => {
    expect(dinero(1234.5, 'USD')).toBe('$1,234.50')
    expect(dinero(-20, 'USD')).toBe('−$20.00')
    expect(dinero(8900.74)).toBe('₡8,901')
  })
  it('suma cada moneda por aparte y sin moneda cuenta como colones', () => {
    const t = sumarPorMoneda([{ monto: 1000 }, { monto: 50, moneda: 'USD' }, { monto: 500, moneda: 'CRC' }, { monto: 25.5, moneda: 'USD' }])
    expect(t).toEqual({ CRC: 1500, USD: 75.5 })
    expect(textoMonedas(t)).toBe('₡1,500 · $75.50')
    expect(textoMonedas({ CRC: 1500, USD: 0 })).toBe('₡1,500')
    expect(textoMonedas({ CRC: 0, USD: 10 })).toBe('$10.00')
  })
  it('el sobrante en dólares pasa por aparte', () => {
    const datos = [
      { mes: '2026-11', tipo: 'entrada', monto: 100000, hecho: true },
      { mes: '2026-11', tipo: 'entrada', monto: 200, hecho: true, moneda: 'USD' as const },
      { mes: '2026-11', tipo: 'extra', monto: 50, hecho: true, moneda: 'USD' as const },
    ]
    expect(sobranteArrastrado(datos, '2026-11', '2026-12')).toBe(100000)
    expect(sobranteArrastrado(datos, '2026-11', '2026-12', 'USD')).toBe(150)
  })
})

describe('cambio de dólares a colones', () => {
  // Gana $1,000, cambia $300 y recibe ₡156,000, paga ₡100,000 y Spotify $5.99.
  const mes = '2026-12'
  const datos = [
    { mes, tipo: 'entrada', monto: 1000, hecho: true, moneda: 'USD' as const },
    { mes, tipo: 'cambio', monto: -300, hecho: true, moneda: 'USD' as const },
    { mes, tipo: 'cambio', monto: 156000, hecho: true, moneda: 'CRC' as const },
    { mes, tipo: 'fijo', monto: 100000, hecho: true, moneda: 'CRC' as const },
    { mes, tipo: 'fijo', monto: 5.99, hecho: true, moneda: 'USD' as const },
  ]
  it('el cambio no cuenta como gasto ni como entrada, pero sí en el sobrante', () => {
    expect(resumenMes(datos, 'USD')).toEqual({ entradas: 1000, cambio: -300, gasto: 5.99, sobrante: 694.01 })
    expect(resumenMes(datos, 'CRC')).toEqual({ entradas: 0, cambio: 156000, gasto: 100000, sobrante: 56000 })
  })
  it('el sobrante de cada moneda pasa al mes siguiente con el cambio incluido', () => {
    expect(sobranteArrastrado(datos, mes, '2027-01', 'USD')).toBeCloseTo(694.01)
    expect(sobranteArrastrado(datos, mes, '2027-01', 'CRC')).toBe(56000)
  })
  it('suma lo arrastrado a las entradas', () => {
    expect(resumenMes(datos, 'CRC', 8900.74).sobrante).toBeCloseTo(64900.74)
  })
})

describe('cuántos dólares cambiar', () => {
  const mes = '2026-11'
  it('faltan los colones de lo planeado, aunque no esté pagado todavía', () => {
    const datos = [
      { mes, tipo: 'entrada', monto: 1000, hecho: true, moneda: 'USD' as const }, // en dólares: no cuenta
      { mes, tipo: 'fijo', monto: 33975.29, hecho: false },
      { mes, tipo: 'extra', monto: 43872.91, hecho: false },
      { mes, tipo: 'fijo', monto: 13.55, hecho: false, moneda: 'USD' as const }, // Spotify en dólares: no cuenta
      { mes, tipo: 'cambio', monto: 50000, hecho: true }, // ya cambió ₡50,000
    ]
    expect(colonesQueFaltan(datos)).toBeCloseTo(27848.2)
    expect(colonesQueFaltan(datos, 30000)).toBe(0)
  })
  it('usa el tipo del cambio más reciente', () => {
    const c = (cambio_id: string, mes: string, usd: number, crc: number, creadoEn = 0) => [
      { mes, tipo: 'cambio', monto: -usd, hecho: true, moneda: 'USD' as const, cambio_id, creadoEn },
      { mes, tipo: 'cambio', monto: crc, hecho: true, moneda: 'CRC' as const, cambio_id, creadoEn },
    ]
    expect(ultimoTipoDeCambio([])).toBeNull()
    expect(ultimoTipoDeCambio([...c('a', '2026-10', 300, 156000), ...c('b', '2026-11', 100, 51500, 5), ...c('c', '2026-11', 100, 51000, 2)])).toBe(515)
  })
  it('redondea los dólares hacia arriba', () => {
    expect(dolaresParaCambiar(27848.2, 515)).toBe(54.08)
    expect(dolaresParaCambiar(0, 515)).toBe(0)
  })
})

describe('convertir con el tipo de ARi', () => {
  it('dólares a colones y al revés', () => {
    expect(convertir(300, 'USD', 515.5)).toBe(154650)
    expect(convertir(51550, 'CRC', 515.5)).toBe(100)
    expect(convertir(300, 'USD', 0)).toBe(0)
  })
})

describe('quincenas', () => {
  it('noviembre se paga el 30 de octubre y el 15 de noviembre', () => {
    expect(textoFecha(fechaQuincena('2026-11', 30))).toBe('30 oct')
    expect(textoFecha(fechaQuincena('2026-11', 15))).toBe('15 nov')
  })
  it('enero toma el 30 de diciembre del año anterior', () => {
    expect(fechaQuincena('2027-01', 30)).toEqual(new Date(2026, 11, 30))
  })
  it('marzo toma el último día de febrero', () => {
    expect(textoFecha(fechaQuincena('2027-03', 30))).toBe('28 feb')
  })
  it('próximos pagos usa la fecha de la quincena', () => {
    const hoy = new Date(2026, 9, 28)
    const r = proximosPagos([{ nombre: 'Cel', monto: 1, dia: 30, fecha: fechaQuincena('2026-11', 30) }], hoy)
    expect(r[0].estado).toBe('En 2 días')
  })
})

describe('total de ahorros', () => {
  const sobres = [
    { nombre: 'Ahorro', monto: 541.2, moneda: 'USD' as const },
    { nombre: 'Ahorro BN', monto: 100000, moneda: 'CRC' as const },
    { nombre: 'GYM', monto: 32000, moneda: 'CRC' as const }, // no es ahorro
  ]
  it('junta colones y dólares con la compra y la venta de ARi', () => {
    const t = totalAhorros(sobres, 505, 515)
    expect(t.CRC).toBe(100000)
    expect(t.USD).toBe(541.2)
    expect(t.enColones).toBe(373306) // 100,000 + 541.20 × 505
    expect(t.enDolares).toBeCloseTo(735.37) // 541.20 + 100,000 ÷ 515
  })
  it('sin tipo de cambio no inventa el total', () => {
    expect(totalAhorros(sobres, 0, 0).enColones).toBeNull()
  })
})

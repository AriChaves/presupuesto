import { useState, type FormEvent } from 'react'
import { supabase, revisar } from '../supabase'
import { Cargando, MensajeError, leerMonto, useCarga, useSesion } from '../comun'
import { colones, mesDe, proximosPagos, type ProximoPago, type Vencimiento } from '../dinero'
import type { Cuenta, Prestamo, Renglon } from '../tipos'

// Gastos fijos sin pagar este mes + cuotas de préstamos que debo.
export async function cargarVencimientos(): Promise<ProximoPago[]> {
  const [r, p] = await Promise.all([
    supabase.from('renglones').select('nombre, monto, dia_vence, hecho').eq('mes', mesDe(new Date())).eq('hecho', false).not('dia_vence', 'is', null),
    supabase.from('prestamos').select('*').eq('direccion', 'debo').not('dia_pago', 'is', null),
  ])
  const items: Vencimiento[] = [
    ...(revisar(r) as Pick<Renglon, 'nombre' | 'monto' | 'dia_vence'>[]).map((x) => ({ nombre: x.nombre, monto: Number(x.monto), dia: x.dia_vence! })),
    ...(revisar(p) as Prestamo[])
      .filter((x) => x.cuotas_pagadas < x.cuotas_total)
      .map((x) => ({ nombre: `Cuota ${x.nombre}`, monto: Number(x.cuota), dia: x.dia_pago!, detalle: 'Préstamo' })),
  ]
  return proximosPagos(items, new Date())
}

export function ListaPagos({ pagos, max }: { pagos: ProximoPago[]; max?: number }) {
  const lista = max ? pagos.slice(0, max) : pagos
  if (lista.length === 0) return <div className="vacio">Nada pendiente este mes.</div>
  return (
    <>
      {lista.map((p, i) => (
        <div className="fila" key={i}>
          <div style={{ width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <strong className={`num ${p.dias < 0 ? 'debe' : ''}`} style={{ fontSize: 18 }}>{p.fecha.getDate()}</strong>
          </div>
          <div className="crece">
            <span>{p.nombre}</span>
            <span className={`peq ${p.dias < 0 ? 'debe' : 'suave'}`}>{p.estado}</span>
          </div>
          <span className="num" style={{ fontWeight: 500 }}>{colones(p.monto)}</span>
        </div>
      ))}
    </>
  )
}

const AVISO_KEY = 'avisos-activados'

export function Pagos() {
  const { yo } = useSesion()
  const [error, setError] = useState<string | null>(null)
  const [dir, setDir] = useState<'debo' | 'me_deben'>('debo')
  const carga = useCarga(async () => {
    const [v, p, c] = await Promise.all([
      cargarVencimientos(),
      supabase.from('prestamos').select('*').order('nombre'),
      supabase.from('cuentas').select('*').order('orden'),
    ])
    return { vencimientos: v, prestamos: revisar(p) as Prestamo[], cuentas: revisar(c) as Cuenta[] }
  }, [])
  const [avisos, setAvisos] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted' && localStorage.getItem(AVISO_KEY) === '1')

  async function activarAvisos() {
    if (typeof Notification === 'undefined') return setError('Este navegador no permite avisos. En iPhone, primero agregue la app a la pantalla de inicio.')
    const r = await Notification.requestPermission()
    if (r === 'granted') {
      localStorage.setItem(AVISO_KEY, '1')
      setAvisos(true)
    } else setError('El celular no dio permiso para los avisos.')
  }

  async function hacer(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    carga.recargar()
  }

  const d = carga.datos
  return (
    <div className="contenido">
      <div className="cabeza">
        <div className="crece">
          <h1>Préstamos y pagos</h1>
          <span className="sub">Hola, {yo.nombre}</span>
        </div>
      </div>
      <MensajeError texto={error ?? carga.error} />
      {!d ? (
        <Cargando />
      ) : (
        <>
          <div className="seccion">
            <span className="lbl">Próximos pagos de este mes</span>
            <div className="card">
              <ListaPagos pagos={d.vencimientos} />
            </div>
            <span className="suave peq">Salen de los gastos fijos con día de vencimiento que no ha marcado como pagados, y de las cuotas de sus préstamos.</span>
          </div>

          <div className="seccion">
            <span className="lbl">Préstamos</span>
            <div className="segs">
              <button className={`seg ${dir === 'debo' ? 'on' : ''}`} onClick={() => setDir('debo')}>Yo debo</button>
              <button className={`seg ${dir === 'me_deben' ? 'on' : ''}`} onClick={() => setDir('me_deben')}>Me deben</button>
            </div>
            {d.prestamos
              .filter((p) => p.direccion === dir)
              .map((p) => (
                <TarjetaPrestamo key={p.id} p={p} cuentas={d.cuentas} hacer={hacer} />
              ))}
            <NuevoPrestamo dir={dir} hacer={hacer} />
          </div>

          <div className="seccion">
            <span className="lbl">Recordatorios</span>
            <div className="card pad">
              {avisos ? (
                <span>Avisos activados: al abrir la app le avisamos lo vencido, lo de hoy y lo de mañana.</span>
              ) : (
                <>
                  <span>Reciba un aviso con lo que vence hoy y mañana.</span>
                  <button className="btn verde" onClick={activarAvisos}>Activar avisos</button>
                </>
              )}
              <span className="suave peq">En esta primera versión el aviso sale al abrir la app. Los avisos con la app cerrada vienen en la próxima versión.</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

type Hacer = (fn: () => PromiseLike<{ error: { message: string } | null }>) => Promise<void>

function TarjetaPrestamo({ p, cuentas, hacer }: { p: Prestamo; cuentas: Cuenta[]; hacer: Hacer }) {
  const cuenta = cuentas.find((c) => c.id === p.cuenta_id)
  const pagado = Number(p.cuota) * p.cuotas_pagadas
  const falta = Math.max(0, Number(p.monto_total) - pagado)
  const avance = p.cuotas_total ? Math.min(100, (p.cuotas_pagadas / p.cuotas_total) * 100) : 0
  return (
    <div className="card pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div className="crece" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <strong style={{ fontWeight: 500, fontSize: 16 }}>{p.nombre}</strong>
          <span className="suave peq">
            {cuenta ? `Se paga de: ${cuenta.nombre}` : 'Sin cuenta'}
            {p.dia_pago ? ` · día ${p.dia_pago}` : ''}
          </span>
        </div>
        <strong className="num">{colones(Number(p.cuota))}<span className="suave peq" style={{ fontWeight: 400 }}>/mes</span></strong>
      </div>
      <div className="progreso"><div style={{ width: `${avance}%` }} /></div>
      <div className="num suave peq" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Cuota {p.cuotas_pagadas} de {p.cuotas_total}</span>
        <span>Falta {colones(falta)}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn chico"
          disabled={p.cuotas_pagadas >= p.cuotas_total}
          onClick={() => hacer(() => supabase.from('prestamos').update({ cuotas_pagadas: p.cuotas_pagadas + 1 }).eq('id', p.id))}
        >
          {p.direccion === 'debo' ? 'Pagué esta cuota' : 'Me pagó esta cuota'}
        </button>
        <select
          className="inp chico"
          style={{ flex: '0 1 150px' }}
          value={p.cuenta_id ?? ''}
          aria-label="Cuenta"
          onChange={(e) => hacer(() => supabase.from('prestamos').update({ cuenta_id: e.target.value || null }).eq('id', p.id))}
        >
          <option value="">Sin cuenta</option>
          {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button
          className="btn peligro"
          onClick={() => confirm(`¿Borrar "${p.nombre}"?`) && hacer(() => supabase.from('prestamos').delete().eq('id', p.id))}
        >
          Borrar
        </button>
      </div>
    </div>
  )
}

function NuevoPrestamo({ dir, hacer }: { dir: 'debo' | 'me_deben'; hacer: Hacer }) {
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ nombre: '', total: '', cuota: '', cuotas: '', dia: '' })
  const cambiar = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!f.nombre.trim()) return
    await hacer(() =>
      supabase.from('prestamos').insert({
        nombre: f.nombre.trim(),
        direccion: dir,
        monto_total: leerMonto(f.total),
        cuota: leerMonto(f.cuota),
        cuotas_total: Math.max(1, Number(f.cuotas) || 1),
        dia_pago: f.dia ? Number(f.dia) : null,
      }),
    )
    setF({ nombre: '', total: '', cuota: '', cuotas: '', dia: '' })
    setAbierto(false)
  }

  if (!abierto) {
    return (
      <div className="card">
        <button className="agregar" style={{ borderTop: 'none', borderRadius: 16 }} onClick={() => setAbierto(true)}>
          + Agregar préstamo
        </button>
      </div>
    )
  }
  return (
    <form className="card pad" onSubmit={guardar}>
      <label className="campo"><span>{dir === 'debo' ? '¿Con quién?' : '¿Quién le debe?'}</span><input className="inp" value={f.nombre} onChange={cambiar('nombre')} placeholder={dir === 'debo' ? 'Ej.: Préstamo BN' : 'Ej.: Jes'} /></label>
      <label className="campo"><span>Monto total</span><input className="inp num" inputMode="decimal" value={f.total} onChange={cambiar('total')} /></label>
      <div style={{ display: 'flex', gap: 8 }}>
        <label className="campo" style={{ flex: 1 }}><span>Cuota</span><input className="inp num" inputMode="decimal" value={f.cuota} onChange={cambiar('cuota')} /></label>
        <label className="campo" style={{ flex: 1 }}><span>N.º cuotas</span><input className="inp num" inputMode="numeric" value={f.cuotas} onChange={cambiar('cuotas')} /></label>
        <label className="campo" style={{ flex: 1 }}><span>Día de pago</span><input className="inp num" inputMode="numeric" value={f.dia} onChange={cambiar('dia')} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn verde" style={{ flex: 1 }}>Guardar</button>
        <button type="button" className="btn borde" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>
  )
}

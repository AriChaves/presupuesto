import { useState, type FormEvent } from 'react'
import { agregar as agregarDoc, borrar, cambiar, guardarDesdeMes, guardarTipoARi, increment, leerDesdeMes, leerTipoARi, listar, where, type TipoARi } from '../datos'
import { Atras, BotonBorrar, Cargando, MensajeError, PedirMonto, SelectMoneda, SelectQuincena, leerMonto, useCarga, useHacer } from '../comun'
import { SIMBOLO, dinero, esAhorro, mesDe, nombreMes, sumarPorMoneda, textoMonedas, totalAhorros, ultimoTipoDeCambio, type Moneda } from '../dinero'
import type { Cuenta, Plantilla, Renglon, Sobre } from '../tipos'

const TIPOS_CUENTA = ['tarjeta', 'cuenta de ahorro', 'efectivo', 'otra']

type Hacer = (fn: () => Promise<unknown>) => Promise<void>

export function Cuentas() {
  const [error, setError] = useState<string | null>(null)
  const carga = useCarga(async () => {
    const [cuentas, sobres, plantillas, desdeMes, tipoARi, cambios] = await Promise.all([
      listar<Cuenta>('cuentas'),
      listar<Sobre>('sobres'),
      listar<Plantilla>('plantillas'),
      leerDesdeMes(),
      leerTipoARi(),
      listar<Renglon>('renglones', where('tipo', '==', 'cambio')),
    ])
    // Si nunca escribió el tipo aquí, arranca con el del último cambio que anotó.
    const ultimo = ultimoTipoDeCambio(cambios)
    return { cuentas, sobres, plantillas, desdeMes, tipoARi: tipoARi ?? (ultimo ? { compra: ultimo, venta: ultimo } : null) }
  }, [])
  const hacer: Hacer = useHacer(setError, carga.recargar)

  const d = carga.datos
  return (
    <div className="contenido">
      <div className="cabeza">
        <Atras a={{ p: 'presupuesto' }} />
        <div className="crece">
          <h1>Cuentas y plantillas</h1>
          <span className="sub">Todo se puede cambiar, agregar o borrar</span>
        </div>
      </div>
      <MensajeError texto={error ?? carga.error} />
      {!d ? (
        <Cargando />
      ) : (
        <>
          <Ahorros sobres={d.sobres} inicial={d.tipoARi} hacer={hacer} />
          <SobranteSeccion desdeMes={d.desdeMes} hacer={hacer} />
          <CuentasSeccion cuentas={d.cuentas} hacer={hacer} />
          <SobresSeccion sobres={d.sobres} cuentas={d.cuentas} hacer={hacer} />
          <div className="aviso">Los gastos fijos de cada mes se editan en Mi presupuesto.</div>
        </>
      )}
    </div>
  )
}

function Borrar({ etiqueta, alBorrar }: { etiqueta: string; alBorrar: () => void }) {
  return <BotonBorrar etiqueta={etiqueta} pregunta={`¿Borrar "${etiqueta}"?`} alBorrar={alBorrar} />
}

function SelectCuenta({ valor, cuentas, alCambiar }: { valor: string | null; cuentas: Cuenta[]; alCambiar: (id: string | null) => void }) {
  return (
    <select className="inp chico" style={{ flex: '0 1 140px' }} value={valor ?? ''} onChange={(e) => alCambiar(e.target.value || null)} aria-label="Cuenta">
      <option value="">Sin cuenta</option>
      {cuentas.map((c) => (
        <option key={c.id} value={c.id}>
          {c.nombre}
        </option>
      ))}
    </select>
  )
}

function CuentasSeccion({ cuentas, hacer }: { cuentas: Cuenta[]; hacer: Hacer }) {
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('tarjeta')
  const [moneda, setMoneda] = useState<Moneda>('CRC')

  async function agregar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    await hacer(() => agregarDoc('cuentas', { nombre: nombre.trim(), tipo, moneda, efectivo_suelto: 0, orden: cuentas.length }))
    setNombre('')
  }

  return (
    <div className="seccion">
      <span className="lbl">Mis cuentas</span>
      <div className="card">
        {cuentas.map((c) => (
          <div className="fila" key={c.id} style={{ flexWrap: 'wrap' }}>
            <input
              key={c.nombre}
              className="inp chico"
              defaultValue={c.nombre}
              aria-label="Nombre de la cuenta"
              style={{ flex: '1 1 140px' }}
              onBlur={(e) => e.target.value.trim() && e.target.value !== c.nombre && hacer(() => cambiar('cuentas', c.id, { nombre: e.target.value.trim() }))}
            />
            <select className="inp chico" style={{ flex: '0 1 130px' }} value={c.tipo} aria-label="Tipo" onChange={(e) => hacer(() => cambiar('cuentas', c.id, { tipo: e.target.value }))}>
              {TIPOS_CUENTA.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <SelectMoneda valor={c.moneda} alCambiar={(m) => hacer(() => cambiar('cuentas', c.id, { moneda: m }))} />
            <label className="suave peq" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Plata suelta {SIMBOLO[c.moneda ?? 'CRC']}
              <input
                key={c.efectivo_suelto}
                className="inp chico num"
                style={{ width: 100 }}
                inputMode="decimal"
                defaultValue={c.efectivo_suelto ? c.efectivo_suelto.toLocaleString('en-US') : ''}
                onBlur={(e) => {
                  const n = leerMonto(e.target.value)
                  if (n !== (c.efectivo_suelto ?? 0)) hacer(() => cambiar('cuentas', c.id, { efectivo_suelto: n }))
                }}
              />
            </label>
            <Borrar etiqueta={c.nombre} alBorrar={() => hacer(() => borrar('cuentas', c.id))} />
          </div>
        ))}
        <form className="form-fila" onSubmit={agregar} style={cuentas.length ? undefined : { borderTop: 'none' }}>
          <input className="inp chico" placeholder="Ej.: Tarjeta BN" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre de la cuenta nueva" />
          <select className="inp chico" style={{ flex: '0 1 130px' }} value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo de la cuenta nueva">
            {TIPOS_CUENTA.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <SelectMoneda valor={moneda} alCambiar={setMoneda} />
          <button className="btn chico">Agregar</button>
        </form>
      </div>
    </div>
  )
}

function SobresSeccion({ sobres, cuentas, hacer }: { sobres: Sobre[]; cuentas: Cuenta[]; hacer: Hacer }) {
  const [nombre, setNombre] = useState('')
  const [cuenta, setCuenta] = useState<string | null>(null)
  const [moneda, setMoneda] = useState<Moneda>('CRC')
  const total = textoMonedas(sumarPorMoneda(sobres))

  // Al escoger la cuenta, el sobre toma su moneda (se puede cambiar).
  function escogerCuenta(id: string | null) {
    setCuenta(id)
    const c = cuentas.find((x) => x.id === id)
    if (c) setMoneda(c.moneda ?? 'CRC')
  }

  async function agregar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    await hacer(() => agregarDoc('sobres', { nombre: nombre.trim(), monto: 0, moneda, cuenta_id: cuenta, orden: sobres.length }))
    setNombre('')
  }

  return (
    <div className="seccion">
      <div className="seccion-titulo">
        <span className="lbl">Sobres · en qué cuenta está cada uno</span>
        <span className="suave peq num">{total}</span>
      </div>
      <div className="card">
        {sobres.map((s) => (
          <SobreFila key={s.id} s={s} cuentas={cuentas} hacer={hacer} />
        ))}
        <form className="form-fila" onSubmit={agregar} style={sobres.length ? undefined : { borderTop: 'none' }}>
          <input className="inp chico" placeholder="Nuevo sobre" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del sobre nuevo" />
          <SelectCuenta valor={cuenta} cuentas={cuentas} alCambiar={escogerCuenta} />
          <SelectMoneda valor={moneda} alCambiar={setMoneda} />
          <button className="btn chico">Agregar</button>
        </form>
      </div>
    </div>
  )
}

export function PlantillasSeccion(props: { tipo: 'entrada' | 'fijo'; titulo: string; plantillas: Plantilla[]; cuentas: Cuenta[]; hacer: Hacer }) {
  const { tipo, titulo, cuentas, hacer } = props
  const lista = props.plantillas.filter((p) => p.tipo === tipo)
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [dia, setDia] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('CRC')

  async function agregar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    await hacer(() =>
      agregarDoc('plantillas', { tipo, nombre: nombre.trim(), monto: leerMonto(monto), moneda, dia_vence: dia ? Number(dia) : null, cuenta_id: null, orden: props.plantillas.length }),
    )
    setNombre('')
    setMonto('')
    setDia('')
  }

  return (
    <div className="seccion">
      <span className="lbl">{titulo}</span>
      <div className="card">
        {lista.map((p) => (
          <div className="fila" key={p.id} style={{ flexWrap: 'wrap' }}>
            <div className="crece">
              <span>{p.nombre}</span>
              <span className="suave peq num">
                {dinero(p.monto, p.moneda)}
              </span>
            </div>
            {tipo === 'fijo' && <SelectQuincena dia={p.dia_vence} etiqueta={p.nombre} alCambiar={(dia) => hacer(() => cambiar('plantillas', p.id, { dia_vence: dia }))} />}
            {tipo === 'fijo' && (
              <SelectCuenta valor={p.cuenta_id} cuentas={cuentas} alCambiar={(id) => hacer(() => cambiar('plantillas', p.id, { cuenta_id: id }))} />
            )}
            <Borrar etiqueta={p.nombre} alBorrar={() => hacer(() => borrar('plantillas', p.id))} />
          </div>
        ))}
        <form className="form-fila" onSubmit={agregar} style={lista.length ? undefined : { borderTop: 'none' }}>
          <input className="inp chico" placeholder={tipo === 'entrada' ? 'Ej.: Salario 1.ª quincena' : 'Ej.: Cel'} value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" />
          <SelectMoneda valor={moneda} alCambiar={setMoneda} />
          <input className="inp chico num" placeholder={SIMBOLO[moneda]} value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" style={{ flex: '0 1 100px' }} aria-label="Monto" />
          {tipo === 'fijo' && (
            <input className="inp chico" placeholder="Día" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" style={{ flex: '0 1 64px' }} aria-label="Día que vence" />
          )}
          <button className="btn chico">Agregar</button>
        </form>
      </div>
    </div>
  )
}

function SobranteSeccion({ desdeMes, hacer }: { desdeMes: string | null; hacer: Hacer }) {
  return (
    <div className="seccion">
      <span className="lbl">Lo que sobra cada mes</span>
      <div className="card pad">
        <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>Pasarlo como entrada al mes siguiente</span>
            <span className="suave peq">
              {desdeMes ? `Desde ${nombreMes(desdeMes).toLowerCase()}. Solo pasa lo que sobra; si un mes queda en negativo, el siguiente empieza en cero.` : 'Apagado: cada mes empieza de cero.'}
            </span>
          </span>
          <input
            type="checkbox"
            checked={Boolean(desdeMes)}
            onChange={(e) => hacer(() => guardarDesdeMes(e.target.checked ? mesDe(new Date()) : null))}
            style={{ width: 22, height: 22, accentColor: 'var(--verde)' }}
          />
        </label>
        {desdeMes && (
          <label className="campo">
            <span>Empezar a contar desde</span>
            <input className="inp" type="month" value={desdeMes} onChange={(e) => e.target.value && hacer(() => guardarDesdeMes(e.target.value))} />
          </label>
        )}
      </div>
    </div>
  )
}

function SobreFila({ s, cuentas, hacer }: { s: Sobre; cuentas: Cuenta[]; hacer: Hacer }) {
  const [modo, setModo] = useState<'poner' | 'sacar' | null>(null)
  return (
    <div className="fila" style={{ flexWrap: 'wrap' }}>
      <input
        key={s.nombre}
        className="inp chico"
        defaultValue={s.nombre}
        aria-label="Nombre del sobre"
        style={{ flex: '1 1 120px' }}
        onBlur={(e) => e.target.value.trim() && e.target.value !== s.nombre && hacer(() => cambiar('sobres', s.id, { nombre: e.target.value.trim() }))}
      />
      <strong className={`num ${s.monto < 0 ? 'debe' : ''}`} style={{ minWidth: 90, textAlign: 'right', fontSize: 17 }}>
        {dinero(s.monto, s.moneda)}
      </strong>
      {modo ? (
        <PedirMonto
          etiqueta={modo === 'poner' ? `Cuánto poner en ${s.nombre}` : `Cuánto sacar de ${s.nombre}`}
          boton={modo === 'poner' ? 'Poner' : 'Sacar'}
          alCancelar={() => setModo(null)}
          alListo={(n) => {
            setModo(null)
            hacer(() => cambiar('sobres', s.id, { monto: increment(modo === 'poner' ? n : -n) }))
          }}
        />
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          <button className="btn chico verde" onClick={() => setModo('poner')}>+ Poner</button>
          <button className="btn chico borde" onClick={() => setModo('sacar')}>− Sacar</button>
          <SelectCuenta valor={s.cuenta_id} cuentas={cuentas} alCambiar={(id) => hacer(() => cambiar('sobres', s.id, { cuenta_id: id }))} />
          <SelectMoneda valor={s.moneda} alCambiar={(m) => hacer(() => cambiar('sobres', s.id, { moneda: m }))} />
          <span style={{ flex: 1 }} />
          <Borrar etiqueta={s.nombre} alBorrar={() => hacer(() => borrar('sobres', s.id))} />
        </div>
      )}
    </div>
  )
}

// Total de los sobres de ahorro, en colones y en dólares, con el tipo de ARi del momento.
function Ahorros({ sobres, inicial, hacer }: { sobres: Sobre[]; inicial: TipoARi | null; hacer: Hacer }) {
  const [compra, setCompra] = useState(inicial?.compra ? String(inicial.compra) : '')
  const [venta, setVenta] = useState(inicial?.venta ? String(inicial.venta) : '')
  const tipo = { compra: leerMonto(compra), venta: leerMonto(venta) }
  const t = totalAhorros(sobres, tipo.compra, tipo.venta)
  const ahorros = sobres.filter((s) => esAhorro(s.nombre))
  const guardar = () => {
    if (tipo.compra > 0 && tipo.venta > 0 && (tipo.compra !== inicial?.compra || tipo.venta !== inicial?.venta)) hacer(() => guardarTipoARi(tipo))
  }
  const campo = (etiqueta: string, valor: string, set: (v: string) => void) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px' }}>
      <span className="suave peq">{etiqueta}</span>
      <input className="inp chico num" inputMode="decimal" placeholder="₡ por dólar" value={valor} onChange={(e) => set(e.target.value)} onBlur={guardar} />
    </label>
  )

  return (
    <div className="seccion">
      <span className="lbl">Mis ahorros</span>
      <div className="card pad">
        {ahorros.length === 0 ? (
          <span className="suave">Cree un sobre con "Ahorro" en el nombre y aquí sale el total.</span>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="suave peq">Todo en colones</span>
                <strong className="num" style={{ fontSize: 22, color: 'var(--verde)' }}>{t.enColones !== null ? dinero(t.enColones) : '—'}</strong>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="suave peq">Todo en dólares</span>
                <strong className="num" style={{ fontSize: 22, color: 'var(--verde)' }}>{t.enDolares !== null ? dinero(t.enDolares, 'USD') : '—'}</strong>
              </div>
            </div>
            <span className="suave peq">
              {ahorros.map((s) => `${s.nombre} ${dinero(s.monto, s.moneda)}`).join(' · ')} — tiene {textoMonedas({ CRC: t.CRC, USD: t.USD })}
            </span>
          </>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {campo('ARi le compra el dólar a ₡', compra, setCompra)}
          {campo('ARi le vende el dólar a ₡', venta, setVenta)}
        </div>
        <span className="suave peq">Copie los dos tipos de la app de ARi. En colones se usa la compra; en dólares, la venta.</span>
      </div>
    </div>
  )
}

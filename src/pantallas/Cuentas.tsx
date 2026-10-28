import { useState, type FormEvent } from 'react'
import { agregar as agregarDoc, borrar, cambiar, guardarDesdeMes, leerDesdeMes, listar } from '../datos'
import { Atras, Cargando, Icono, MensajeError, leerMonto, useCarga, useHacer } from '../comun'
import { colones, mesDe, nombreMes } from '../dinero'
import type { Cuenta, Plantilla, Sobre } from '../tipos'

const TIPOS_CUENTA = ['tarjeta', 'cuenta de ahorro', 'efectivo', 'otra']

type Hacer = (fn: () => Promise<unknown>) => Promise<void>

export function Cuentas() {
  const [error, setError] = useState<string | null>(null)
  const carga = useCarga(async () => {
    const [cuentas, sobres, plantillas, desdeMes] = await Promise.all([listar<Cuenta>('cuentas'), listar<Sobre>('sobres'), listar<Plantilla>('plantillas'), leerDesdeMes()])
    return { cuentas, sobres, plantillas, desdeMes }
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
          <SobranteSeccion desdeMes={d.desdeMes} hacer={hacer} />
          <CuentasSeccion cuentas={d.cuentas} hacer={hacer} />
          <SobresSeccion sobres={d.sobres} cuentas={d.cuentas} hacer={hacer} />
          <PlantillasSeccion tipo="entrada" titulo="Entradas de cada mes" plantillas={d.plantillas} cuentas={d.cuentas} hacer={hacer} />
          <PlantillasSeccion tipo="fijo" titulo="Gastos fijos de cada mes" plantillas={d.plantillas} cuentas={d.cuentas} hacer={hacer} />
          <div className="aviso">Las plantillas se usan al llenar un mes nuevo. Cambiarlas no toca los meses que ya existen.</div>
        </>
      )}
    </div>
  )
}

function Borrar({ etiqueta, alBorrar }: { etiqueta: string; alBorrar: () => void }) {
  return (
    <button
      className="btn peligro"
      aria-label={`Borrar ${etiqueta}`}
      onClick={() => {
        if (confirm(`¿Borrar "${etiqueta}"?`)) alBorrar()
      }}
    >
      <Icono n="basura" t={18} />
    </button>
  )
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

  async function agregar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    await hacer(() => agregarDoc('cuentas', { nombre: nombre.trim(), tipo, orden: cuentas.length }))
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
            <label className="suave peq" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Plata suelta
              <input
                key={c.efectivo_suelto}
                className="inp chico num"
                style={{ width: 100 }}
                inputMode="decimal"
                defaultValue={c.efectivo_suelto ? c.efectivo_suelto.toLocaleString('en-US') : ''}
                onBlur={(e) => {
                  const n = leerMonto(e.target.value)
                  if (n !== c.efectivo_suelto) hacer(() => cambiar('cuentas', c.id, { efectivo_suelto: n }))
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
          <button className="btn chico">Agregar</button>
        </form>
      </div>
    </div>
  )
}

function SobresSeccion({ sobres, cuentas, hacer }: { sobres: Sobre[]; cuentas: Cuenta[]; hacer: Hacer }) {
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [cuenta, setCuenta] = useState<string | null>(null)
  const total = sobres.reduce((s, x) => s + x.monto, 0)

  async function agregar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    await hacer(() => agregarDoc('sobres', { nombre: nombre.trim(), monto: leerMonto(monto), cuenta_id: cuenta, orden: sobres.length }))
    setNombre('')
    setMonto('')
  }

  return (
    <div className="seccion">
      <div className="seccion-titulo">
        <span className="lbl">Sobres · en qué cuenta está cada uno</span>
        <span className="suave peq num">{colones(total)}</span>
      </div>
      <div className="card">
        {sobres.map((s) => (
          <div className="fila" key={s.id} style={{ flexWrap: 'wrap' }}>
            <input
              key={s.nombre}
              className="inp chico"
              defaultValue={s.nombre}
              aria-label="Nombre del sobre"
              style={{ flex: '1 1 120px' }}
              onBlur={(e) => e.target.value.trim() && e.target.value !== s.nombre && hacer(() => cambiar('sobres', s.id, { nombre: e.target.value.trim() }))}
            />
            <input
              key={s.monto}
              className="inp chico num"
              style={{ width: 110 }}
              inputMode="decimal"
              aria-label={`Monto de ${s.nombre}`}
              defaultValue={s.monto ? s.monto.toLocaleString('en-US') : ''}
              onBlur={(e) => {
                const n = leerMonto(e.target.value)
                if (n !== s.monto) hacer(() => cambiar('sobres', s.id, { monto: n }))
              }}
            />
            <SelectCuenta valor={s.cuenta_id} cuentas={cuentas} alCambiar={(id) => hacer(() => cambiar('sobres', s.id, { cuenta_id: id }))} />
            <Borrar etiqueta={s.nombre} alBorrar={() => hacer(() => borrar('sobres', s.id))} />
          </div>
        ))}
        <form className="form-fila" onSubmit={agregar} style={sobres.length ? undefined : { borderTop: 'none' }}>
          <input className="inp chico" placeholder="Nuevo sobre" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del sobre nuevo" />
          <input className="inp chico num" placeholder="₡" value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" style={{ flex: '0 1 100px' }} aria-label="Monto" />
          <SelectCuenta valor={cuenta} cuentas={cuentas} alCambiar={setCuenta} />
          <button className="btn chico">Agregar</button>
        </form>
      </div>
    </div>
  )
}

function PlantillasSeccion(props: { tipo: 'entrada' | 'fijo'; titulo: string; plantillas: Plantilla[]; cuentas: Cuenta[]; hacer: Hacer }) {
  const { tipo, titulo, cuentas, hacer } = props
  const lista = props.plantillas.filter((p) => p.tipo === tipo)
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [dia, setDia] = useState('')

  async function agregar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    await hacer(() =>
      agregarDoc('plantillas', { tipo, nombre: nombre.trim(), monto: leerMonto(monto), dia_vence: dia ? Number(dia) : null, orden: props.plantillas.length }),
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
                {colones(p.monto)}
                {p.dia_vence ? ` · vence día ${p.dia_vence}` : ''}
              </span>
            </div>
            {tipo === 'fijo' && (
              <SelectCuenta valor={p.cuenta_id} cuentas={cuentas} alCambiar={(id) => hacer(() => cambiar('plantillas', p.id, { cuenta_id: id }))} />
            )}
            <Borrar etiqueta={p.nombre} alBorrar={() => hacer(() => borrar('plantillas', p.id))} />
          </div>
        ))}
        <form className="form-fila" onSubmit={agregar} style={lista.length ? undefined : { borderTop: 'none' }}>
          <input className="inp chico" placeholder={tipo === 'entrada' ? 'Ej.: Salario 1.ª quincena' : 'Ej.: Cel'} value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" />
          <input className="inp chico num" placeholder="₡" value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" style={{ flex: '0 1 100px' }} aria-label="Monto" />
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
              {desdeMes ? `Desde ${nombreMes(desdeMes).toLowerCase()}. Si un mes queda en negativo, también se pasa.` : 'Apagado: cada mes empieza de cero.'}
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

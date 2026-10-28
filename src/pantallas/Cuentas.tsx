import { useState, type FormEvent } from 'react'
import { supabase, revisar } from '../supabase'
import { Atras, Cargando, Icono, MensajeError, leerMonto, useCarga } from '../comun'
import { colones } from '../dinero'
import type { Cuenta, Plantilla, Sobre } from '../tipos'

const TIPOS_CUENTA = ['tarjeta', 'cuenta de ahorro', 'efectivo', 'otra']

type Hacer = (fn: () => PromiseLike<{ error: { message: string } | null }>) => Promise<void>

export function Cuentas() {
  const [error, setError] = useState<string | null>(null)
  const carga = useCarga(async () => {
    const [c, s, p] = await Promise.all([
      supabase.from('cuentas').select('*').order('orden'),
      supabase.from('sobres').select('*').order('orden'),
      supabase.from('plantillas').select('*').order('orden'),
    ])
    return {
      cuentas: (revisar(c) as Cuenta[]).map((x) => ({ ...x, efectivo_suelto: Number(x.efectivo_suelto) })),
      sobres: (revisar(s) as Sobre[]).map((x) => ({ ...x, monto: Number(x.monto) })),
      plantillas: (revisar(p) as Plantilla[]).map((x) => ({ ...x, monto: Number(x.monto) })),
    }
  }, [])

  const hacer: Hacer = async (fn) => {
    setError(null)
    const { error } = await fn()
    if (error) setError(error.message)
    carga.recargar()
  }

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
    await hacer(() => supabase.from('cuentas').insert({ nombre: nombre.trim(), tipo, orden: cuentas.length }))
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
              onBlur={(e) => e.target.value.trim() && e.target.value !== c.nombre && hacer(() => supabase.from('cuentas').update({ nombre: e.target.value.trim() }).eq('id', c.id))}
            />
            <select className="inp chico" style={{ flex: '0 1 130px' }} value={c.tipo} aria-label="Tipo" onChange={(e) => hacer(() => supabase.from('cuentas').update({ tipo: e.target.value }).eq('id', c.id))}>
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
                  if (n !== c.efectivo_suelto) hacer(() => supabase.from('cuentas').update({ efectivo_suelto: n }).eq('id', c.id))
                }}
              />
            </label>
            <Borrar etiqueta={c.nombre} alBorrar={() => hacer(() => supabase.from('cuentas').delete().eq('id', c.id))} />
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
    await hacer(() => supabase.from('sobres').insert({ nombre: nombre.trim(), monto: leerMonto(monto), cuenta_id: cuenta, orden: sobres.length }))
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
              onBlur={(e) => e.target.value.trim() && e.target.value !== s.nombre && hacer(() => supabase.from('sobres').update({ nombre: e.target.value.trim() }).eq('id', s.id))}
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
                if (n !== s.monto) hacer(() => supabase.from('sobres').update({ monto: n }).eq('id', s.id))
              }}
            />
            <SelectCuenta valor={s.cuenta_id} cuentas={cuentas} alCambiar={(id) => hacer(() => supabase.from('sobres').update({ cuenta_id: id }).eq('id', s.id))} />
            <Borrar etiqueta={s.nombre} alBorrar={() => hacer(() => supabase.from('sobres').delete().eq('id', s.id))} />
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
      supabase.from('plantillas').insert({ tipo, nombre: nombre.trim(), monto: leerMonto(monto), dia_vence: dia ? Number(dia) : null, orden: props.plantillas.length }),
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
              <SelectCuenta valor={p.cuenta_id} cuentas={cuentas} alCambiar={(id) => hacer(() => supabase.from('plantillas').update({ cuenta_id: id }).eq('id', p.id))} />
            )}
            <Borrar etiqueta={p.nombre} alBorrar={() => hacer(() => supabase.from('plantillas').delete().eq('id', p.id))} />
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

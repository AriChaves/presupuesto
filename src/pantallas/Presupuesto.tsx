import { useState, type FormEvent } from 'react'
import { agregar as agregarDoc, borrar, cambiar, cargarArrastre, listar, where } from '../datos'
import { Cargando, Check, Icono, MensajeError, leerMonto, useCarga, useHacer, useSesion } from '../comun'
import { colones, mesDe, moverMes, nombreMes } from '../dinero'
import type { Cuenta, Plantilla, Renglon, Sobre, TipoRenglon } from '../tipos'

const SECCIONES: { tipo: TipoRenglon; titulo: string; hecho: string }[] = [
  { tipo: 'entrada', titulo: 'Entradas', hecho: 'Recibido' },
  { tipo: 'fijo', titulo: 'Gastos fijos', hecho: 'Pagado' },
  { tipo: 'extra', titulo: 'Gastos extras', hecho: 'Pagado' },
  { tipo: 'transporte', titulo: 'Pases · transporte', hecho: 'Pagado' },
]

export function Presupuesto() {
  const { ir } = useSesion()
  const [mes, setMes] = useState(mesDe(new Date()))
  const [error, setError] = useState<string | null>(null)
  const carga = useCarga(async () => {
    const [renglones, cuentas, sobres, plantillas, arrastre] = await Promise.all([
      listar<Renglon>('renglones', where('mes', '==', mes)),
      listar<Cuenta>('cuentas'),
      listar<Sobre>('sobres'),
      listar<Plantilla>('plantillas'),
      cargarArrastre(mes),
    ])
    return { renglones, cuentas, sobres, plantillas, arrastre }
  }, [mes])
  const hacer = useHacer(setError, carga.recargar)

  const d = carga.datos
  // Como en el Excel: un renglón cuenta hasta que se marca (recibido o pagado).
  const entradas = (d?.renglones.filter((r) => r.tipo === 'entrada' && r.hecho).reduce((s, r) => s + r.monto, 0) ?? 0) + (d?.arrastre ?? 0)
  const gasto = d?.renglones.filter((r) => r.tipo !== 'entrada' && r.hecho).reduce((s, r) => s + r.monto, 0) ?? 0

  async function llenarDesdePlantillas() {
    if (!d) return
    const filas = d.plantillas.map((p, i) => ({
      mes,
      tipo: p.tipo,
      nombre: p.nombre,
      monto: p.monto,
      dia_vence: p.dia_vence,
      cuenta_id: p.cuenta_id,
      orden: i,
    }))
    await hacer(() => Promise.all(filas.map((f) => agregarDoc('renglones', { ...f, hecho: false, gasto_id: null }))))
  }

  return (
    <div className="contenido">
      <div className="cabeza">
        <div className="crece">
          <h1>Mi presupuesto</h1>
          <span className="sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icono n="candado" t={13} /> Privado · solo usted lo ve
          </span>
        </div>
      </div>

      <div className="mes-nav">
        <button aria-label="Mes anterior" onClick={() => setMes(moverMes(mes, -1))}>‹</button>
        <strong>{nombreMes(mes)}</strong>
        <button aria-label="Mes siguiente" onClick={() => setMes(moverMes(mes, 1))}>›</button>
      </div>

      <MensajeError texto={error ?? carga.error} />
      {!d ? (
        <Cargando />
      ) : (
        <>
          <div className="card resumen3 num">
            <div><span>Entradas</span><span>{colones(entradas)}</span></div>
            <div><span>Gasto</span><span>{colones(gasto)}</span></div>
            <div><span>Sobrante</span><span className={entradas - gasto < 0 ? 'debe' : 'le-deben'}>{colones(entradas - gasto)}</span></div>
          </div>

          {d.renglones.length === 0 && (
            <div className="card pad">
              <span>Este mes está vacío.</span>
              {d.plantillas.length > 0 ? (
                <button className="btn verde" onClick={llenarDesdePlantillas}>
                  Llenar con mis entradas y gastos fijos
                </button>
              ) : (
                <span className="suave peq">
                  Tip: en <button className="btn texto" onClick={() => ir({ p: 'cuentas' })}>Cuentas y plantillas</button> guarde sus salarios y gastos fijos
                  para llenar cada mes con un toque.
                </span>
              )}
            </div>
          )}

          {SECCIONES.map((s) => (
            <Seccion
              key={s.tipo}
              tipo={s.tipo}
              titulo={s.titulo}
              hecho={s.hecho}
              renglones={d.renglones.filter((r) => r.tipo === s.tipo)}
              hacer={hacer}
              mes={mes}
              arrastre={s.tipo === 'entrada' ? d.arrastre : 0}
            />
          ))}

          <div className="seccion">
            <div className="seccion-titulo">
              <span className="lbl">Sobres por cuenta</span>
            </div>
            <div className="card">
              {d.cuentas.map((c) => {
                const sobres = d.sobres.filter((s) => s.cuenta_id === c.id)
                const total = sobres.reduce((t, s) => t + s.monto, 0) + c.efectivo_suelto
                return (
                  <div className="fila" key={c.id}>
                    <div className="av cuadro">{c.nombre.slice(0, 2).toUpperCase()}</div>
                    <div className="crece">
                      <span>{c.nombre}</span>
                      <span className="suave peq">
                        {sobres.length ? sobres.map((s) => `${s.nombre} ${colones(s.monto)}`).join(' · ') : 'Sin sobres'}
                        {c.efectivo_suelto ? ` · suelto ${colones(c.efectivo_suelto)}` : ''}
                      </span>
                    </div>
                    <strong className="num">{colones(total)}</strong>
                  </div>
                )
              })}
              {(() => {
                const ids = new Set(d.cuentas.map((c) => c.id))
                const sueltos = d.sobres.filter((s) => !s.cuenta_id || !ids.has(s.cuenta_id))
                if (sueltos.length === 0) return d.cuentas.length === 0 ? <div className="vacio">Todavía no tiene cuentas.</div> : null
                return (
                  <div className="fila">
                    <div className="av cuadro">?</div>
                    <div className="crece">
                      <span>Sin cuenta asignada</span>
                      <span className="suave peq">{sueltos.map((s) => `${s.nombre} ${colones(s.monto)}`).join(' · ')}</span>
                    </div>
                    <strong className="num">{colones(sueltos.reduce((t, s) => t + s.monto, 0))}</strong>
                  </div>
                )
              })()}
              <button className="agregar" onClick={() => ir({ p: 'cuentas' })}>
                Editar cuentas, sobres y plantillas
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

type Hacer = (fn: () => Promise<unknown>) => Promise<void>

function Seccion(props: { tipo: TipoRenglon; titulo: string; hecho: string; renglones: Renglon[]; hacer: Hacer; mes: string; arrastre: number }) {
  const { tipo, titulo, hecho, renglones, hacer, mes, arrastre } = props
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [dia, setDia] = useState('')
  const total = renglones.reduce((s, r) => s + r.monto, 0) + arrastre
  const recibido = renglones.filter((r) => r.hecho).reduce((s, r) => s + r.monto, 0) + arrastre

  async function agregar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    await hacer(() =>
      agregarDoc('renglones', {
        mes,
        tipo,
        nombre: nombre.trim(),
        monto: leerMonto(monto),
        dia_vence: dia ? Number(dia) : null,
        orden: renglones.length,
        hecho: false,
        cuenta_id: null,
        gasto_id: null,
      }),
    )
    setNombre('')
    setMonto('')
    setDia('')
  }

  return (
    <div className="seccion">
      <div className="seccion-titulo">
        <span className="lbl">{titulo}</span>
        <span className="suave peq num">{recibido !== total ? `${colones(recibido)} de ${colones(total)}` : colones(total)}</span>
      </div>
      <div className="card">
        {arrastre !== 0 && (
          <div className="fila">
            <div className="chk on" aria-hidden="true" style={{ cursor: 'default' }}>
              <span style={{ color: '#fff', display: 'flex' }}>
                <Icono n="check" t={15} grosor={3} />
              </span>
            </div>
            <div className="crece">
              <span>{arrastre > 0 ? 'Sobrante' : 'Faltante'} de {nombreMes(moverMes(mes, -1), false).toLowerCase()}</span>
              <span className="chip">Automático · viene del mes anterior</span>
            </div>
            <strong className={`num ${arrastre < 0 ? 'debe' : ''}`} style={{ paddingRight: 8 }}>{colones(arrastre)}</strong>
          </div>
        )}
        {renglones.map((r) => (
          <div className="fila" key={r.id}>
            <Check
              on={r.hecho}
              etiqueta={`${hecho}: ${r.nombre}`}
              alCambiar={() => hacer(() => cambiar('renglones', r.id, { hecho: !r.hecho }))}
            />
            <div className="crece">
              <span>{r.nombre}</span>
              {r.dia_vence && (
                <span className="suave peq">
                  {r.hecho ? hecho : 'Vence'} · día {r.dia_vence}
                </span>
              )}
              {r.gasto_id && <span className="chip">Viene de un grupo</span>}
            </div>
            <input
              className="inp chico num"
              style={{ width: 110, textAlign: 'right' }}
              key={r.monto}
              defaultValue={r.monto ? r.monto.toLocaleString('en-US') : ''}
              inputMode="decimal"
              aria-label={`Monto de ${r.nombre}`}
              onBlur={(e) => {
                const n = leerMonto(e.target.value)
                if (n !== r.monto) hacer(() => cambiar('renglones', r.id, { monto: n }))
              }}
            />
            <button className="btn peligro" aria-label={`Borrar ${r.nombre}`} onClick={() => hacer(() => borrar('renglones', r.id))}>
              <Icono n="basura" t={18} />
            </button>
          </div>
        ))}
        <form className="form-fila" onSubmit={agregar} style={renglones.length ? undefined : { borderTop: 'none' }}>
          <input className="inp chico" placeholder="Nuevo…" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre" />
          <input className="inp chico num" placeholder="₡" value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" style={{ flex: '0 1 110px' }} aria-label="Monto" />
          {tipo === 'fijo' && (
            <input className="inp chico" placeholder="Día" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" style={{ flex: '0 1 64px' }} aria-label="Día que vence" />
          )}
          <button className="btn chico">Agregar</button>
        </form>
      </div>
    </div>
  )
}

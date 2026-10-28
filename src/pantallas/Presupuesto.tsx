import { useState, type FormEvent, type ReactNode } from 'react'
import { agregar as agregarDoc, borrar, cambiar, cargarArrastre, listar, misGrupos, where } from '../datos'
import { BotonBorrar, Cargando, Check, Icono, MensajeError, SelectMoneda, leerMonto, useCarga, useHacer, useSesion } from '../comun'
import { MONEDAS, SIMBOLO, colonesQueFaltan, convertir, dinero, dolaresParaCambiar, mesDe, moverMes, nombreMes, resumenMes, sumarPorMoneda, textoMonedas, ultimoTipoDeCambio, type Moneda, type PorMoneda } from '../dinero'
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
    const [renglones, cuentas, sobres, plantillas, arrastre, grupos, cambios] = await Promise.all([
      listar<Renglon>('renglones', where('mes', '==', mes)),
      listar<Cuenta>('cuentas'),
      listar<Sobre>('sobres'),
      listar<Plantilla>('plantillas'),
      cargarArrastre(mes),
      misGrupos(),
      listar<Renglon>('renglones', where('tipo', '==', 'cambio')),
    ])
    return { renglones, cuentas, sobres, plantillas, arrastre, grupos: Object.fromEntries(grupos.map((g) => [g.id, g.nombre])), ultimoTipo: ultimoTipoDeCambio(cambios) }
  }, [mes])
  const hacer = useHacer(setError, carga.recargar)

  const d = carga.datos
  // Como en el Excel: un renglón cuenta hasta que se marca (recibido o pagado). Cada moneda por aparte.
  const resumen = (m: Moneda) => resumenMes(d?.renglones ?? [], m, d?.arrastre[m] ?? 0)
  const hayDolares = Boolean(d && (d.renglones.some((r) => r.moneda === 'USD') || d.arrastre.USD !== 0))

  async function llenarDesdePlantillas() {
    if (!d) return
    const filas = d.plantillas.map((p, i) => ({
      mes,
      tipo: p.tipo,
      nombre: p.nombre,
      monto: p.monto,
      moneda: p.moneda ?? 'CRC',
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
          {(hayDolares ? MONEDAS : (['CRC'] as Moneda[])).map((m) => {
            const r = resumen(m)
            return (
              <div className="card num" key={m}>
                {hayDolares && <div className="lbl" style={{ padding: '12px 16px 0' }}>{m === 'CRC' ? 'En colones' : 'En dólares'}</div>}
                <div className="resumen3">
                  <div><span>Entradas</span><span>{dinero(r.entradas + Math.max(r.cambio, 0), m)}</span></div>
                  <div><span>Gasto</span><span>{dinero(r.gasto, m)}</span></div>
                  <div><span>Sobrante</span><span className={r.sobrante < 0 ? 'debe' : 'le-deben'}>{dinero(r.sobrante, m)}</span></div>
                </div>
                {r.cambio < 0 && (
                  <div className="suave peq" style={{ padding: '0 16px 12px', textAlign: 'center' }}>
                    Pasó a {m === 'USD' ? 'colones' : 'dólares'}: {dinero(r.cambio, m)}
                  </div>
                )}
              </div>
            )
          })}

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
              grupos={d.grupos}
              hacer={hacer}
              mes={mes}
              arrastre={s.tipo === 'entrada' ? d.arrastre : { CRC: 0, USD: 0 }}
              cambiado={s.tipo === 'entrada' ? sumarPorMoneda(d.renglones.filter((r) => r.tipo === 'cambio' && r.monto > 0)) : { CRC: 0, USD: 0 }}
              pie={
                s.tipo === 'entrada' && (
                  <Cambios
                    renglones={d.renglones.filter((r) => r.tipo === 'cambio')}
                    hacer={hacer}
                    mes={mes}
                    faltan={colonesQueFaltan(d.renglones, d.arrastre.CRC)}
                    ultimoTipo={d.ultimoTipo}
                  />
                )
              }
            />
          ))}

          <div className="seccion">
            <div className="seccion-titulo">
              <span className="lbl">Sobres por cuenta</span>
            </div>
            <div className="card">
              {d.cuentas.map((c) => {
                const sobres = d.sobres.filter((s) => s.cuenta_id === c.id)
                const total = sumarPorMoneda([...sobres, { monto: c.efectivo_suelto ?? 0, moneda: c.moneda }])
                return (
                  <div className="fila" key={c.id}>
                    <div className="av cuadro">{c.nombre.slice(0, 2).toUpperCase()}</div>
                    <div className="crece">
                      <span>{c.nombre}</span>
                      <span className="suave peq">
                        {sobres.length ? sobres.map((s) => `${s.nombre} ${dinero(s.monto, s.moneda)}`).join(' · ') : 'Sin sobres'}
                        {c.efectivo_suelto ? ` · suelto ${dinero(c.efectivo_suelto, c.moneda)}` : ''}
                      </span>
                    </div>
                    <strong className="num">{textoMonedas(total)}</strong>
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
                      <span className="suave peq">{sueltos.map((s) => `${s.nombre} ${dinero(s.monto, s.moneda)}`).join(' · ')}</span>
                    </div>
                    <strong className="num">{textoMonedas(sumarPorMoneda(sueltos))}</strong>
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

function Seccion(props: {
  tipo: TipoRenglon
  titulo: string
  hecho: string
  renglones: Renglon[]
  hacer: Hacer
  mes: string
  arrastre: PorMoneda
  grupos: Record<string, string>
  cambiado: PorMoneda
  pie?: ReactNode
}) {
  const { tipo, titulo, hecho, renglones, hacer, mes, arrastre, grupos, cambiado, pie } = props
  // Lo que viene de un grupo se ve en una sola línea por grupo.
  const sueltos = renglones.filter((r) => !r.grupo_id)
  const porGrupo = new Map<string, Renglon[]>()
  for (const r of renglones) if (r.grupo_id) porGrupo.set(r.grupo_id, [...(porGrupo.get(r.grupo_id) ?? []), r])
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [dia, setDia] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('CRC')
  const conArrastre = (t: PorMoneda) => ({ CRC: t.CRC + arrastre.CRC + cambiado.CRC, USD: t.USD + arrastre.USD + cambiado.USD })
  const total = conArrastre(sumarPorMoneda(renglones))
  const recibido = conArrastre(sumarPorMoneda(renglones.filter((r) => r.hecho)))
  const igual = total.CRC === recibido.CRC && total.USD === recibido.USD

  async function agregar(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    await hacer(() =>
      agregarDoc('renglones', {
        mes,
        tipo,
        nombre: nombre.trim(),
        monto: leerMonto(monto),
        moneda,
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
        <span className="suave peq num">{igual ? textoMonedas(total) : `${textoMonedas(recibido)} de ${textoMonedas(total)}`}</span>
      </div>
      <div className="card">
        {MONEDAS.filter((m) => arrastre[m] !== 0).map((m) => (
          <div className="fila" key={m}>
            <div className="chk on" aria-hidden="true" style={{ cursor: 'default' }}>
              <span style={{ color: '#fff', display: 'flex' }}>
                <Icono n="check" t={15} grosor={3} />
              </span>
            </div>
            <div className="crece">
              <span>{arrastre[m] > 0 ? 'Sobrante' : 'Faltante'} de {nombreMes(moverMes(mes, -1), false).toLowerCase()}{m === 'USD' ? ' en dólares' : ''}</span>
              <span className="chip">Automático · viene del mes anterior</span>
            </div>
            <strong className={`num ${arrastre[m] < 0 ? 'debe' : ''}`} style={{ paddingRight: 8 }}>{dinero(arrastre[m], m)}</strong>
          </div>
        ))}
        {[...porGrupo.entries()].map(([gid, lista]) => (
          <LineaGrupo key={gid} nombre={grupos[gid] ?? 'Grupo'} lista={lista} hecho={hecho} hacer={hacer} />
        ))}
        {sueltos.map((r) => (
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
            <button
              className="btn chico borde"
              style={{ width: 36, padding: 0, flexShrink: 0 }}
              aria-label={`Moneda de ${r.nombre}: ${r.moneda === 'USD' ? 'dólares' : 'colones'}. Tocar para cambiar`}
              onClick={() => hacer(() => cambiar('renglones', r.id, { moneda: r.moneda === 'USD' ? 'CRC' : 'USD' }))}
            >
              {SIMBOLO[r.moneda ?? 'CRC']}
            </button>
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
          <SelectMoneda valor={moneda} alCambiar={setMoneda} />
          <input className="inp chico num" placeholder={SIMBOLO[moneda]} value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" style={{ flex: '0 1 110px' }} aria-label="Monto" />
          {tipo === 'fijo' && (
            <input className="inp chico" placeholder="Día" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" style={{ flex: '0 1 64px' }} aria-label="Día que vence" />
          )}
          <button className="btn chico">Agregar</button>
        </form>
        {pie}
      </div>
    </div>
  )
}

// Pasar plata de dólares a colones (o al revés), dentro de Entradas: se pone el monto y al lado
// el tipo de cambio de ARi; lo que llega es una entrada en la otra moneda y sale de la primera.
function Cambios(props: { renglones: Renglon[]; hacer: Hacer; mes: string; faltan: number; ultimoTipo: number | null }) {
  const { renglones, hacer, mes, faltan, ultimoTipo } = props
  const [de, setDe] = useState<Moneda>('USD')
  const [sale, setSale] = useState('')
  const [tipoTexto, setTipoTexto] = useState(ultimoTipo ? String(ultimoTipo) : '')
  const tipo = leerMonto(tipoTexto)
  const a: Moneda = de === 'USD' ? 'CRC' : 'USD'
  const montoSale = leerMonto(sale)
  const recibe = convertir(montoSale, de, tipo)
  const sugerido = dolaresParaCambiar(faltan, tipo)
  const pares = new Map<string, Renglon[]>()
  for (const r of renglones) pares.set(r.cambio_id ?? r.id, [...(pares.get(r.cambio_id ?? r.id) ?? []), r])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (montoSale <= 0 || recibe <= 0) return
    const cambio_id = crypto.randomUUID()
    const base = { mes, tipo: 'cambio', hecho: true, dia_vence: null, cuenta_id: null, gasto_id: null, orden: 0, cambio_id, creadoEn: Date.now() }
    await hacer(() =>
      Promise.all([
        agregarDoc('renglones', { ...base, nombre: `Cambio a ${a === 'CRC' ? 'colones' : 'dólares'}`, monto: -montoSale, moneda: de }),
        agregarDoc('renglones', { ...base, nombre: `Cambio de ${de === 'USD' ? 'dólares' : 'colones'}`, monto: recibe, moneda: a }),
      ]),
    )
    setSale('')
  }

  return (
    <>
      {[...pares.entries()].map(([id, par]) => {
        const salio = par.find((r) => r.monto < 0)
        const entro = par.find((r) => r.monto > 0)
        const usd = par.find((r) => r.moneda === 'USD')
        const crc = par.find((r) => (r.moneda ?? 'CRC') === 'CRC')
        const t = usd && crc && usd.monto !== 0 ? Math.abs(crc.monto / usd.monto) : 0
        return (
          <div className="fila" key={id}>
            <div className="chk on" aria-hidden="true" style={{ cursor: 'default' }}>
              <span style={{ color: '#fff', display: 'flex' }}>
                <Icono n="check" t={15} grosor={3} />
              </span>
            </div>
            <div className="crece">
              <span>Cambio de {salio ? dinero(-salio.monto, salio.moneda) : '?'}</span>
              {t > 0 && <span className="suave peq num">a ₡{t.toLocaleString('en-US', { maximumFractionDigits: 2 })} por dólar</span>}
            </div>
            <strong className="num">{entro ? dinero(entro.monto, entro.moneda) : '?'}</strong>
            <BotonBorrar etiqueta="este cambio" alBorrar={() => hacer(() => Promise.all(par.map((r) => borrar('renglones', r.id))))} />
          </div>
        )
      })}
      <form
        onSubmit={guardar}
        style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--linea2)', background: faltan > 0 ? 'var(--verde-claro)' : undefined, borderRadius: '0 0 16px 16px' }}
      >
        <span style={{ fontWeight: 500 }}>Pasar dólares a colones</span>
        {faltan > 0 ? (
          <span className="peq">
            Para sus gastos en colones de {nombreMes(mes, false).toLowerCase()} le faltan <strong className="num">{dinero(faltan)}</strong>
            {sugerido > 0 && (
              <>
                {' '}· cambie unos{' '}
                <button type="button" className="btn texto num" style={{ padding: 0, minHeight: 0, fontWeight: 700 }} onClick={() => (setDe('USD'), setSale(String(sugerido)))}>
                  {dinero(sugerido, 'USD')}
                </button>
              </>
            )}
          </span>
        ) : (
          <span className="suave peq">Sus gastos en colones de {nombreMes(mes, false).toLowerCase()} ya están cubiertos.</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <SelectMoneda valor={de} alCambiar={setDe} />
          <input
            className="inp chico num"
            style={{ flex: '1 1 90px' }}
            inputMode="decimal"
            placeholder={SIMBOLO[de]}
            value={sale}
            onChange={(e) => setSale(e.target.value)}
            aria-label={`Cuánto cambió en ${de === 'USD' ? 'dólares' : 'colones'}`}
          />
          <span className="suave peq">a ₡</span>
          <input
            className="inp chico num"
            style={{ flex: '0 1 90px' }}
            inputMode="decimal"
            placeholder="515"
            value={tipoTexto}
            onChange={(e) => setTipoTexto(e.target.value)}
            aria-label="Tipo de cambio de ARi, colones por dólar"
          />
          <span className="suave peq">por dólar</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ flex: 1, fontSize: 16 }}>
            {recibe > 0 ? (
              <>
                Le llegan <strong className="num">{dinero(recibe, a)}</strong>
              </>
            ) : (
              <span className="suave peq">{ultimoTipo ? `El último tipo que usó fue ₡${ultimoTipo}.` : 'Ponga el tipo que le da ARi.'}</span>
            )}
          </span>
          <button className="btn chico verde" disabled={recibe <= 0}>
            Agregar cambio
          </button>
        </div>
      </form>
    </>
  )
}

// Su parte de los gastos de un grupo: una línea con el total, y el detalle al tocar "Ver".
function LineaGrupo({ nombre, lista, hecho, hacer }: { nombre: string; lista: Renglon[]; hecho: string; hacer: Hacer }) {
  const [abierto, setAbierto] = useState(false)
  const todos = lista.every((r) => r.hecho)
  const dias = [...new Set(lista.filter((r) => !r.hecho && r.dia_vence).map((r) => r.dia_vence))]
  const pendientes = lista.filter((r) => !r.hecho).length
  return (
    <>
      <div className="fila" style={{ background: 'var(--azul-claro)' }}>
        <Check
          on={todos}
          etiqueta={`${hecho}: todo lo de ${nombre}`}
          alCambiar={() => hacer(() => Promise.all(lista.map((r) => cambiar('renglones', r.id, { hecho: !todos }))))}
        />
        <div className="crece">
          <span>
            {nombre} · {lista.length} {lista.length === 1 ? 'gasto' : 'gastos'}
          </span>
          <span className="suave peq">
            Su parte de lo compartido
            {pendientes > 0 && pendientes < lista.length ? ` · ${pendientes} sin pagar` : ''}
            {dias.length ? ` · vence día ${dias.join(', ')}` : ''}
          </span>
        </div>
        <strong className="num">{textoMonedas(sumarPorMoneda(lista))}</strong>
        <button className="btn texto" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
          {abierto ? 'Ocultar' : 'Ver'}
        </button>
      </div>
      {abierto &&
        lista.map((r) => (
          <div className="fila" key={r.id} style={{ paddingLeft: 32, minHeight: 44 }}>
            <Check on={r.hecho} etiqueta={`${hecho}: ${r.nombre}`} alCambiar={() => hacer(() => cambiar('renglones', r.id, { hecho: !r.hecho }))} />
            <span className="crece peq">{r.nombre}</span>
            <span className="num peq">{dinero(r.monto, r.moneda)}</span>
          </div>
        ))}
    </>
  )
}

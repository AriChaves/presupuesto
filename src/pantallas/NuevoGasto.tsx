import { useEffect, useState, type FormEvent } from 'react'
import { agregar as agregarDoc, agregarGasto, listar } from '../datos'
import { mensaje } from '../firebase'
import { Atras, Cargando, MensajeError, cargarGrupos, leerMonto, nombreDe, useCarga, useSesion, type Vista } from '../comun'
import { SIMBOLO, colones, dividir, mesDe, moverMes, type Division, type Moneda } from '../dinero'
import type { Cuenta } from '../tipos'

const PERSONAL = 'personal'
const CATEGORIAS = ['Comidas', 'Viajes', 'Extra']

export function NuevoGasto({ grupoId, volver }: { grupoId?: string; volver: Vista }) {
  const { yo, ir } = useSesion()
  const carga = useCarga(async () => {
    const [d, cuentas] = await Promise.all([cargarGrupos(), listar<Cuenta>('cuentas')])
    return { ...d, cuentas }
  }, [])
  const [grupo, setGrupo] = useState(grupoId ?? '')
  const [monto, setMonto] = useState('')
  const [desc, setDesc] = useState('')
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA'))
  const [categoria, setCategoria] = useState('Comidas')
  const [pagador, setPagador] = useState(yo.id)
  const [division, setDivision] = useState<Division>('mitad')
  const [manual, setManual] = useState<Record<string, string>>({})
  const [medio, setMedio] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('CRC')
  const [anotar, setAnotar] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const d = carga.datos
  useEffect(() => {
    if (d && !grupo) setGrupo(d.grupos[0]?.id ?? PERSONAL)
  }, [d, grupo])

  if (!d) {
    return (
      <div className="contenido">
        <Atras a={volver} />
        <MensajeError texto={carga.error} />
        <Cargando />
      </div>
    )
  }

  const { cuentas, grupos } = d
  const esPersonal = grupo === PERSONAL
  const miembros = esPersonal ? [yo.id] : d.miembros.filter((m) => m.grupo_id === grupo).map((m) => m.user_id)
  const total = leerMonto(monto)
  const partes = dividir(total, division, miembros, pagador, Object.fromEntries(Object.entries(manual).map(([k, v]) => [k, leerMonto(v)])))
  const miParte = partes.find((p) => p.user_id === yo.id)?.monto ?? 0
  const sumaPartes = partes.reduce((s, p) => s + p.monto, 0)
  const partesMal = division === 'partes' && Math.abs(sumaPartes - total) > 0.5
  const nombre = (id: string) => nombreDe(d.perfiles, id, yo.id)

  let resumen = ''
  if (!esPersonal && total > 0 && division !== 'solo') {
    if (pagador === yo.id) {
      const meDeben = total - miParte
      resumen = meDeben > 0 ? `Le van a deber ${colones(meDeben)}` : ''
    } else {
      resumen = miParte > 0 ? `Usted va a deberle ${colones(miParte)} a ${nombre(pagador)}` : ''
    }
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (total <= 0 || !desc.trim()) return setError('Escriba el monto y la descripción.')
    if (partesMal) return setError(`Las partes suman ${colones(sumaPartes)} y el gasto es ${colones(total)}.`)
    setError(null)
    setGuardando(true)
    try {
      let gastoId: string | null = null
      if (!esPersonal) {
        gastoId = await agregarGasto(grupo, {
          fecha,
          descripcion: desc.trim(),
          categoria,
          monto: total,
          pagado_por: pagador,
          division,
          medio: pagador === yo.id ? medio : '',
          partes,
        })
      }
      const montoMio = esPersonal ? total : miParte
      if ((esPersonal || anotar) && montoMio > 0) {
        const cuenta = cuentas.find((c) => c.nombre === medio)
        // Si otra persona del grupo pagó, usted le paga el 30 de ese mes: cuenta en el presupuesto
        // del mes siguiente, en la quincena del 30 (como los gastos fijos). Si pagó usted, va en ese mes.
        const leDebe = !esPersonal && pagador !== yo.id
        const mesGasto = mesDe(new Date(fecha + 'T12:00'))
        await agregarDoc('renglones', {
          mes: leDebe ? moverMes(mesGasto, 1) : mesGasto,
          tipo: 'extra',
          nombre: esPersonal ? desc.trim() : `${desc.trim()} (${grupos.find((x) => x.id === grupo)?.nombre})`,
          monto: montoMio,
          moneda: esPersonal ? moneda : 'CRC',
          hecho: !leDebe,
          dia_vence: leDebe ? 30 : null,
          cuenta_id: cuenta?.id ?? null,
          gasto_id: gastoId,
          grupo_id: esPersonal ? null : grupo,
          orden: 999,
        })
      }
      ir(volver)
    } catch (err) {
      setError(mensaje(err))
      setGuardando(false)
    }
  }

  return (
    <form className="contenido" onSubmit={guardar}>
      <div className="cabeza">
        <Atras a={volver} />
        <div className="crece">
          <h1>Nuevo gasto</h1>
        </div>
      </div>

      <label className="campo" style={{ alignItems: 'center' }}>
        <span>Monto</span>
        <input className="inp-monto num" inputMode="decimal" placeholder={`${SIMBOLO[esPersonal ? moneda : 'CRC']}0`} value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
        {esPersonal ? (
          <div className="segs" style={{ justifyContent: 'center' }}>
            <button type="button" className={`seg ${moneda === 'CRC' ? 'on' : ''}`} style={{ flex: '0 0 120px' }} onClick={() => setMoneda('CRC')}>₡ Colones</button>
            <button type="button" className={`seg ${moneda === 'USD' ? 'on' : ''}`} style={{ flex: '0 0 120px' }} onClick={() => setMoneda('USD')}>$ Dólares</button>
          </div>
        ) : (
          <span className="suave peq">Los gastos de grupo van en colones.</span>
        )}
      </label>

      <label className="campo">
        <span>Descripción</span>
        <input className="inp" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej.: Arbys" />
      </label>

      <label className="campo">
        <span>Fecha</span>
        <input className="inp" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </label>

      <div className="campo">
        <span>Grupo</span>
        <div className="segs">
          <button type="button" className={`seg ${esPersonal ? 'on' : ''}`} onClick={() => setGrupo(PERSONAL)}>
            Mi presupuesto
          </button>
          {d.grupos.map((g) => (
            <button type="button" key={g.id} className={`seg ${grupo === g.id ? 'on' : ''}`} onClick={() => (setGrupo(g.id), setPagador(yo.id))}>
              {g.nombre}
            </button>
          ))}
        </div>
      </div>

      {!esPersonal && (
        <>
          <div className="campo">
            <span>Categoría</span>
            <div className="segs">
              {CATEGORIAS.map((c) => (
                <button type="button" key={c} className={`seg ${categoria === c ? 'on' : ''}`} onClick={() => setCategoria(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            <span>¿Quién pagó?</span>
            <div className="segs">
              {miembros.map((m) => (
                <button type="button" key={m} className={`seg ${pagador === m ? 'on' : ''}`} onClick={() => setPagador(m)}>
                  {m === yo.id ? 'Yo' : nombre(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            <span>¿Cómo se divide?</span>
            <div className="segs">
              <button type="button" className={`seg ${division === 'mitad' ? 'on' : ''}`} onClick={() => setDivision('mitad')}>
                {miembros.length > 2 ? 'Partes iguales' : 'Mitad y mitad'}
              </button>
              <button type="button" className={`seg ${division === 'partes' ? 'on' : ''}`} onClick={() => setDivision('partes')}>
                Por partes
              </button>
              <button type="button" className={`seg ${division === 'solo' ? 'on' : ''}`} onClick={() => setDivision('solo')}>
                Es solo de quien pagó
              </button>
            </div>
          </div>

          {division === 'partes' && (
            <div className="card">
              {miembros.map((m) => (
                <label className="fila" key={m}>
                  <span className="crece">{m === yo.id ? 'Yo' : nombre(m)}</span>
                  <input
                    className="inp chico num"
                    style={{ width: 120 }}
                    inputMode="decimal"
                    placeholder="₡"
                    value={manual[m] ?? ''}
                    onChange={(e) => setManual({ ...manual, [m]: e.target.value })}
                  />
                </label>
              ))}
              <div className={`fila peq ${partesMal ? 'debe' : 'suave'}`}>
                Suman {colones(sumaPartes)} de {colones(total)}
              </div>
            </div>
          )}
        </>
      )}

      {(esPersonal || pagador === yo.id) && d.cuentas.length > 0 && (
        <div className="campo">
          <span>Pagué con</span>
          <div className="segs">
            {d.cuentas.map((c) => (
              <button type="button" key={c.id} className={`seg ${medio === c.nombre ? 'on' : ''}`} onClick={() => (setMedio(medio === c.nombre ? '' : c.nombre), medio !== c.nombre && setMoneda(c.moneda ?? 'CRC'))}>
                {c.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {resumen && <div className="aviso" style={{ background: 'var(--verde-claro)', fontSize: 15, color: 'var(--tinta)' }}>{resumen}</div>}

      {!esPersonal && (
        <label className="card pad" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <span className="crece" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>Anotar mi parte en Mi presupuesto</span>
            <span className="suave peq">Va a Gastos extras ({colones(miParte)}) · el grupo no ve su presupuesto</span>
          </span>
          <input type="checkbox" checked={anotar} onChange={(e) => setAnotar(e.target.checked)} style={{ width: 22, height: 22, accentColor: 'var(--verde)' }} />
        </label>
      )}

      <MensajeError texto={error} />
      <button className="btn verde" disabled={guardando}>
        Guardar gasto
      </button>
    </form>
  )
}

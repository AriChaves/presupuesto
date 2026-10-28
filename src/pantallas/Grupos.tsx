import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { Atras, Cargando, Icono, MensajeError, cargarGrupos, inicial, leerMonto, nombreDe, useCarga, useSesion, type DatosGrupos } from '../comun'
import { colones, liquidar, mesCorto, nombreMes, saldosNetos, type Transferencia } from '../dinero'

// Lo que yo debo (negativo) o me deben (positivo) en un grupo.
export function miSaldo(d: DatosGrupos, grupoId: string, yo: string): number {
  const neto = saldosNetos(
    d.gastos.filter((g) => g.grupo_id === grupoId),
    d.pagos.filter((p) => p.grupo_id === grupoId),
  )
  return neto[yo] ?? 0
}

export function transferenciasDe(d: DatosGrupos, grupoId: string): Transferencia[] {
  return liquidar(
    saldosNetos(
      d.gastos.filter((g) => g.grupo_id === grupoId),
      d.pagos.filter((p) => p.grupo_id === grupoId),
    ),
  )
}

export function Grupos() {
  const { yo, ir } = useSesion()
  const carga = useCarga(cargarGrupos, [])
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    const { data, error } = await supabase.from('grupos').insert({ nombre: nombre.trim() }).select('id').single()
    if (error) return setError(error.message)
    setNombre('')
    ir({ p: 'grupo', id: data.id })
  }

  const d = carga.datos
  return (
    <div className="contenido">
      <div className="cabeza">
        <div className="crece">
          <h1>Grupos</h1>
          <span className="sub">Cada grupo lo ven solo sus miembros</span>
        </div>
      </div>
      <MensajeError texto={error ?? carga.error} />
      {!d ? (
        <Cargando />
      ) : (
        <div className="card">
          {d.grupos.length === 0 && <div className="vacio">Todavía no tiene grupos. Cree uno, por ejemplo "Pareja".</div>}
          {d.grupos.map((g) => {
            const s = miSaldo(d, g.id, yo.id)
            const otros = d.miembros.filter((m) => m.grupo_id === g.id && m.user_id !== yo.id).map((m) => nombreDe(d.perfiles, m.user_id, yo.id))
            return (
              <button key={g.id} className="fila" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--linea2)', textAlign: 'left', cursor: 'pointer' }} onClick={() => ir({ p: 'grupo', id: g.id })}>
                <div className="av">{inicial(g.nombre)}</div>
                <div className="crece">
                  <span style={{ fontWeight: 500 }}>{g.nombre}</span>
                  <span className="suave peq">{otros.length ? `Usted y ${otros.join(', ')}` : 'Solo usted · invite a alguien'}</span>
                </div>
                {Math.abs(s) >= 1 && <span className={`num peq ${s < 0 ? 'debe' : 'le-deben'}`} style={{ fontWeight: 500 }}>{s < 0 ? '−' : '+'}{colones(Math.abs(s))}</span>}
              </button>
            )
          })}
          <form className="form-fila" onSubmit={crear} style={d.grupos.length ? undefined : { borderTop: 'none' }}>
            <input className="inp chico" placeholder="Nombre del grupo nuevo" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del grupo nuevo" />
            <button className="btn chico">Crear</button>
          </form>
        </div>
      )}
    </div>
  )
}

export function GrupoDetalle({ id }: { id: string }) {
  const { yo, ir } = useSesion()
  const carga = useCarga(cargarGrupos, [id])
  const [error, setError] = useState<string | null>(null)
  const [correo, setCorreo] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [invitaciones, setInvitaciones] = useState<string[]>([])

  // Si el otro anota algo, se ve aquí al instante.
  useEffect(() => {
    const canal = supabase
      .channel(`grupo-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos', filter: `grupo_id=eq.${id}` }, () => carga.recargar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos', filter: `grupo_id=eq.${id}` }, () => carga.recargar())
      .subscribe()
    supabase
      .from('invitaciones')
      .select('email')
      .eq('grupo_id', id)
      .then(({ data }) => setInvitaciones((data ?? []).map((x: { email: string }) => x.email)))
    return () => {
      supabase.removeChannel(canal)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const d = carga.datos
  const grupo = d?.grupos.find((g) => g.id === id)
  if (d && !grupo) {
    return (
      <div className="contenido">
        <Atras a={{ p: 'grupos' }} />
        <div className="vacio">Este grupo ya no existe o usted no es miembro.</div>
      </div>
    )
  }

  async function invitar(e: FormEvent) {
    e.preventDefault()
    const email = correo.trim().toLowerCase()
    if (!email) return
    setError(null)
    const { error } = await supabase.from('invitaciones').insert({ grupo_id: id, email })
    if (error) return setError(error.message.includes('duplicate') ? 'Ese correo ya estaba invitado.' : error.message)
    setInvitaciones((l) => [...l, email])
    setCorreo('')
    setAviso(`Listo. Cuando ${email} cree su cuenta o entre a la app, va a aparecer en este grupo.`)
  }

  async function registrarPago(t: Transferencia) {
    const texto = prompt('¿Cuánto se pagó?', String(Math.round(t.monto)))
    if (texto === null) return
    const monto = leerMonto(texto)
    if (monto <= 0) return
    const { error } = await supabase.from('pagos').insert({ grupo_id: id, de: t.de, a: t.a, monto })
    if (error) setError(error.message)
    carga.recargar()
  }

  async function borrarGasto(gid: string, desc: string) {
    if (!confirm(`¿Borrar "${desc}"? Se borra para todos en el grupo.`)) return
    const { error } = await supabase.from('gastos').delete().eq('id', gid)
    if (error) setError(error.message)
    carga.recargar()
  }

  async function salir() {
    if (!confirm('¿Salir de este grupo? Ya no va a ver sus gastos.')) return
    const { error } = await supabase.from('miembros').delete().eq('grupo_id', id).eq('user_id', yo.id)
    if (error) return setError(error.message)
    ir({ p: 'grupos' })
  }

  if (!d || !grupo) {
    return (
      <div className="contenido">
        <Atras a={{ p: 'grupos' }} />
        <MensajeError texto={carga.error} />
        <Cargando />
      </div>
    )
  }

  const miembros = d.miembros.filter((m) => m.grupo_id === id).map((m) => m.user_id)
  const transf = transferenciasDe(d, id)
  const gastos = d.gastos.filter((g) => g.grupo_id === id)
  const pagos = d.pagos.filter((p) => p.grupo_id === id)
  const porMes = new Map<string, typeof gastos>()
  for (const g of gastos) {
    const m = g.fecha.slice(0, 7)
    porMes.set(m, [...(porMes.get(m) ?? []), g])
  }
  const nombre = (uid: string) => nombreDe(d.perfiles, uid, yo.id)

  return (
    <div className="contenido">
      <div className="cabeza">
        <Atras a={{ p: 'grupos' }} />
        <div className="crece">
          <h1>{grupo.nombre}</h1>
          <span className="sub">{miembros.map(nombre).join(', ')} · todos ven esto</span>
        </div>
      </div>
      <MensajeError texto={error ?? carga.error} />

      <div className="card pad">
        <span className="lbl">Saldos</span>
        {transf.length === 0 && <span className="suave">Están al día.</span>}
        {transf.map((t) => {
          const texto =
            t.de === yo.id ? (
              <>Le debés a {nombre(t.a)} <strong className="num debe">{colones(t.monto)}</strong></>
            ) : t.a === yo.id ? (
              <>{nombre(t.de)} te debe <strong className="num le-deben">{colones(t.monto)}</strong></>
            ) : (
              <>{nombre(t.de)} le debe a {nombre(t.a)} <strong className="num">{colones(t.monto)}</strong></>
            )
          return (
            <div key={`${t.de}-${t.a}`} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ flex: 1, fontSize: 16 }}>{texto}</span>
              <button className="btn chico borde" onClick={() => registrarPago(t)}>
                {t.a === yo.id ? 'Ya me pagó' : 'Registrar pago'}
              </button>
            </div>
          )
        })}
      </div>

      <button className="btn verde btn-ancho" onClick={() => ir({ p: 'gasto', grupoId: id, volver: { p: 'grupo', id } })}>
        <Icono n="mas" t={18} /> Agregar gasto compartido
      </button>

      {[...porMes.entries()].map(([mes, lista]) => (
        <div className="seccion" key={mes}>
          <div className="seccion-titulo">
            <span className="lbl">{nombreMes(mes)}</span>
            <span className="suave peq num">{colones(lista.reduce((s, g) => s + g.monto, 0))}</span>
          </div>
          <div className="card">
            {lista.map((g) => {
              const mia = g.partes.find((p) => p.user_id === yo.id)?.monto ?? 0
              return (
                <div className="fila" key={g.id}>
                  <div className={`av ${g.pagado_por === yo.id ? 'verde' : ''}`}>{inicial(nombre(g.pagado_por))}</div>
                  <div className="crece">
                    <span>{g.descripcion}</span>
                    <span className="suave peq">
                      {g.categoria} · {Number(g.fecha.slice(8))} {mesCorto(mes)} · pagó {nombre(g.pagado_por)} · {g.division === 'mitad' ? 'mitad y mitad' : g.division === 'partes' ? 'por partes' : 'solo de quien pagó'}
                    </span>
                  </div>
                  <div className="num" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span style={{ fontWeight: 500 }}>{colones(g.monto)}</span>
                    {g.division !== 'solo' && <span className="peq suave">su parte {colones(mia)}</span>}
                  </div>
                  <button className="btn peligro" aria-label={`Borrar ${g.descripcion}`} onClick={() => borrarGasto(g.id, g.descripcion)}>
                    <Icono n="basura" t={18} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {gastos.length === 0 && <div className="vacio">Todavía no hay gastos en este grupo.</div>}

      {pagos.length > 0 && (
        <div className="seccion">
          <span className="lbl">Pagos entre ustedes</span>
          <div className="card">
            {pagos.map((p) => (
              <div className="fila" key={p.id}>
                <div className="crece">
                  <span>{nombre(p.de)} → {nombre(p.a)}</span>
                  <span className="suave peq">{p.fecha}</span>
                </div>
                <span className="num">{colones(p.monto)}</span>
                <button
                  className="btn peligro"
                  aria-label="Borrar pago"
                  onClick={async () => {
                    if (!confirm('¿Borrar este pago?')) return
                    await supabase.from('pagos').delete().eq('id', p.id)
                    carga.recargar()
                  }}
                >
                  <Icono n="basura" t={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="seccion">
        <span className="lbl">Invitar</span>
        <form className="card" onSubmit={invitar}>
          <div className="form-fila" style={{ borderTop: 'none' }}>
            <input className="inp chico" type="email" placeholder="correo@ejemplo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} aria-label="Correo de la persona a invitar" />
            <button className="btn chico">Invitar</button>
          </div>
          {invitaciones.length > 0 && <div className="suave peq" style={{ padding: '0 16px 12px' }}>Pendientes: {invitaciones.join(', ')}</div>}
        </form>
        {aviso && <div className="aviso">{aviso}</div>}
      </div>

      <button className="btn peligro" onClick={salir}>Salir de este grupo</button>
    </div>
  )
}

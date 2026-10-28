import { useEffect } from 'react'
import { listar, where } from '../datos'
import { Cargando, Icono, MensajeError, cargarGrupos, inicial, nombreDe, useCarga, useSesion } from '../comun'
import { colones, mesDe, nombreMes } from '../dinero'
import type { Renglon } from '../tipos'
import { cargarVencimientos, ListaPagos } from './Pagos'
import { miSaldo, transferenciasDe } from './Grupos'

// Un aviso por día con lo vencido, lo de hoy y lo de mañana.
function avisar(pendientes: { nombre: string; dias: number; monto: number }[]) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (localStorage.getItem('avisos-activados') !== '1') return
    const hoy = new Date().toDateString()
    if (localStorage.getItem('ultimo-aviso') === hoy) return
    const urgentes = pendientes.filter((p) => p.dias <= 1)
    if (urgentes.length === 0) return
    localStorage.setItem('ultimo-aviso', hoy)
    new Notification('Pagos pendientes', {
      body: urgentes.map((p) => `${p.nombre} ${colones(p.monto)} · ${p.dias < 0 ? 'vencido' : p.dias === 0 ? 'hoy' : 'mañana'}`).join('\n'),
      icon: '/icon-192.png',
    })
  } catch {
    // Sin avisos en este navegador; la lista igual se ve en pantalla.
  }
}

export function Inicio() {
  const { yo, ir, salir } = useSesion()
  const mes = mesDe(new Date())
  const carga = useCarga(async () => {
    const [grupos, r, venc] = await Promise.all([
      cargarGrupos(),
      listar<Renglon>('renglones', where('mes', '==', mes)),
      cargarVencimientos(),
    ])
    return { grupos, renglones: r, venc }
  }, [mes])

  useEffect(() => {
    if (carga.datos) avisar(carga.datos.venc)
  }, [carga.datos])

  const d = carga.datos
  const entradas = d?.renglones.filter((r) => r.tipo === 'entrada').reduce((s, r) => s + Number(r.monto), 0) ?? 0
  const gasto = d?.renglones.filter((r) => r.tipo !== 'entrada').reduce((s, r) => s + Number(r.monto), 0) ?? 0
  const sobrante = entradas - gasto
  const uso = entradas > 0 ? Math.min(100, (gasto / entradas) * 100) : 0

  return (
    <div className="contenido">
      <div className="cabeza">
        <div className="crece">
          <span className="sub">{nombreMes(mes)}</span>
          <h1>Hola, {yo.nombre}</h1>
        </div>
        <button className="btn texto" onClick={salir}>Salir</button>
      </div>
      <MensajeError texto={carga.error} />
      {!d ? (
        <Cargando />
      ) : (
        <>
          <button className="hero" style={{ border: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => ir({ p: 'presupuesto' })}>
            <span style={{ fontSize: 13, opacity: 0.9 }}>{sobrante < 0 ? 'Se pasó este mes' : 'Le sobra este mes'}</span>
            <span className="grande num">{colones(sobrante)}</span>
            <div className="barra"><div style={{ width: `${uso}%` }} /></div>
            <div className="num" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, opacity: 0.9 }}>
              <span>Entró {colones(entradas)}</span>
              <span>Gastado {colones(gasto)}</span>
            </div>
          </button>

          {saldos()}

          <div className="seccion">
            <span className="lbl">Próximos pagos</span>
            <div className="card">
              <ListaPagos pagos={d.venc} max={3} />
              {d.venc.length > 3 && <button className="agregar" onClick={() => ir({ p: 'pagos' })}>Ver todos ({d.venc.length})</button>}
            </div>
          </div>

          <div className="seccion">
            <span className="lbl">Mis grupos</span>
            <div className="card">
              <button className="fila" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--linea2)', textAlign: 'left', cursor: 'pointer' }} onClick={() => ir({ p: 'presupuesto' })}>
                <div className="av verde">MP</div>
                <div className="crece">
                  <span style={{ fontWeight: 500 }}>Mi presupuesto</span>
                  <span className="suave peq">Solo usted · privado</span>
                </div>
                <span className="suave"><Icono n="candado" t={18} /></span>
              </button>
              {d.grupos.grupos.map((g) => {
                const s = miSaldo(d.grupos, g.id, yo.id)
                return (
                  <button key={g.id} className="fila" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--linea2)', textAlign: 'left', cursor: 'pointer' }} onClick={() => ir({ p: 'grupo', id: g.id })}>
                    <div className="av">{inicial(g.nombre)}</div>
                    <div className="crece">
                      <span style={{ fontWeight: 500 }}>{g.nombre}</span>
                      <span className="suave peq">
                        {d.grupos.miembros.filter((m) => m.grupo_id === g.id).map((m) => nombreDe(d.grupos.perfiles, m.user_id, yo.id)).join(', ')}
                      </span>
                    </div>
                    {Math.abs(s) >= 1 && <span className={`num peq ${s < 0 ? 'debe' : 'le-deben'}`} style={{ fontWeight: 500 }}>{s < 0 ? '−' : '+'}{colones(Math.abs(s))}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          <button className="btn btn-ancho" onClick={() => ir({ p: 'gasto', volver: { p: 'inicio' } })}>
            <Icono n="mas" t={18} /> Agregar gasto
          </button>
        </>
      )}
    </div>
  )

  function saldos() {
    if (!d) return null
    const lineas = d.grupos.grupos.flatMap((g) =>
      transferenciasDe(d.grupos, g.id)
        .filter((t) => t.de === yo.id || t.a === yo.id)
        .map((t) => ({ ...t, grupo: g })),
    )
    if (lineas.length === 0) return null
    return (
      <div className="seccion">
        <span className="lbl">Saldos</span>
        <div className="card">
          {lineas.map((t) => {
            const otro = t.de === yo.id ? t.a : t.de
            const nombre = nombreDe(d.grupos.perfiles, otro, yo.id)
            return (
              <button key={`${t.grupo.id}-${otro}`} className="fila" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--linea2)', textAlign: 'left', cursor: 'pointer' }} onClick={() => ir({ p: 'grupo', id: t.grupo.id })}>
                <div className="av">{inicial(nombre)}</div>
                <div className="crece">
                  <span>{t.de === yo.id ? `Le debés a ${nombre}` : `${nombre} te debe`}</span>
                  <span className="suave peq">{t.grupo.nombre}</span>
                </div>
                <strong className={`num ${t.de === yo.id ? 'debe' : 'le-deben'}`}>{colones(t.monto)}</strong>
              </button>
            )
          })}
        </div>
      </div>
    )
  }
}

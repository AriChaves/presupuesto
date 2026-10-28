# Presupuesto

App web instalable en el celular para llevar el presupuesto personal y los gastos compartidos (pareja, familia).

- **Mi presupuesto** (privado): entradas, gastos fijos con check y día de vencimiento, gastos extras, pases, sobres por cuenta.
- **Grupos**: gastos compartidos con quién pagó y cómo se divide (mitad, por partes o solo de quien pagó), saldos y "ya me pagó". Los miembros ven solo el grupo, nunca el presupuesto personal del otro.
- **Cuentas y plantillas**: tarjetas, efectivo, sobres y gastos fijos, todo editable.
- **Préstamos y pagos**: próximos vencimientos, préstamos que debo o me deben, avisos.

## Qué tiene que crear: Supabase (gratis)

1. Entre a <https://supabase.com> y cree una cuenta.
2. **New project**: nombre `presupuesto`, invente una contraseña para la base de datos (guárdela) y escoja la región más cercana (por ejemplo *East US*). Espere un par de minutos a que termine.
3. Menú izquierdo → **SQL Editor** → **New query**. Pegue todo el archivo [`supabase/schema.sql`](supabase/schema.sql) y toque **Run**. Debe decir *Success*.
4. Menú **Authentication** → **Sign In / Providers** → **Email**: déjelo activo. Para probar más rápido puede apagar **Confirm email**; si lo deja encendido, cada persona confirma su correo al crear la cuenta.
5. **Project Settings** → **API Keys** (o **Data API**): copie la **Project URL** y la clave **anon / public**.
6. En esta carpeta, copie `.env.example` como `.env.local` y pegue esos dos datos.

> La clave *anon* puede ir en la app: los permisos de la base de datos (RLS) son los que protegen los datos. **Nunca** use ni comparta la clave *service_role*.

## Correr la app en su compu

```bash
npm install
npm run dev -- --host
```

Abra la dirección que sale (`http://localhost:5173`). Para probarla en el celular, conéctelo al mismo wifi y abra la dirección *Network* que muestra la terminal.

## Primeros pasos dentro de la app

1. **Crear cuenta** con su nombre y correo.
2. **Presupuesto → Editar cuentas, sobres y plantillas**: agregue sus tarjetas, sus sobres y sus entradas/gastos fijos de cada mes.
3. **Presupuesto**: toque *Llenar con mis entradas y gastos fijos* para armar el mes.
4. **Grupos → Crear** "Pareja" e invite el correo de Fabi. Cuando Fabi cree su cuenta con ese correo, aparece en el grupo.

## Pendiente para la próxima versión

- Cuadre con el banco (subir el CSV del BN).
- Avisos con la app cerrada (ahora el aviso sale al abrir la app).
- Publicarla en internet (Vercel o Netlify) para usarla sin la compu.

## Comandos

- `npm run dev` — app en modo desarrollo
- `npm test` — pruebas de los cálculos (división de gastos, saldos, vencimientos)
- `npm run build` — versión final en `dist/`

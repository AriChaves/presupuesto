# Presupuesto

App web instalable en el celular para llevar el presupuesto personal y los gastos compartidos (pareja, familia).

- **Mi presupuesto** (privado): entradas, gastos fijos con check y día de vencimiento, gastos extras, pases, sobres por cuenta.
- **Grupos**: gastos compartidos con quién pagó y cómo se divide (mitad, por partes o solo de quien pagó), saldos y "ya me pagó". Los miembros ven solo el grupo, nunca el presupuesto personal del otro.
- **Cuentas y plantillas**: tarjetas, efectivo, sobres y gastos fijos, todo editable.
- **Préstamos y pagos**: próximos vencimientos, préstamos que debo o me deben, avisos.

## Qué tiene que crear: Firebase (gratis)

Se usa el plan gratis de Firebase (Spark): cuentas de usuario y base de datos Firestore. No pide tarjeta.

1. Entre a <https://console.firebase.google.com> con su cuenta de Google y toque **Crear un proyecto**. Nombre: `presupuesto`. Google Analytics puede apagarlo.
2. **Cuentas:** menú izquierdo → **Compilación → Authentication** → **Comenzar** → **Correo electrónico/contraseña** → actívelo → **Guardar**.
3. **Base de datos:** **Compilación → Firestore Database** → **Crear base de datos** → ubicación cercana (por ejemplo `nam5` o `us-east1`) → **modo de producción** → **Crear**.
4. **Privacidad:** dentro de Firestore, pestaña **Reglas**. Borre lo que haya, pegue todo el archivo [`firestore.rules`](firestore.rules) y toque **Publicar**. Estas reglas hacen que su presupuesto lo vea solo usted y cada grupo solo sus miembros.
5. **Datos de conexión:** ⚙ junto a "Descripción general del proyecto" → **Configuración del proyecto** → abajo, en **Tus apps**, toque el ícono **`</>`** (web). Apodo `presupuesto` → **Registrar app** (no hace falta Hosting todavía). Le muestra un bloque `firebaseConfig`.
6. En esta carpeta, copie `.env.example` como `.env.local` y pegue `apiKey`, `authDomain`, `projectId` y `appId` de ese bloque.

> El `apiKey` de Firebase no es secreto: va dentro de la app. Lo que protege los datos son las reglas del paso 4.

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
- Publicarla en internet (Firebase Hosting, también gratis) para usarla sin la compu.

## APK para Android

La app de Android es la misma app web dentro de Capacitor (carpeta `android/`).

```bash
npm run build:android
```

```bash
cd android && set JAVA_HOME=C:\Users\Ari\.jdks\jbr-21.0.11 && gradlew.bat assembleDebug
```

El APK sale en `android/app/build/outputs/apk/debug/app-debug.apk`. Usa Java 21: con el Java 25 de Android Studio, Gradle falla con *"Unsupported class file major version 69"*.

Para instalarlo, páselo al celular y ábralo; Android pide permitir "instalar apps de origen desconocido" la primera vez.

## Comandos

- `npm run dev` — app en modo desarrollo
- `npm test` — pruebas de los cálculos (división de gastos, saldos, vencimientos)
- `npm run build` — versión final en `dist/`

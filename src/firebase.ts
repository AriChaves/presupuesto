import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const configurado = Object.values(config).every(Boolean)

const app = initializeApp(configurado ? config : { apiKey: 'sin-configurar', projectId: 'sin-configurar', appId: 'sin-configurar' })
export const auth = getAuth(app)
// Guarda una copia en el celular para que abra rápido y funcione sin señal.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })

// Mensajes de Firebase en palabras claras.
export function mensaje(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  const textos: Record<string, string> = {
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/wrong-password': 'Correo o contraseña incorrectos.',
    'auth/user-not-found': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ese correo ya tiene cuenta. Toque "Entrar".',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/invalid-email': 'Ese correo no es válido.',
    'auth/network-request-failed': 'No se pudo conectar. Revise el internet.',
    'auth/too-many-requests': 'Demasiados intentos. Espere un momento y pruebe de nuevo.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase no está bien configurado: revise los datos en .env.local.',
    'auth/invalid-api-key': 'Firebase no está bien configurado: revise los datos en .env.local.',
    'auth/operation-not-allowed': 'Falta activar "Correo electrónico/contraseña" en Firebase → Authentication.',
    'auth/configuration-not-found': 'Falta activar "Correo electrónico/contraseña" en Firebase → Authentication.',
    'permission-denied': 'No tiene permiso para eso. ¿Ya publicó las reglas de Firestore?',
    unavailable: 'No se pudo conectar. Revise el internet.',
  }
  return textos[code] ?? (e as Error)?.message ?? String(e)
}

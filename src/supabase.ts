import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configurado = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'sin-configurar')

// Lanza el error de Supabase para que la pantalla lo muestre.
export function revisar<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

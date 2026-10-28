import type { CapacitorConfig } from '@capacitor/cli'

// App de Android: envuelve la app web compilada en dist/.
const config: CapacitorConfig = {
  appId: 'com.arianna.presupuesto',
  appName: 'Presupuesto',
  webDir: 'dist',
  android: { backgroundColor: '#F5F6F2' },
}

export default config

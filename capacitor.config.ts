import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.fluenta.client',
  appName: 'Fluenta',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0b0d13',
  },
  server: {
    androidScheme: 'https',
  },
}

export default config

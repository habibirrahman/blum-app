import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'id.simpul.blum',
  appName: 'Blum ABA',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    Camera: {
      permissions: ['camera', 'photos']
    }
  }
}

export default config

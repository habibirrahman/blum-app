// src/composables/useDevicePayload.ts
import { Device } from '@capacitor/device'
import { getDeviceId } from './use-device-id'
import type { ActiveDevice, DeviceDetailsInput } from '@/lib/types'

export interface DevicePayload {
  app_type: ActiveDevice['app_type']
  device_type: ActiveDevice['device_type']
  device_id: ActiveDevice['device_id']
  device_details: DeviceDetailsInput
}

export async function buildDevicePayload(): Promise<DevicePayload> {
  const [device_id, info] = await Promise.all([getDeviceId(), Device.getInfo()])

  const OS: Record<string, string> = {
    ios: 'iOS',
    android: 'Android',
    windows: 'Windows'
  }

  return {
    app_type: 'mobile_app',
    device_type: 'mobile',
    device_id,
    device_details: {
      device_name: [info.manufacturer, info.model].filter(Boolean).join(' ').trim(),
      os_name: OS[info.operatingSystem] || info.operatingSystem,
      os_version: info.osVersion,
      browser_name: '',
      browser_version: ''
    }
  }
}

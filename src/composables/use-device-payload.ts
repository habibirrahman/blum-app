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

  return {
    app_type: 'mobile_app',
    device_type: 'mobile',
    device_id,
    device_details: {
      // iOS mengirim "iPhone15,2" — server yang memetakan ke nama pasaran
      device_name: [info.manufacturer, info.model].filter(Boolean).join(' ').trim(),
      os_name: info.operatingSystem, // 'ios' | 'android'
      os_version: info.osVersion, // string, mis. "17.2"
      browser_name: '',
      browser_version: ''
    }
  }
}

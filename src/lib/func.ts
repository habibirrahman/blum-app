import moment from 'moment'
import type { ClientDischargeReason, MeasurementType, TargetType, User } from './types'

interface DisplayDate {
  date?: string | null
  format?: string
  empty?: string
}

export const displayDate = ({ date, format = 'DD/MM/YYYY', empty = '' }: DisplayDate): string => {
  if (!date) return empty
  return moment(new Date(date)).format(format)
}

export const getMeasurementType = (type?: MeasurementType): string => {
  if (!type) return ''
  const arr: { [key: string]: string } = {
    'Measurement::Duration': 'Duration',
    'Measurement::Frequency': 'Frequency',
    'Measurement::Latency': 'Latency',
    'Measurement::Percentage': 'Percentage',
    'Measurement::Pir': 'Partial Interval Recording',
    'Measurement::Probing': 'Probing',
    'Measurement::Prompting': 'Prompting',
    'Measurement::Sbt': 'Skill-Based Treatment (SBT)',
    'Measurement::TrialByTrial': 'Trial-by-Trial'
  }
  return arr[type] || ''
}

export const getTargetType = (type?: TargetType): string => {
  if (!type) return ''
  const arr: { [key: string]: string } = {
    'Target::ColdProbe': 'Cold Probe',
    'Target::Duration': 'Duration',
    'Target::Frequency': 'Frequency',
    'Target::Latency': 'Latency',
    'Target::Percentage': 'Percentage',
    'Target::Pir': 'Partial Interval Recording',
    'Target::Prompting': 'Prompting',
    'Target::Sbt': 'Skill-Based Treatment (SBT)',
    'Target::TrialByTrial': 'Trial-by-Trial'
  }
  return arr[type] || ''
}

export const getClientDischargeReason = (reason?: ClientDischargeReason): string => {
  if (!reason) return ''
  const arr: { [key: string]: string } = {
    graduated: 'Graduated',
    family_or_personal_issues: 'Family/personal issue',
    expectations_did_not_match: "Expectations didn't match",
    schedule_conflict: 'Schedule conflict',
    moving: 'Moving',
    too_expensive: 'Too expensive',
    other: 'Other'
  }
  return arr[reason] || ''
}

export const getUserRole = (role?: User['role']): string => {
  if (!role) return ''
  const arr: { [key: string]: string } = {
    admin: 'Admin',
    staff: 'Therapist'
  }
  return arr[role] || ''
}

export const getRandomString = (prefix = '', length = 16): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let combination = ''
  for (let i = 0; i < length; i++) {
    combination += chars[Math.round(Math.random() * chars.length)]
  }
  if (prefix) return `${prefix}-${combination}`
  return combination
}

export const onlyUniqueId = (value: any, index: number, array: any[]) => {
  return array.map((i) => i.id).indexOf(value.id) === index
}

export const getErrorMessage = (value: any = '') => {
  function concatObjectKeyValue(obj: any): string[] {
    const result = []
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const temp = obj[key]
        if (typeof temp === 'object') {
          result.push(concatObjectKeyValue(obj[key]))
        } else {
          const k = Number(key)
          if (!isNaN(k)) result.push(obj[key])
          else result.push(`${key} ${obj[key]}`)
        }
      }
    }
    return result
  }
  return typeof value === 'object' ? concatObjectKeyValue(value).join(', ') : value
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>

  return function (...args: Parameters<T>) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}

import moment from 'moment'
import type { MeasurementType, TargetType } from './types'

interface DisplayDate {
  date?: string | null
  format?: string
  empty?: string
}

export const displayDate = ({ date, format = 'DD/MM/YYYY', empty = '' }: DisplayDate) => {
  if (!date) return empty
  return moment(date).format(format)
}

export const getMeasurementType = (type?: MeasurementType) => {
  if (!type) return ''
  const arr: { [key: string]: string } = {
    'Measurement::Duration': 'Duration',
    'Measurement::Frequency': 'Frequency',
    'Measurement::Percentage': 'Percentage',
    'Measurement::Pir': 'Partial interval recording',
    'Measurement::Probing': 'Probing',
    'Measurement::Prompting': 'Prompting'
  }
  return arr[type] || ''
}

export const getTargetType = (type?: TargetType) => {
  if (!type) return ''
  const arr: { [key: string]: string } = {
    'Target::Duration': 'Duration',
    'Target::Frequency': 'Frequency',
    'Target::Percentage': 'Percentage',
    'Target::Pir': 'Partial interval recording',
    'Target::Prompting': 'Prompting'
  }
  return arr[type] || ''
}

export const getRandomString = (prefix = '', length = 16) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let combination = ''
  for (let i = 0; i < length; i++) {
    combination += chars[Math.round(Math.random() * chars.length)]
  }
  return `${prefix}${combination}`
}

export const onlyUniqueId = (value: any, index: number, array: any[]) => {
  return array.map((i) => i.id).indexOf(value.id) === index
}

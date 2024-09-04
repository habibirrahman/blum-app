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

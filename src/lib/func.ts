import moment from 'moment'

interface DisplayDate {
  date?: string | null
  format?: string
  empty?: string
}

export const displayDate = ({ date, format = 'DD/MM/YYYY', empty = '' }: DisplayDate) => {
  if (!date) return empty
  return moment(date).format(format)
}

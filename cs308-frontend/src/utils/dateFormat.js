const pad = (value) => String(value).padStart(2, '0')

const parseDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatDisplayDate = (value, fallback = 'Unknown date') => {
  const date = parseDate(value)
  if (!date) return fallback

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

export const formatDisplayDateTime = (value, fallback = 'Unknown date') => {
  const date = parseDate(value)
  if (!date) return fallback

  return `${formatDisplayDate(date, fallback)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

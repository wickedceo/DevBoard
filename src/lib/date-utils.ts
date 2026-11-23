export function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseDateKey(value: string) {
  if (!value || value === 'Not scheduled') return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null
    }

    return getLocalDateKey(date)
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : getLocalDateKey(date)
}

export function isDateBeforeToday(value: string, now: Date) {
  const dateKey = parseDateKey(value)
  return dateKey !== null && dateKey < getLocalDateKey(now)
}

const padNumber = (value) => String(value).padStart(2, '0')

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const roundMoney = (value) => Number(Number(value || 0).toFixed(2))

const roundAxisNumber = (value) => Number(Number(value || 0).toFixed(6))

export const parseUtcDateInput = (value) => {
  if (!value) return null

  const [year, month, day] = String(value)
    .split('-')
    .map((part) => Number(part))

  if (!year || !month || !day) return null

  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

export const toUtcDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''

  const year = date.getUTCFullYear()
  const month = padNumber(date.getUTCMonth() + 1)
  const day = padNumber(date.getUTCDate())

  return `${year}-${month}-${day}`
}

export const addUtcDays = (date, days) => {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export const addUtcMonths = (date, months) => {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

export const getStartOfUtcWeek = (date) => {
  const dayOfWeek = (date.getUTCDay() + 6) % 7
  return addUtcDays(date, -dayOfWeek)
}

const getStartOfUtcMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))

const getEndOfUtcMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))

const formatUtcDisplayDate = (date) =>
  `${padNumber(date.getUTCDate())}.${padNumber(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`

const formatDateRange = (startDate, endDate) => {
  if (toUtcDateInput(startDate) === toUtcDateInput(endDate)) {
    return formatUtcDisplayDate(startDate)
  }

  return `${formatUtcDisplayDate(startDate)} - ${formatUtcDisplayDate(endDate)}`
}

const getBucketKey = (date, granularity) => {
  if (granularity === 'week') return toUtcDateInput(getStartOfUtcWeek(date))
  if (granularity === 'month') return toUtcDateInput(getStartOfUtcMonth(date))
  return toUtcDateInput(date)
}

const createDayBuckets = (startDate, endDate) => {
  const buckets = []

  for (let cursor = startDate; cursor <= endDate; cursor = addUtcDays(cursor, 1)) {
    buckets.push({
      key: toUtcDateInput(cursor),
      label: formatUtcDisplayDate(cursor),
      rangeLabel: formatUtcDisplayDate(cursor),
      revenue: 0,
      refunds: 0,
      costOfGoods: 0,
      profitLoss: 0,
      discountLoss: 0,
      orders: 0,
      itemsSold: 0,
    })
  }

  return buckets
}

const createWeekBuckets = (startDate, endDate) => {
  const buckets = []

  for (let cursor = getStartOfUtcWeek(startDate); cursor <= endDate; cursor = addUtcDays(cursor, 7)) {
    const periodStart = cursor
    const periodEnd = addUtcDays(cursor, 6)
    const visibleStart = startDate > periodStart ? startDate : periodStart
    const visibleEnd = endDate < periodEnd ? endDate : periodEnd

    buckets.push({
      key: toUtcDateInput(periodStart),
      label: formatDateRange(visibleStart, visibleEnd),
      rangeLabel: `Week of ${formatUtcDisplayDate(visibleStart)}`,
      revenue: 0,
      refunds: 0,
      costOfGoods: 0,
      profitLoss: 0,
      discountLoss: 0,
      orders: 0,
      itemsSold: 0,
    })
  }

  return buckets
}

const createMonthBuckets = (startDate, endDate) => {
  const buckets = []

  for (let cursor = getStartOfUtcMonth(startDate); cursor <= endDate; cursor = addUtcMonths(cursor, 1)) {
    const periodStart = cursor
    const periodEnd = getEndOfUtcMonth(cursor)
    const visibleStart = startDate > periodStart ? startDate : periodStart
    const visibleEnd = endDate < periodEnd ? endDate : periodEnd
    const fullMonthLabel = formatDateRange(periodStart, periodEnd)

    buckets.push({
      key: toUtcDateInput(periodStart),
      label: fullMonthLabel,
      rangeLabel:
        toUtcDateInput(visibleStart) === toUtcDateInput(periodStart) &&
        toUtcDateInput(visibleEnd) === toUtcDateInput(periodEnd)
          ? fullMonthLabel
          : `${fullMonthLabel} (${formatDateRange(visibleStart, visibleEnd)})`,
      revenue: 0,
      refunds: 0,
      costOfGoods: 0,
      profitLoss: 0,
      discountLoss: 0,
      orders: 0,
      itemsSold: 0,
    })
  }

  return buckets
}

const createBuckets = (startDate, endDate, granularity) => {
  if (granularity === 'week') return createWeekBuckets(startDate, endDate)
  if (granularity === 'month') return createMonthBuckets(startDate, endDate)
  return createDayBuckets(startDate, endDate)
}

export const buildFinancialChartPoints = (
  dailyPoints = [],
  startDateValue,
  endDateValue,
  granularity = 'day'
) => {
  const startDate = parseUtcDateInput(startDateValue)
  const endDate = parseUtcDateInput(endDateValue)

  if (!startDate || !endDate || startDate > endDate) return []

  const buckets = createBuckets(startDate, endDate, granularity)
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]))

  dailyPoints.forEach((point) => {
    const pointDate = parseUtcDateInput(point?.date)

    if (!pointDate || pointDate < startDate || pointDate > endDate) return

    const bucket = bucketMap.get(getBucketKey(pointDate, granularity))
    if (!bucket) return

    bucket.revenue += Number(point?.revenue || 0)
    bucket.refunds += Number(point?.refunds || 0)
    bucket.costOfGoods += Number(point?.costOfGoods || 0)
    bucket.profitLoss += Number(point?.profitLoss || 0)
    bucket.discountLoss += Number(point?.discountLoss || 0)
    bucket.orders += Number(point?.orders || 0)
    bucket.itemsSold += Number(point?.itemsSold || 0)
  })

  return buckets.map((bucket) => ({
    ...bucket,
    revenue: roundMoney(bucket.revenue),
    refunds: roundMoney(bucket.refunds),
    costOfGoods: roundMoney(bucket.costOfGoods),
    profitLoss: roundMoney(bucket.profitLoss),
    discountLoss: roundMoney(bucket.discountLoss),
  }))
}

const niceNumber = (value, round) => {
  if (!Number.isFinite(value) || value <= 0) return 1

  const exponent = Math.floor(Math.log10(value))
  const fraction = value / 10 ** exponent
  let niceFraction = 1

  if (round) {
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 3) niceFraction = 2
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else {
    if (fraction <= 1) niceFraction = 1
    else if (fraction <= 2) niceFraction = 2
    else if (fraction <= 5) niceFraction = 5
    else niceFraction = 10
  }

  return niceFraction * 10 ** exponent
}

export const buildAxisScale = (values = [], tickCount = 6) => {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))

  if (numericValues.length === 0) {
    return { min: 0, max: 1, step: 0.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] }
  }

  let minValue = Math.min(...numericValues, 0)
  let maxValue = Math.max(...numericValues, 0)

  if (minValue === maxValue) {
    if (minValue === 0) {
      maxValue = 1
    } else {
      const padding = Math.abs(minValue) * 0.2 || 1
      minValue = Math.min(0, minValue - padding)
      maxValue += padding
    }
  }

  const range = niceNumber(maxValue - minValue, false)
  const step = niceNumber(range / Math.max(tickCount - 1, 1), true)
  const min = Math.floor(minValue / step) * step
  const max = Math.ceil(maxValue / step) * step
  const ticks = []

  for (let value = min; value <= max + step / 2; value += step) {
    ticks.push(roundAxisNumber(value))
  }

  return {
    min: roundAxisNumber(min),
    max: roundAxisNumber(max),
    step: roundAxisNumber(step),
    ticks,
  }
}

const trimTrailingZeros = (value) => String(value).replace(/\.0$/, '').replace(/(\.\d*[1-9])0+$/, '$1')

export const formatAxisCurrency = (value) => {
  const numericValue = Number(value || 0)
  const absoluteValue = Math.abs(numericValue)
  const prefix = numericValue < 0 ? '-' : ''

  if (absoluteValue >= 1_000_000) {
    const scaled = absoluteValue / 1_000_000
    return `${prefix}$${trimTrailingZeros(scaled.toFixed(scaled >= 10 ? 0 : 1))}M`
  }

  if (absoluteValue >= 1_000) {
    const scaled = absoluteValue / 1_000
    return `${prefix}$${trimTrailingZeros(scaled.toFixed(scaled >= 10 ? 0 : 1))}k`
  }

  return `${prefix}$${Math.round(absoluteValue)}`
}

export const getLabelStep = (count, maxLabels = 8) => {
  if (count <= maxLabels) return 1
  return clamp(Math.ceil(count / maxLabels), 1, count)
}

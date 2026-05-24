<template>
  <div class="financial-report-page">
    <div class="mb-6">
      <p class="text-sm font-semibold text-orange-600 mb-2">Reports</p>
      <h1 class="text-3xl font-bold text-gray-900">Financial Report</h1>
      <p class="text-gray-600 mt-2">
        Calculate revenue, discount loss, and estimated profit/loss by paid order date.
      </p>
    </div>

    <section class="no-print mb-6 rounded-3xl border border-gray-200 bg-white p-5">
      <div class="grid gap-4 md:items-end md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto_auto]">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            Start Date
          </label>
          <input
            v-model="filters.startDate"
            type="date"
            class="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">
            End Date
          </label>
          <input
            v-model="filters.endDate"
            type="date"
            class="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500"
          />
        </div>

        <button
          type="button"
          @click="toggleChartSortOrder"
          class="self-end inline-flex items-center justify-center gap-1.5 rounded-2xl border border-gray-300 bg-white px-2.5 py-3 text-sm font-semibold text-gray-700 transition hover:border-orange-300 hover:text-orange-600"
          :aria-label="`Sort daily totals by time: ${chartSortOrderLabel}`"
          :title="`Sort daily totals by time: ${chartSortOrderLabel}`"
        >
          <span class="flex items-center gap-1" aria-hidden="true">
            <svg
              viewBox="0 0 20 20"
              fill="none"
              class="h-4 w-4 transition"
              :class="chartSortOrder === 'asc' ? 'text-orange-500' : 'text-gray-400'"
            >
              <path
                d="M10 15V5m0 0-4 4m4-4 4 4"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              class="h-4 w-4 transition"
              :class="chartSortOrder === 'desc' ? 'text-orange-500' : 'text-gray-400'"
            >
              <path
                d="M10 5v10m0 0-4-4m4 4 4-4"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.8"
              />
            </svg>
          </span>
          <span class="hidden sm:inline">{{ chartSortOrderLabel }}</span>
        </button>

        <button
          type="button"
          @click="loadReport"
          :disabled="loading"
          class="self-end rounded-2xl bg-slate-900 px-3 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {{ loading ? 'Loading...' : 'Apply' }}
        </button>

        <button
          type="button"
          @click="printReport"
          class="self-end rounded-2xl bg-gray-100 px-3 py-3 font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          Print
        </button>
      </div>

      <p v-if="error" class="mt-3 text-sm text-red-600">
        {{ error }}
      </p>
    </section>

    <section class="mb-6 grid gap-4 md:grid-cols-4">
      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm text-gray-500">Revenue</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">
          {{ formatCurrency(report.revenue) }}
        </p>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm text-gray-500">Discount Loss</p>
        <p class="mt-2 text-2xl font-bold text-red-600">
          {{ formatCurrency(report.discountLoss) }}
        </p>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm text-gray-500">Profit / Loss</p>
        <p
          class="mt-2 text-2xl font-bold"
          :class="report.estimatedProfit >= 0 ? 'text-emerald-700' : 'text-red-600'"
        >
          {{ formatCurrency(report.estimatedProfit) }}
        </p>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm text-gray-500">Orders / Items</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">
          {{ report.orderCount }} / {{ report.itemsSold }}
        </p>
      </div>
    </section>

    <section class="rounded-3xl border border-gray-200 bg-white p-6">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Revenue and Profit/Loss Chart</h2>
          <p class="mt-1 text-sm text-gray-500">
            Daily totals for {{ filters.startDate }} to {{ filters.endDate }}
          </p>
        </div>

        <div class="flex gap-4 text-sm">
          <span class="flex items-center gap-2 text-gray-600">
            <span class="h-3 w-3 rounded-full bg-emerald-500"></span>
            Revenue
          </span>
          <span class="flex items-center gap-2 text-gray-600">
            <span class="h-3 w-3 rounded-full bg-slate-900"></span>
            Profit/Loss
          </span>
          <span class="flex items-center gap-2 text-gray-600">
            <span class="h-3 w-3 rounded-full bg-red-500"></span>
            Discount loss
          </span>
        </div>
      </div>

      <div
        v-if="loading"
        class="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-gray-500"
      >
        Loading report...
      </div>

      <div
        v-else-if="report.chart.length === 0"
        class="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-gray-500"
      >
        No paid orders found for this date range.
      </div>

      <div v-else class="space-y-5">
        <div
          v-for="point in sortedChart"
          :key="point.date"
          class="rounded-2xl border border-gray-100 p-4"
        >
          <div class="mb-3 flex items-center justify-between gap-4">
            <p class="font-semibold text-gray-900">{{ point.date }}</p>
            <p class="text-sm text-gray-500">
              {{ point.orders }} order{{ point.orders === 1 ? '' : 's' }}
              · {{ point.itemsSold }} item{{ point.itemsSold === 1 ? '' : 's' }}
            </p>
          </div>

          <div class="space-y-3">
            <div>
              <div class="mb-1 flex justify-between text-xs text-gray-500">
                <span>Revenue</span>
                <span>{{ formatCurrency(point.revenue) }}</span>
              </div>
              <div class="h-4 overflow-hidden rounded-full bg-gray-100">
                <div
                  class="h-full rounded-full bg-emerald-500"
                  :style="{ width: getChartWidth(point.revenue) }"
                />
              </div>
            </div>

            <div>
              <div class="mb-1 flex justify-between text-xs text-gray-500">
                <span>Profit / Loss</span>
                <span>{{ formatCurrency(point.estimatedProfit) }}</span>
              </div>
              <div class="h-4 overflow-hidden rounded-full bg-gray-100">
                <div
                  class="h-full rounded-full"
                  :class="point.estimatedProfit >= 0 ? 'bg-slate-900' : 'bg-red-600'"
                  :style="{ width: getChartWidth(Math.abs(point.estimatedProfit)) }"
                />
              </div>
            </div>

            <div>
              <div class="mb-1 flex justify-between text-xs text-gray-500">
                <span>Discount loss</span>
                <span>{{ formatCurrency(point.discountLoss) }}</span>
              </div>
              <div class="h-4 overflow-hidden rounded-full bg-gray-100">
                <div
                  class="h-full rounded-full bg-red-500"
                  :style="{ width: getChartWidth(point.discountLoss) }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getSalesReport } from '../../api/invoiceApi'

const toDateInput = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const today = new Date()
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

const filters = ref({
  startDate: toDateInput(firstDayOfMonth),
  endDate: toDateInput(today),
})
const report = ref({
  revenue: 0,
  discountLoss: 0,
  estimatedProfit: 0,
  orderCount: 0,
  itemsSold: 0,
  chart: [],
})
const loading = ref(false)
const error = ref('')
const chartSortOrder = ref('asc')

const requestParams = computed(() => ({
  startDate: filters.value.startDate,
  endDate: filters.value.endDate,
}))

const chartSortOrderLabel = computed(() =>
  chartSortOrder.value === 'asc' ? 'Oldest first' : 'Newest first'
)

const sortedChart = computed(() => {
  return [...report.value.chart].sort((left, right) => {
    const leftTime = new Date(left.date).getTime()
    const rightTime = new Date(right.date).getTime()
    const fallbackCompare = String(left.date || '').localeCompare(String(right.date || ''))

    if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
      return chartSortOrder.value === 'asc' ? fallbackCompare : -fallbackCompare
    }

    return chartSortOrder.value === 'asc'
      ? leftTime - rightTime
      : rightTime - leftTime
  })
})

const maxChartValue = computed(() => {
  const values = report.value.chart.flatMap((point) => [
    Number(point.revenue || 0),
    Math.abs(Number(point.estimatedProfit || 0)),
    Number(point.discountLoss || 0),
  ])

  return Math.max(...values, 1)
})

const loadReport = async () => {
  loading.value = true
  error.value = ''

  try {
    const res = await getSalesReport(requestParams.value)

    report.value = res.data?.summary || {
      revenue: 0,
      discountLoss: 0,
      estimatedProfit: 0,
      orderCount: 0,
      itemsSold: 0,
      chart: [],
    }
  } catch (err) {
    error.value =
      err?.response?.data?.message ||
      'Failed to load financial report'
  } finally {
    loading.value = false
  }
}

const formatCurrency = (value) => {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const getChartWidth = (value) => {
  const width = Math.round((Number(value || 0) / maxChartValue.value) * 100)
  return `${Math.max(width, Number(value || 0) > 0 ? 4 : 0)}%`
}

const toggleChartSortOrder = () => {
  chartSortOrder.value = chartSortOrder.value === 'asc' ? 'desc' : 'asc'
}

const printReport = () => {
  window.print()
}

onMounted(loadReport)
</script>

<style scoped>
@media print {
  .no-print {
    display: none !important;
  }

  .financial-report-page {
    color: #111827;
  }
}
</style>

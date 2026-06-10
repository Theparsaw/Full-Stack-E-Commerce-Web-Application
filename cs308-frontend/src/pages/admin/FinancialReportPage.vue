<template>
  <div class="financial-report-page">
    <div class="mb-6">
      <p class="mb-2 text-sm font-semibold text-orange-600">Reports</p>
      <h1 class="text-3xl font-bold text-gray-900">Financial Report</h1>
      <p class="mt-2 max-w-3xl text-gray-600">
        Calculate revenue and profit/loss from paid sales, approved refunds, and product costs.
      </p>
    </div>

    <section class="no-print mb-6 rounded-3xl border border-gray-200 bg-white p-5">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
            Start Date
          </label>
          <input
            v-model="filters.startDate"
            type="date"
            class="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium text-slate-700">
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
          @click="loadReport"
          :disabled="loading"
          class="self-end rounded-2xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ loading ? 'Loading...' : 'Apply' }}
        </button>

        <button
          type="button"
          @click="printReport"
          class="self-end rounded-2xl bg-gray-100 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          Print
        </button>
      </div>

      <div class="mt-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p class="mb-2 text-sm font-medium text-slate-700">Group Chart By</p>
          <div class="inline-flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-1">
            <button
              v-for="option in granularityOptions"
              :key="option.value"
              type="button"
              @click="chartGranularity = option.value"
              class="rounded-2xl px-4 py-2 text-sm font-semibold transition"
              :class="
                chartGranularity === option.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              "
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div>
          <p class="mb-2 text-sm font-medium text-slate-700">Chart Type</p>
          <div class="inline-flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-1">
            <button
              v-for="option in chartTypeOptions"
              :key="option.value"
              type="button"
              @click="chartType = option.value"
              class="rounded-2xl px-4 py-2 text-sm font-semibold transition"
              :class="
                chartType === option.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              "
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <p v-if="error" class="mt-3 text-sm text-red-600">
        {{ error }}
      </p>
    </section>

    <section class="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm font-medium text-gray-500">Gross Sales Revenue</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">
          {{ formatCurrency(report.grossRevenue) }}
        </p>
        <p class="mt-1 text-xs text-gray-400">Paid sales before refunds</p>
      </div>

      <div class="rounded-2xl border border-red-100 bg-red-50 p-5">
        <p class="text-sm font-medium text-red-600">Approved Refunds</p>
        <p class="mt-2 text-2xl font-bold text-red-700">
          − {{ formatCurrency(report.refunds) }}
        </p>
        <p class="mt-1 text-xs text-red-400">Refunds resolved during the selected period</p>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm font-medium text-gray-500">Net Revenue</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">{{ formatCurrency(report.revenue) }}</p>
        <p class="mt-1 text-xs text-gray-400">Gross sales minus approved refunds</p>
      </div>

      <div class="rounded-2xl border border-amber-100 bg-amber-50 p-5">
        <p class="text-sm font-medium text-amber-700">Cost of Goods Sold</p>
        <p class="mt-2 text-2xl font-bold text-amber-800">{{ formatCurrency(report.costOfGoods) }}</p>
        <p class="mt-1 text-xs text-amber-600">Product costs, reversed for refunded items</p>
      </div>

      <div
        class="rounded-2xl border p-5"
        :class="report.profitLoss >= 0
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-red-200 bg-red-50'"
      >
        <div class="flex items-center gap-2">
          <span
            class="rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
            :class="report.profitLoss >= 0
              ? 'bg-emerald-200 text-emerald-800'
              : 'bg-red-200 text-red-800'"
          >
            {{ report.profitLoss >= 0 ? '▲ Profit' : '▼ Loss' }}
          </span>
        </div>
        <p
          class="mt-2 text-2xl font-bold"
          :class="report.profitLoss >= 0 ? 'text-emerald-700' : 'text-red-700'"
        >
          {{ report.profitLoss >= 0 ? '+' : '' }}{{ formatCurrency(report.profitLoss) }}
        </p>
        <p class="mt-1 text-xs"
          :class="report.profitLoss >= 0 ? 'text-emerald-500' : 'text-red-400'"
        >
          Net revenue minus cost of goods sold
        </p>
      </div>

      <!-- Orders & Items -->
      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm font-medium text-gray-500">Orders & Items Sold</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">
          {{ report.orderCount }} orders
        </p>
        <p class="mt-1 text-xs text-gray-400">{{ report.itemsSold }} items total</p>
        <p class="mt-1 text-xs text-gray-400">{{ report.returnedItems }} items refunded</p>
      </div>
    </section>

    <section class="rounded-3xl border border-gray-200 bg-white p-6">
      <div class="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Financial Trend Chart</h2>
          <p class="mt-1 text-sm text-gray-500">
            Showing {{ granularitySummaryLabel }} totals for paid orders from
            {{ appliedFilters.startDate }} to {{ appliedFilters.endDate }}.
          </p>
          <p class="mt-1 text-sm text-gray-500">
            Hover the graph for exact values and switch between line, column, and bar views instantly.
          </p>
          <p v-if="report.chart.length === 0" class="mt-2 text-sm text-amber-600">
            No paid orders were found in the applied range, so the chart is showing zero values.
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="series in seriesOptions"
            :key="series.key"
            type="button"
            @click="toggleSeries(series.key)"
            class="inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition"
            :class="
              seriesVisibility[series.key]
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-gray-300 bg-white text-slate-600 hover:border-slate-400'
            "
          >
            <span
              class="h-3 w-3 rounded-full"
              :style="{ backgroundColor: series.color }"
            ></span>
            {{ series.label }}
          </button>
        </div>
      </div>

      <div
        v-if="loading"
        class="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center text-gray-500"
      >
        Loading report...
      </div>

      <FinancialReportChart
        v-else
        :points="chartPoints"
        :type="chartType"
        :series-visibility="seriesVisibility"
      />
    </section>

    <section class="mt-6 rounded-3xl border border-gray-200 bg-white p-6">
      <div class="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 class="text-xl font-bold text-gray-900">Period Breakdown</h3>
          <p class="text-sm text-gray-500">
            Exact values for every {{ granularityLabel }} bucket inside the applied range.
          </p>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-wide text-gray-500">
              <th class="px-3 py-3 font-semibold">Period</th>
              <th class="px-3 py-3 font-semibold">Revenue</th>
              <th class="px-3 py-3 font-semibold">Refunds</th>
              <th class="px-3 py-3 font-semibold">Cost of Goods</th>
              <th class="px-3 py-3 font-semibold">Profit / Loss</th>
              <th class="px-3 py-3 font-semibold">Orders / Items</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="point in chartPoints" :key="point.key" class="text-gray-700">
              <td class="px-3 py-3 font-medium text-gray-900">{{ point.rangeLabel || point.label }}</td>
              <td class="px-3 py-3">{{ formatCurrency(point.revenue) }}</td>
              <td class="px-3 py-3">
                <span
                  class="inline-flex items-center gap-1 font-semibold"
                  :class="point.profitLoss >= 0 ? 'text-emerald-700' : 'text-red-600'"
                >
                  {{ formatCurrency(point.refunds) }}
                </span>
              </td>
              <td class="px-3 py-3">{{ formatCurrency(point.costOfGoods) }}</td>
              <td class="px-3 py-3 font-semibold" :class="point.profitLoss >= 0 ? 'text-emerald-700' : 'text-red-600'">
                {{ point.profitLoss >= 0 ? '+' : '' }}{{ formatCurrency(point.profitLoss) }}
              </td>
              <td class="px-3 py-3">{{ point.orders }} / {{ point.itemsSold }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { getSalesReport } from '../../api/invoiceApi'
import FinancialReportChart from '../../components/admin/FinancialReportChart.vue'
import { buildFinancialChartPoints } from '../../utils/financialReport'

const toDateInput = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

const today = new Date()
const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

const granularityOptions = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const chartTypeOptions = [
  { value: 'line', label: 'Line' },
  { value: 'column', label: 'Column' },
  { value: 'bar', label: 'Bar' },
]

const seriesOptions = [
  { key: 'revenue', label: 'Revenue', color: '#10b981' },
  { key: 'costOfGoods', label: 'Cost of Goods', color: '#f59e0b' },
  { key: 'profitLoss', label: 'Profit / Loss', color: '#f97316' },
  { key: 'refunds', label: 'Refunds', color: '#ef4444' },
]

const filters = ref({
  startDate: toDateInput(firstDayOfMonth),
  endDate: toDateInput(today),
})

const appliedFilters = ref({
  ...filters.value,
})

const report = ref({
  grossRevenue: 0,
  refunds: 0,
  revenue: 0,
  costOfGoods: 0,
  profitLoss: 0,
  discountLoss: 0,
  orderCount: 0,
  itemsSold: 0,
  returnedItems: 0,
  legacyCostItems: 0,
  chart: [],
})

const loading = ref(false)
const error = ref('')
const chartGranularity = ref('day')
const chartType = ref('line')
const seriesVisibility = ref({
  revenue: true,
  costOfGoods: true,
  profitLoss: true,
  refunds: true,
})

const requestParams = computed(() => ({
  startDate: filters.value.startDate,
  endDate: filters.value.endDate,
}))

const granularityLabel = computed(
  () => granularityOptions.find((option) => option.value === chartGranularity.value)?.label.toLowerCase() || 'day'
)

const granularitySummaryLabel = computed(() => {
  if (chartGranularity.value === 'week') return 'week-by-week'
  if (chartGranularity.value === 'month') return 'month-by-month'
  return 'day-by-day'
})

const chartPoints = computed(() =>
  buildFinancialChartPoints(
    report.value.chart,
    appliedFilters.value.startDate,
    appliedFilters.value.endDate,
    chartGranularity.value
  )
)

const loadReport = async () => {
  loading.value = true
  error.value = ''

  try {
    const res = await getSalesReport(requestParams.value)

    report.value = res.data?.summary || {
      grossRevenue: 0,
      refunds: 0,
      revenue: 0,
      costOfGoods: 0,
      profitLoss: 0,
      discountLoss: 0,
      orderCount: 0,
      itemsSold: 0,
      returnedItems: 0,
      legacyCostItems: 0,
      chart: [],
    }

    appliedFilters.value = {
      ...filters.value,
    }
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load financial report'
  } finally {
    loading.value = false
  }
}

const formatCurrency = (value) =>
  `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const toggleSeries = (key) => {
  seriesVisibility.value = {
    ...seriesVisibility.value,
    [key]: !seriesVisibility.value[key],
  }
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

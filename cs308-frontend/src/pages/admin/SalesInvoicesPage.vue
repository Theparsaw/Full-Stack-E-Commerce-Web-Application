<template>
  <div class="sales-invoices-page">
    <div class="mb-6">
      <p class="text-sm font-semibold text-orange-600 mb-2">Invoices</p>
      <h1 class="text-3xl font-bold text-gray-900">Invoice Management</h1>
      <p class="text-gray-600 mt-2">
        View customer invoices by invoice date and export paid invoices as PDF.
      </p>
    </div>

    <section class="no-print mb-6 rounded-3xl border border-gray-200 bg-white p-5">
      <div class="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto]">
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
          @click="loadInvoices"
          :disabled="loading"
          class="self-end rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {{ loading ? 'Loading...' : 'Apply' }}
        </button>

        <button
          @click="printInvoices"
          class="self-end rounded-2xl bg-gray-100 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-200"
        >
          Print
        </button>
      </div>

      <p v-if="error" class="mt-3 text-sm text-red-600">
        {{ error }}
      </p>
    </section>

    <section class="mb-6 grid gap-4 md:grid-cols-3">
      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm text-gray-500">Invoices</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">{{ summary.count }}</p>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm text-gray-500">Total Amount</p>
        <p class="mt-2 text-2xl font-bold text-gray-900">
          {{ formatCurrency(summary.totalAmount) }}
        </p>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-5">
        <p class="text-sm text-gray-500">Date Range</p>
        <p class="mt-2 text-lg font-bold text-gray-900">
          {{ filters.startDate }} to {{ filters.endDate }}
        </p>
      </div>
    </section>

    <section class="rounded-3xl border border-gray-200 bg-white overflow-hidden">
      <div
        v-if="loading"
        class="p-6 text-gray-600"
      >
        Loading invoices...
      </div>

      <div
        v-else-if="invoices.length === 0"
        class="p-8 text-center text-gray-500"
      >
        No invoices found for this date range.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[760px] text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <th class="px-6 py-4 text-left font-semibold text-gray-700">Invoice</th>
              <th class="px-6 py-4 text-left font-semibold text-gray-700">Customer</th>
              <th class="px-6 py-4 text-left font-semibold text-gray-700">Date</th>
              <th class="px-6 py-4 text-left font-semibold text-gray-700">Status</th>
              <th class="px-6 py-4 text-left font-semibold text-gray-700">Amount</th>
              <th class="no-print px-6 py-4 text-left font-semibold text-gray-700">Action</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
            <tr v-for="invoice in invoices" :key="invoice.id">
              <td class="px-6 py-4">
                <p class="font-semibold text-gray-900">{{ invoice.invoiceNumber }}</p>
                <p class="text-xs text-gray-500">Order {{ invoice.orderId }}</p>
              </td>

              <td class="px-6 py-4">
                <p class="font-medium text-gray-900">{{ invoice.customerName }}</p>
                <p class="text-xs text-gray-500">{{ invoice.customerEmail }}</p>
              </td>

              <td class="px-6 py-4 text-gray-600">
                {{ formatDate(invoice.createdAt) }}
              </td>

              <td class="px-6 py-4">
                <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {{ invoice.status }}
                </span>
              </td>

              <td class="px-6 py-4 font-semibold text-gray-900">
                {{ formatCurrency(invoice.amount) }}
              </td>

              <td class="no-print px-6 py-4">
                <button
                  @click="downloadInvoicePdf(invoice)"
                  :disabled="downloadingInvoiceId === invoice.id"
                  class="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
                >
                  {{ downloadingInvoiceId === invoice.id ? 'Exporting...' : 'PDF' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  downloadSalesInvoice,
  getSalesInvoices,
} from '../../api/invoiceApi'
import { formatDisplayDate } from '../../utils/dateFormat'

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
const invoices = ref([])
const summary = ref({
  count: 0,
  totalAmount: 0,
})
const loading = ref(false)
const error = ref('')
const downloadingInvoiceId = ref('')

const requestParams = computed(() => ({
  startDate: filters.value.startDate,
  endDate: filters.value.endDate,
}))

const loadInvoices = async () => {
  loading.value = true
  error.value = ''

  try {
    const res = await getSalesInvoices(requestParams.value)

    invoices.value = res.data?.invoices || []
    summary.value = res.data?.summary || {
      count: 0,
      totalAmount: 0,
    }
  } catch (err) {
    error.value =
      err?.response?.data?.message ||
      'Failed to load invoices'
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

const formatDate = (value) => {
  return formatDisplayDate(value)
}

const printInvoices = () => {
  window.print()
}

const downloadInvoicePdf = async (invoice) => {
  downloadingInvoiceId.value = invoice.id
  error.value = ''

  try {
    const res = await downloadSalesInvoice(invoice.id)
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${invoice.invoiceNumber}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    // When responseType is 'blob', error response data is a Blob — parse it to get the message
    let message = 'Failed to export invoice PDF'
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text()
        const parsed = JSON.parse(text)
        message = parsed.message || message
      } catch {
        // ignore parse error, use default message
      }
    } else {
      message = err?.response?.data?.message || message
    }
    error.value = message
  } finally {
    downloadingInvoiceId.value = ''
  }
}

onMounted(loadInvoices)
</script>

<style scoped>
@media print {
  .no-print {
    display: none !important;
  }

  .sales-invoices-page {
    color: #111827;
  }
}
</style>

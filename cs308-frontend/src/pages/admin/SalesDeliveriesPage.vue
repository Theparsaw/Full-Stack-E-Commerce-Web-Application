<template>
  <div>
    <div class="mb-6">
      <p class="text-sm font-semibold text-orange-600 mb-2">Product Management</p>
      <h1 class="text-3xl font-bold text-gray-900">Invoice & Delivery Management</h1>
      <p class="text-gray-600 mt-2">
        View delivery-related invoice details, purchased products, quantities, addresses, and completion status.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5 mb-6">
      <div class="bg-white border border-gray-200 rounded-3xl p-5">
        <p class="text-sm text-gray-500 mb-2">Total Deliveries</p>
        <p class="text-3xl font-bold text-gray-900">{{ deliveries.length }}</p>
      </div>

      <div class="bg-white border border-gray-200 rounded-3xl p-5">
        <p class="text-sm text-gray-500 mb-2">Processing</p>
        <p class="text-3xl font-bold text-gray-900">{{ processingCount }}</p>
      </div>

      <div class="bg-white border border-gray-200 rounded-3xl p-5">
        <p class="text-sm text-gray-500 mb-2">In Transit</p>
        <p class="text-3xl font-bold text-gray-900">{{ outForDeliveryCount }}</p>
      </div>

      <div class="bg-white border border-gray-200 rounded-3xl p-5">
        <p class="text-sm text-gray-500 mb-2">Delivered</p>
        <p class="text-3xl font-bold text-gray-900">{{ deliveredCount }}</p>
      </div>

      <div class="bg-white border border-gray-200 rounded-3xl p-5">
        <p class="text-sm text-gray-500 mb-2">Not Completed</p>
        <p class="text-3xl font-bold text-gray-900">{{ notCompletedCount }}</p>
      </div>
    </div>

    <div class="mb-6 rounded-3xl border border-gray-200 bg-white p-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex-1">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="Search by delivery ID, order ID, customer ID, invoice number, product ID, or address..."
            class="w-full rounded-2xl border border-gray-300 px-4 py-3 outline-none focus:border-orange-500"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            @click="statusFilter = option.value"
            class="rounded-full border px-4 py-2 text-sm font-medium transition"
            :class="statusFilter === option.value
              ? 'border-orange-500 bg-orange-500 text-white'
              : 'border-gray-300 bg-white text-gray-700 hover:border-orange-400'"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="rounded-3xl border border-gray-200 bg-white p-6 text-gray-600">
      Loading deliveries...
    </div>

    <div v-else-if="error" class="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-600">
      {{ error }}
    </div>

    <div
      v-else-if="filteredDeliveries.length === 0"
      class="rounded-3xl border border-gray-200 bg-white p-8 text-gray-600"
    >
      No deliveries found.
    </div>

    <div v-else class="space-y-5">
      <article
        v-for="delivery in filteredDeliveries"
        :key="delivery.id"
        class="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div class="space-y-5 flex-1">
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivery ID</p>
                <p class="text-lg font-bold text-gray-900 break-all">{{ delivery.id }}</p>

                <p class="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Order ID</p>
                <p class="text-sm font-semibold text-gray-800 break-all">{{ delivery.orderId }}</p>

                <p class="text-sm text-gray-500 mt-2">
                  Created {{ formatDate(delivery.createdAt) }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <span
                  class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                  :class="getStatusBadgeClass(delivery.status)"
                >
                  {{ formatStatusLabel(delivery.status) }}
                </span>

                <span
                  class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                  :class="isCompleted(delivery)
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'"
                >
                  {{ isCompleted(delivery) ? 'Completed' : 'Not Completed' }}
                </span>
              </div>
            </div>

            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-2xl bg-gray-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Customer</p>
                <p class="font-semibold text-gray-900">
                  {{ delivery.customerName || 'Unknown User' }}
                </p>
                <p class="text-sm text-gray-500 break-all">
                  {{ delivery.customerEmail || 'No email' }}
                </p>
                <p class="mt-2 text-xs text-gray-500 break-all">
                  Customer ID: {{ delivery.userId || 'Unknown' }}
                </p>
              </div>

              <div class="rounded-2xl bg-gray-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Invoice</p>

                <template v-if="delivery.invoiceNumber">
                  <p class="font-semibold text-gray-900 break-all">
                    {{ delivery.invoiceNumber }}
                  </p>
                  <p class="text-sm text-gray-500">
                    Status: {{ formatInvoiceStatus(delivery.invoiceStatus) }}
                  </p>
                  <p class="text-sm text-gray-500">
                    Amount: {{ formatCurrency(delivery.invoiceAmount) }}
                  </p>

                  <button
                    type="button"
                    class="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                    :disabled="downloadingInvoiceIds.has(delivery.id)"
                    @click="handleDownloadInvoice(delivery)"
                  >
                    {{ downloadingInvoiceIds.has(delivery.id) ? 'Preparing PDF...' : 'Download Invoice PDF' }}
                  </button>
                </template>

                <p v-else class="text-sm text-gray-500">
                  No invoice linked
                </p>
              </div>

              <div class="rounded-2xl bg-gray-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Total Price</p>
                <p class="text-xl font-bold text-gray-900">
                  {{ formatCurrency(delivery.totalPrice) }}
                </p>
                <p class="mt-2 text-xs text-gray-500">
                  {{ getTotalItemCount(delivery.items) }} item(s) in delivery
                </p>
              </div>

              <div class="rounded-2xl bg-gray-50 p-4">
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Delivery Address</p>
                <p class="text-sm text-gray-700 whitespace-pre-line">
                  {{ delivery.address || 'Not provided' }}
                </p>
              </div>
            </div>

            <div class="overflow-hidden rounded-2xl border border-gray-200">
              <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p class="text-sm font-semibold text-gray-900">Products to be Delivered</p>
                <p class="text-xs text-gray-500">
                  {{ getTotalItemCount(delivery.items) }} item(s)
                </p>
              </div>

              <div class="hidden grid-cols-[1.1fr_0.7fr_0.5fr_0.7fr_0.8fr] gap-4 border-b border-gray-100 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
                <span>Product</span>
                <span>Product ID</span>
                <span>Quantity</span>
                <span>Unit Price</span>
                <span class="text-right">Line Total</span>
              </div>

              <div class="divide-y divide-gray-100">
                <div
                  v-for="item in delivery.items"
                  :key="`${delivery.id}-${item.productId}`"
                  class="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.1fr_0.7fr_0.5fr_0.7fr_0.8fr] md:items-center"
                >
                  <div>
                    <p class="font-semibold text-gray-900">{{ item.name }}</p>
                    <p class="text-xs text-gray-500 md:hidden">Product ID: {{ item.productId }}</p>
                  </div>

                  <div class="text-gray-700 break-all">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 md:hidden">Product ID: </span>
                    {{ item.productId }}
                  </div>

                  <div class="font-semibold text-gray-900">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 md:hidden">Quantity: </span>
                    {{ item.quantity }}
                  </div>

                  <div class="text-gray-700">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 md:hidden">Unit Price: </span>
                    {{ item.unitPrice !== undefined ? formatCurrency(item.unitPrice) : '—' }}
                  </div>

                  <div class="font-semibold text-gray-900 md:text-right">
                    <span class="text-xs font-semibold uppercase tracking-wide text-gray-400 md:hidden">Line Total: </span>
                    {{ getLineTotal(item) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="xl:w-[320px] xl:pl-4">
            <div class="rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p class="text-sm font-semibold text-orange-700 mb-3">Update Delivery Status</p>

              <label class="block text-sm text-gray-700 mb-2">New status</label>
              <select
                v-model="selectedStatuses[delivery.id]"
                class="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500"
              >
                <option
                  v-for="status in allowedStatuses"
                  :key="status"
                  :value="status"
                >
                  {{ formatStatusLabel(status) }}
                </option>
              </select>

              <button
                type="button"
                @click="handleUpdateStatus(delivery)"
                :disabled="savingIds.has(delivery.id)"
                class="mt-4 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-50"
              >
                {{ savingIds.has(delivery.id) ? 'Updating...' : 'Save Status Update' }}
              </button>

              <p class="mt-3 text-xs text-gray-500">
                Delivered status means the delivery has been completed.
              </p>
            </div>
          </div>
        </div>
      </article>
    </div>

    <p
      v-if="successMessage"
      class="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-700"
    >
      {{ successMessage }}
    </p>

    <section class="mt-10 rounded-3xl border border-amber-300 bg-amber-50 p-6">
      <p class="text-sm font-semibold uppercase tracking-wide text-amber-700">Demo Preparation Tool</p>
      <h2 class="mt-2 text-2xl font-bold text-gray-900">Change Order Purchase Date</h2>
      <p class="mt-2 max-w-3xl text-sm text-gray-600">
        Select a paid order and set its demo purchase date. The linked order, delivery, payment, and invoice
        dates are updated together so return eligibility and date-range reports remain consistent.
      </p>

      <div class="mt-5 grid gap-4 lg:grid-cols-[1fr_0.7fr_auto] lg:items-end">
        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700" for="demoDelivery">
            Delivery / Order
          </label>
          <select
            id="demoDelivery"
            v-model="demoDateForm.deliveryId"
            class="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500"
          >
            <option value="">Select an order</option>
            <option v-for="delivery in deliveries" :key="delivery.id" :value="delivery.id">
              {{ delivery.items?.map((item) => item.name).join(', ') || 'Unknown product' }}
              | {{ delivery.customerEmail || delivery.userId }}
              | Order {{ delivery.orderId }}
            </option>
          </select>
        </div>

        <div>
          <label class="mb-2 block text-sm font-semibold text-gray-700" for="demoOrderDate">
            Purchase date and time
          </label>
          <input
            id="demoOrderDate"
            v-model="demoDateForm.orderDate"
            type="datetime-local"
            :max="maxDemoDate"
            class="w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-orange-500"
          />
        </div>

        <button
          type="button"
          class="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="savingDemoDate || !demoDateForm.deliveryId || !demoDateForm.orderDate"
          @click="handleUpdateOrderDate"
        >
          {{ savingDemoDate ? 'Updating...' : 'Update Demo Date' }}
        </button>
      </div>

      <p v-if="demoDateError" class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {{ demoDateError }}
      </p>
      <p v-if="demoDateMessage" class="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
        {{ demoDateMessage }}
      </p>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  getDeliveries,
  updateDeliveryStatus,
  updateDeliveryOrderDate,
  downloadDeliveryInvoice,
} from '../../api/deliveryApi'
import { formatDisplayDateTime } from '../../utils/dateFormat'

const deliveries = ref([])
const loading = ref(true)
const error = ref('')
const successMessage = ref('')
const searchTerm = ref('')
const statusFilter = ref('all')
const selectedStatuses = ref({})
const savingIds = ref(new Set())
const downloadingInvoiceIds = ref(new Set())
const savingDemoDate = ref(false)
const demoDateError = ref('')
const demoDateMessage = ref('')
const demoDateForm = ref({
  deliveryId: '',
  orderDate: '',
})
const getLocalDateTimeValue = (date = new Date()) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
  return localDate.toISOString().slice(0, 16)
}
const maxDemoDate = getLocalDateTimeValue()

const allowedStatuses = [
  'processing',
  'out_for_delivery',
  'delivered',
  'cancelled',
]

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Processing', value: 'processing' },
  { label: 'In transit', value: 'out_for_delivery' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
]

const processingCount = computed(() =>
  deliveries.value.filter((d) => d.status === 'processing').length
)

const outForDeliveryCount = computed(() =>
  deliveries.value.filter((d) => d.status === 'out_for_delivery').length
)

const deliveredCount = computed(() =>
  deliveries.value.filter((d) => d.status === 'delivered').length
)

const notCompletedCount = computed(() =>
  deliveries.value.filter((d) => d.status !== 'delivered' && d.status !== 'cancelled').length
)

const filteredDeliveries = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()

  return deliveries.value.filter((delivery) => {
    const itemMatches = Array.isArray(delivery.items)
      ? delivery.items.some((item) =>
          String(item.productId ?? '').toLowerCase().includes(term) ||
          String(item.name ?? '').toLowerCase().includes(term)
        )
      : false

    const matchesSearch =
      !term ||
      String(delivery.id ?? '').toLowerCase().includes(term) ||
      String(delivery.orderId ?? '').toLowerCase().includes(term) ||
      String(delivery.userId ?? '').toLowerCase().includes(term) ||
      String(delivery.customerName ?? '').toLowerCase().includes(term) ||
      String(delivery.customerEmail ?? '').toLowerCase().includes(term) ||
      String(delivery.invoiceNumber ?? '').toLowerCase().includes(term) ||
      String(delivery.address ?? '').toLowerCase().includes(term) ||
      itemMatches

    const matchesFilter =
      statusFilter.value === 'all' || delivery.status === statusFilter.value

    return matchesSearch && matchesFilter
  })
})

const formatDate = (value) => {
  return formatDisplayDateTime(value)
}

const formatCurrency = (value) => {
  return `$${Number(value || 0).toLocaleString()}`
}

const getTotalItemCount = (items = []) => {
  return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
}

const getLineTotal = (item) => {
  if (item.unitPrice === undefined || item.unitPrice === null) {
    return '—'
  }

  return formatCurrency(Number(item.unitPrice || 0) * Number(item.quantity || 0))
}

const isCompleted = (delivery) => {
  return delivery.status === 'delivered'
}

const formatStatusLabel = (status) => {
  switch (status) {
    case 'processing':
      return 'Processing'
    case 'out_for_delivery':
      return 'In transit'
    case 'delivered':
      return 'Delivered'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status || 'Unknown'
  }
}

const formatInvoiceStatus = (status) => {
  switch (status) {
    case 'generated':
      return 'Generated'
    case 'emailed':
      return 'Emailed'
    case 'failed':
      return 'Email Failed'
    default:
      return status || 'Unknown'
  }
}

const getStatusBadgeClass = (status) => {
  switch (status) {
    case 'processing':
      return 'bg-yellow-100 text-yellow-700'
    case 'out_for_delivery':
      return 'bg-purple-100 text-purple-700'
    case 'delivered':
      return 'bg-green-100 text-green-700'
    case 'cancelled':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

const loadDeliveries = async () => {
  loading.value = true
  error.value = ''
  successMessage.value = ''

  try {
    const res = await getDeliveries()
    deliveries.value = res.data?.data ?? []

    const initialSelections = {}
    for (const delivery of deliveries.value) {
      initialSelections[delivery.id] = delivery.status
    }
    selectedStatuses.value = initialSelections
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load deliveries'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const handleDownloadInvoice = async (delivery) => {
  error.value = ''
  successMessage.value = ''

  if (!delivery.invoiceNumber) {
    error.value = 'No invoice is linked to this delivery.'
    return
  }

  try {
    downloadingInvoiceIds.value.add(delivery.id)
    downloadingInvoiceIds.value = new Set(downloadingInvoiceIds.value)

    const res = await downloadDeliveryInvoice(delivery.id)

    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)

    const safeInvoiceNumber = String(delivery.invoiceNumber || `invoice-${delivery.id}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_')

    const link = document.createElement('a')
    link.href = url
    link.download = `${safeInvoiceNumber}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()

    window.URL.revokeObjectURL(url)

    successMessage.value = `Invoice PDF for ${delivery.invoiceNumber} downloaded successfully.`
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to download invoice PDF'
    console.error(err)
  } finally {
    downloadingInvoiceIds.value.delete(delivery.id)
    downloadingInvoiceIds.value = new Set(downloadingInvoiceIds.value)
  }
}

const handleUpdateStatus = async (delivery) => {
  error.value = ''
  successMessage.value = ''

  const nextStatus = selectedStatuses.value[delivery.id]

  if (!nextStatus || nextStatus === delivery.status) {
    successMessage.value = 'No status change to save.'
    return
  }

  try {
    savingIds.value.add(delivery.id)
    savingIds.value = new Set(savingIds.value)

    const res = await updateDeliveryStatus(delivery.id, nextStatus)
    const updatedDelivery = res.data?.data

    deliveries.value = deliveries.value.map((item) =>
      item.id === delivery.id ? updatedDelivery : item
    )

    selectedStatuses.value[delivery.id] = updatedDelivery.status
    successMessage.value = `Delivery status for order ${delivery.orderId} updated successfully.`
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to update delivery status'
    console.error(err)
  } finally {
    savingIds.value.delete(delivery.id)
    savingIds.value = new Set(savingIds.value)
  }
}

const handleUpdateOrderDate = async () => {
  demoDateError.value = ''
  demoDateMessage.value = ''
  savingDemoDate.value = true

  try {
    const selectedDate = new Date(demoDateForm.value.orderDate)
    const res = await updateDeliveryOrderDate(
      demoDateForm.value.deliveryId,
      selectedDate.toISOString()
    )

    const updatedDeliveryId = res.data?.data?.deliveryId
    deliveries.value = deliveries.value.map((delivery) =>
      String(delivery.id) === String(updatedDeliveryId)
        ? { ...delivery, createdAt: res.data.data.orderDate }
        : delivery
    )

    demoDateMessage.value = res.data?.message || 'Order date updated successfully.'
  } catch (err) {
    demoDateError.value = err?.response?.data?.message || 'Failed to update order date'
    console.error(err)
  } finally {
    savingDemoDate.value = false
  }
}

onMounted(loadDeliveries)
</script>

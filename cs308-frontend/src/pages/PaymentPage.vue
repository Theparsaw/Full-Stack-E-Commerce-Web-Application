<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between gap-4 mb-6">
      <div>
        <h1 class="text-3xl font-bold text-slate-900">Payment</h1>
        <p class="text-slate-500 mt-1">
          Complete your payment to finalize the order.
        </p>
      </div>
      <router-link to="/" class="text-blue-600 hover:underline">
        Back to Store
      </router-link>
    </div>

    <div v-if="loading" class="text-slate-600">Loading payment details...</div>

    <div v-else-if="pageError" class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
      {{ pageError }}
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900 mb-4">Card Information</h2>

        <form class="space-y-4" autocomplete="on" @submit.prevent="handleSubmit">
          <div>
            <label for="card-holder" class="block text-sm font-medium text-slate-700 mb-1">Cardholder Name</label>
            <input
              id="card-holder"
              name="cc-name"
              v-model="form.cardHolder"
              type="text"
              autocomplete="cc-name"
              class="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label for="card-number" class="block text-sm font-medium text-slate-700 mb-1">Card Number</label>
            <input
              id="card-number"
              name="cc-number"
              v-model="form.cardNumber"
              type="text"
              inputmode="numeric"
              pattern="[0-9 ]*"
              autocomplete="cc-number"
              maxlength="19"
              class="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
              placeholder="1234 5678 9012 3456"
            />
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <label for="expiry-month" class="block text-sm font-medium text-slate-700 mb-1">Expiry Month</label>
              <input
                id="expiry-month"
                name="cc-exp-month"
                v-model="form.expiryMonth"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="cc-exp-month"
                maxlength="2"
                class="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                placeholder="MM"
              />
            </div>

            <div>
              <label for="expiry-year" class="block text-sm font-medium text-slate-700 mb-1">Expiry Year</label>
              <input
                id="expiry-year"
                name="cc-exp-year"
                v-model="form.expiryYear"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="cc-exp-year"
                maxlength="4"
                class="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500"
                placeholder="YYYY"
                />
            </div>

            <div>
              <label for="card-cvv" class="block text-sm font-medium text-slate-700 mb-1">CVV</label>
             <input
                id="card-cvv"
                name="cc-csc"
                v-model="form.cvv"
                type="password"
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="cc-csc"
                maxlength="4"
                class="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-500 placeholder:text-slate-400"
                placeholder="CVV"
                />
            </div>
          </div>

          <button
            type="submit"
            class="w-full rounded-lg bg-slate-900 px-4 py-3 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            :disabled="submitting || order.status === 'paid'"
          >
            {{
              submitting
                ? 'Processing Payment...'
                : order.status === 'paid'
                ? 'Order Already Paid'
                : 'Pay Now'
            }}
          </button>
        </form>

        <p v-if="formError" class="mt-4 text-sm text-red-600">
          {{ formError }}
        </p>

        <p v-if="resultMessage" class="mt-4 text-sm" :class="resultSuccess ? 'text-green-700' : 'text-red-600'">
          {{ resultMessage }}
        </p>
      </div>

      <aside class="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
        <h2 class="text-xl font-semibold text-slate-900">Order Summary</h2>

        <div class="mt-4 space-y-3">
          <div
            v-for="item in order.items"
            :key="item.productId"
            class="border-b border-slate-200 pb-3"
          >
            <p class="font-medium text-slate-900">{{ item.name }}</p>
            <p class="text-sm text-slate-500">Quantity: {{ item.quantity }}</p>
            <p class="text-sm text-slate-500">
              Subtotal: ${{ (item.unitPrice * item.quantity).toLocaleString() }}
            </p>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between text-slate-600">
          <span>Status</span>
          <span
            class="font-medium"
            :class="{
              'text-green-600': order.status === 'paid',
              'text-red-600': order.status === 'payment_failed',
              'text-yellow-600': order.status === 'pending_payment'
            }"
          >
            {{ formatStatus(order.status) }}
          </span>
        </div>

        <div class="mt-3 flex items-center justify-between text-lg">
          <span class="font-medium text-slate-700">Total Price</span>
          <span class="font-bold text-slate-900">${{ order.totalPrice.toLocaleString() }}</span>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOrderForPayment, submitPayment } from '../api/paymentApi'
import { cartStore } from '../store/cart'
const formatStatus = (status) => {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const route = useRoute()
const router = useRouter()
let successRedirectTimeout = null

const order = ref({
  id: '',
  items: [],
  totalPrice: 0,
  status: '',
})

const form = ref({
  cardHolder: '',
  cardNumber: '',
  expiryMonth: '',
  expiryYear: '',
  cvv: '',
})

const loading = ref(true)
const submitting = ref(false)
const pageError = ref('')
const formError = ref('')
const resultMessage = ref('')
const resultSuccess = ref(false)

const orderId = route.params.orderId

const isValidCardHolder = (cardHolder) => {
  const normalizedName = cardHolder.trim().replace(/\s+/g, ' ')
  const letterCount = (normalizedName.match(/\p{L}/gu) || []).length

  return (
    normalizedName.length >= 2 &&
    normalizedName.length <= 60 &&
    letterCount >= 2 &&
    /^[\p{L}][\p{L}\s'.-]*$/u.test(normalizedName)
  )
}

const setOrderState = (data) => {
  order.value = {
    id: data.id,
    items: data.items ?? [],
    totalPrice: data.totalPrice ?? 0,
    status: data.status ?? '',
  }
}

const validateForm = () => {
  const cardNumber = form.value.cardNumber.replace(/\s+/g, '')
  const cardHolder = form.value.cardHolder.trim()
  const expiryMonth = form.value.expiryMonth.trim()
  const expiryYear = form.value.expiryYear.trim()
  const cvv = form.value.cvv.trim()

  if (!cardHolder || !cardNumber || !expiryMonth || !expiryYear || !cvv) {
    return 'All payment fields are required'
  }

  if (!isValidCardHolder(cardHolder)) {
    return 'Cardholder name must contain only letters, spaces, apostrophes, hyphens, or periods'
  }

  if (!/^\d{16}$/.test(cardNumber)) {
    return 'Card number must be 16 digits'
  }

  if (!/^\d{2}$/.test(expiryMonth) || Number(expiryMonth) < 1 || Number(expiryMonth) > 12) {
    return 'Expiry month must be between 01 and 12'
  }

  if (!/^\d{4}$/.test(expiryYear)) {
    return 'Expiry year must be 4 digits'
  }

  const expiryMonthNumber = Number(expiryMonth)
  const expiryYearNumber = Number(expiryYear)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  if (expiryYearNumber < currentYear || (expiryYearNumber === currentYear && expiryMonthNumber < currentMonth)) {
    return 'Card expiry date is invalid or expired'
  }

  if (!/^\d{3,4}$/.test(cvv)) {
    return 'CVV must be 3 or 4 digits'
  }

  return ''
}

const loadOrder = async () => {
  loading.value = true
  pageError.value = ''

  try {
    const res = await getOrderForPayment(orderId)
    setOrderState(res.data.order)
  } catch (err) {
    pageError.value = err?.response?.data?.message || 'Failed to load order'
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  formError.value = ''
  resultMessage.value = ''
  resultSuccess.value = false

  const validationError = validateForm()
  if (validationError) {
    formError.value = validationError
    return
  }

  submitting.value = true

  try {
    const payload = {
      cardHolder: form.value.cardHolder.trim().replace(/\s+/g, ' '),
      cardNumber: form.value.cardNumber.replace(/\s+/g, ''),
      expiryMonth: form.value.expiryMonth.trim(),
      expiryYear: form.value.expiryYear.trim(),
      cvv: form.value.cvv.trim(),
    }

    const res = await submitPayment(orderId, payload)

    setOrderState(res.data.order)
    resultMessage.value = res.data.message
    resultSuccess.value = res.data.success

    if (res.data.success) {
      cartStore.clear()
      successRedirectTimeout = window.setTimeout(() => {
        router.push('/profile?tab=invoices')
      }, 1200)
    }
  } catch (err) {
    formError.value = err?.response?.data?.message || 'Failed to process payment'
  } finally {
    submitting.value = false
  }
}

onMounted(loadOrder)

onBeforeUnmount(() => {
  if (successRedirectTimeout) {
    window.clearTimeout(successRedirectTimeout)
  }
})
</script>

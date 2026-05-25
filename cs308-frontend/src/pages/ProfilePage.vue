<template>
  <div class="theme-page-shell min-h-screen py-10">
    <div class="mx-auto max-w-5xl px-4">
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-800">My Profile</h1>
          <p class="mt-2 text-sm text-gray-500">
            Manage your account details and track current deliveries.
          </p>
        </div>

        <button
          v-if="activeTab === 'profile' && !loading && !error && !isEditing"
          type="button"
          class="inline-flex items-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          @click="startEditing"
        >
          Edit Profile
        </button>
      </div>

      <div class="mb-8 flex flex-wrap gap-3">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="rounded-full border px-4 py-2 text-sm font-semibold transition"
          :class="
            activeTab === tab.id
              ? 'border-orange-500 bg-orange-500 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50'
          "
          @click="setActiveTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="activeTab === 'profile'">
        <div v-if="loading" class="py-20 text-center text-gray-500">
          Loading your profile...
        </div>

        <div v-else-if="error" class="py-20 text-center text-red-500">
          {{ error }}
        </div>

        <div v-else class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div class="mb-8 flex items-center gap-5 border-b border-gray-100 pb-8">
            <img
              v-if="displayProfileImage"
              :src="getProfileImageUrl(displayProfileImage)"
              alt="Profile photo"
              class="h-20 w-20 shrink-0 rounded-full border-2 border-orange-200 object-cover"
            />

            <div
              v-else
              class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-orange-500 text-3xl font-bold text-white"
            >
              {{ user.name?.charAt(0).toUpperCase() }}
            </div>

            <div>
              <h2 class="text-2xl font-bold text-gray-800">{{ user.name }}</h2>
              <span
                class="mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium"
                :class="{
                  'bg-blue-100 text-blue-700': user.role === 'customer',
                  'bg-green-100 text-green-700': user.role === 'sales_manager',
                  'bg-purple-100 text-purple-700': user.role === 'product_manager',
                }"
              >
                {{ formatRole(user.role) }}
              </span>
            </div>
          </div>

          <div
            v-if="formMessage"
            class="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
          >
            {{ formMessage }}
          </div>
          <div
            v-if="formError"
            class="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {{ formError }}
          </div>

          <div v-if="!isEditing" class="space-y-5">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium uppercase tracking-wide text-gray-400">Email</span>
              <span class="font-medium text-gray-800">{{ user.email }}</span>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium uppercase tracking-wide text-gray-400">Tax ID</span>
              <span class="font-medium text-gray-800">{{ user.taxId || 'Not provided' }}</span>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium uppercase tracking-wide text-gray-400">Address</span>
              <span class="font-medium text-gray-800">{{ user.address || 'Not provided' }}</span>
            </div>

            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium uppercase tracking-wide text-gray-400">Member Since</span>
              <span class="font-medium text-gray-800">{{ formatDate(user.createdAt) }}</span>
            </div>
          </div>

          <form v-else class="space-y-5" @submit.prevent="saveProfile">
            <input
              ref="photoInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handlePhotoSelected"
            />

            <div class="flex flex-col gap-3">
              <span class="text-sm font-medium uppercase tracking-wide text-gray-400">Profile Photo</span>
              <div class="flex flex-wrap items-center gap-4">
                <img
                  v-if="displayProfileImage"
                  :src="getProfileImageUrl(displayProfileImage)"
                  alt="Selected profile photo preview"
                  class="h-20 w-20 rounded-full border-2 border-orange-200 object-cover"
                />
                <div
                  v-else
                  class="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-orange-500 text-3xl font-bold text-white"
                >
                  {{ form.name?.charAt(0).toUpperCase() || user.name?.charAt(0).toUpperCase() }}
                </div>

                <div class="flex flex-wrap gap-3">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    @click="openPhotoPicker"
                  >
                    Choose Photo
                  </button>
                  <button
                    v-if="displayProfileImage"
                    type="button"
                    class="inline-flex items-center rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    @click="removePhoto"
                  >
                    Remove Photo
                  </button>
                </div>
              </div>
              <p class="text-sm text-gray-500">Use a small image file like JPG or PNG for best results.</p>
              <p v-if="photoError" class="text-sm text-red-600">{{ photoError }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium uppercase tracking-wide text-gray-400" for="name">
                Name
              </label>
              <input
                id="name"
                v-model="form.name"
                type="text"
                class="rounded-xl border px-4 py-3 text-gray-800 outline-none transition"
                :class="
                  fieldErrors.name
                    ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                    : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                "
                placeholder="Enter your full name"
                @input="clearFieldError('name')"
              />
              <p v-if="fieldErrors.name" class="text-sm text-red-600">{{ fieldErrors.name }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium uppercase tracking-wide text-gray-400" for="email">
                Email
              </label>
              <input
                id="email"
                :value="user.email"
                type="email"
                disabled
                class="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-500"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium uppercase tracking-wide text-gray-400" for="taxId">
                Tax ID
              </label>
              <input
                id="taxId"
                v-model="form.taxId"
                type="text"
                class="rounded-xl border px-4 py-3 text-gray-800 outline-none transition"
                :class="
                  fieldErrors.taxId
                    ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                    : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                "
                placeholder="Enter your tax ID"
                @input="clearFieldError('taxId')"
              />
              <p v-if="fieldErrors.taxId" class="text-sm text-red-600">{{ fieldErrors.taxId }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium uppercase tracking-wide text-gray-400" for="address">
                Address
              </label>
              <textarea
                id="address"
                v-model="form.address"
                rows="4"
                class="rounded-xl border px-4 py-3 text-gray-800 outline-none transition"
                :class="
                  fieldErrors.address
                    ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                    : 'border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
                "
                placeholder="Enter your home address"
                @input="clearFieldError('address')"
              />
              <p v-if="fieldErrors.address" class="text-sm text-red-600">{{ fieldErrors.address }}</p>
            </div>

            <div class="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                class="inline-flex items-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
                :disabled="saving"
              >
                {{ saving ? 'Saving...' : 'Save Changes' }}
              </button>
              <button
                type="button"
                class="inline-flex items-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                :disabled="saving"
                @click="cancelEditing"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <div v-else-if="activeTab === 'orders'" class="space-y-6">
        <div class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">Order Tracking</h2>
              <p class="text-sm text-gray-500">
                Review your recent purchases and shipment progress.
              </p>
            </div>
            <span class="text-sm font-medium text-gray-500">
              {{ orders.length }} {{ orders.length === 1 ? 'order' : 'orders' }}
            </span>
          </div>
        </div>

        <div v-if="ordersLoading" class="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-500 shadow-sm">
          Loading your orders...
        </div>

        <div
          v-else-if="ordersError"
          class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm"
        >
          {{ ordersError }}
        </div>

        <div
          v-else-if="orders.length === 0"
          class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 shadow-sm"
        >
          You have no orders yet.
        </div>

        <div v-else class="space-y-6">
          <article
            v-for="order in orders"
            :key="order.id"
            class="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm"
          >
            <div class="flex flex-col gap-4 border-b border-gray-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-3">
                  <h3 class="text-lg font-semibold text-gray-900">Order #{{ order.id.slice(-8).toUpperCase() }}</h3>
                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                    :class="getDeliveryBadgeClass(order.deliveryStatus)"
                  >
                    {{ formatDeliveryStatus(order.deliveryStatus) }}
                  </span>
                </div>
                <p class="mt-2 text-sm text-gray-500">Placed on {{ formatDateTime(order.createdAt) }}</p>
                <p class="mt-1 text-sm text-gray-500">
                  Tracking number: <span class="font-medium text-gray-700">{{ order.trackingNumber }}</span>
                </p>
                <p class="mt-1 text-sm text-gray-500">
                  Estimated delivery:
                  <span class="font-medium text-gray-700">
                    {{ order.estimatedDeliveryAt ? formatDate(order.estimatedDeliveryAt) : 'Unavailable' }}
                  </span>
                </p>
              </div>

              <div class="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <p>
                  Payment state:
                  <span class="font-semibold text-gray-900">{{ formatPaymentStatus(order.status) }}</span>
                </p>
                <p class="mt-1">
                  Total:
                  <span class="font-semibold text-gray-900">${{ Number(order.totalPrice || 0).toLocaleString() }}</span>
                </p>
                <button
                  v-if="canCancelOrder(order)"
                  type="button"
                  class="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  :disabled="cancellingOrderId === order.id"
                  @click="handleCancelOrder(order)"
                >
                  {{ cancellingOrderId === order.id ? 'Cancelling...' : 'Cancel Order' }}
                </button>
              </div>
            </div>

            <div class="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <section>
                <h4 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Ordered Items</h4>
                <div class="mt-4 space-y-3">
                  <div
                    v-for="item in order.items"
                    :key="`${order.id}-${item.productId}`"
                    class="flex items-start justify-between gap-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4"
                  >
                    <div class="min-w-0">
                      <p class="font-semibold text-gray-900">{{ item.name }}</p>
                      <p class="mt-1 text-sm text-gray-500">Product ID: {{ item.productId }}</p>
                    </div>
                    <div class="flex shrink-0 flex-col items-end gap-3 text-right text-sm text-gray-600">
                      <p>Qty {{ item.quantity }}</p>
                      <p class="mt-1 font-semibold text-gray-900">
                        ${{ Number(item.unitPrice * item.quantity).toLocaleString() }}
                      </p>
                      <button
                        type="button"
                        class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-300"
                        :disabled="!canReviewItem(order, item)"
                        @click="goToProductReview(item.productId)"
                      >
                        {{ getReviewButtonLabel(order, item) }}
                      </button>
                      <button
                        v-if="canRequestReturn(order, item)"
                        type="button"
                        class="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                        @click="startReturnRequest(order, item)"
                      >
                        Request Return
                      </button>
                      <p
                        v-if="getReturnEligibilityStatus(order, item)"
                        class="whitespace-nowrap text-xs font-medium"
                        :class="getReturnEligibilityStatus(order, item).eligible ? 'text-emerald-700' : 'text-gray-500'"
                      >
                        {{ getReturnEligibilityStatus(order, item).label }}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Shipment Timeline</h4>
                <div class="mt-4 space-y-4">
                  <div
                    v-for="step in getDisplayTimeline(order)"
                    :key="step.key"
                    class="flex items-start gap-4"
                  >
                    <div class="flex flex-col items-center">
                      <div
                        class="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold"
                        :class="getTimelineDotClass(step.state)"
                      >
                        {{ getTimelineMarker(step) }}
                      </div>
                      <div
                        v-if="!step.isLast"
                        class="mt-2 h-12 w-px"
                        :class="step.state === 'completed' ? 'bg-orange-300' : 'bg-gray-200'"
                      />
                    </div>
                    <div class="pt-1">
                      <p class="font-semibold text-gray-900">{{ step.label }}</p>
                      <p class="text-sm text-gray-500">{{ formatDate(step.date) }}</p>
                      <p class="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                        {{ formatTimelineState(step.state) }}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <form
              v-if="returnForm.orderId === order.id"
              class="mt-6 rounded-2xl border border-orange-100 bg-orange-50 p-5"
              @submit.prevent="handleSubmitReturnRequest(order)"
            >
              <input
                ref="returnPhotoInput"
                type="file"
                accept="image/*"
                multiple
                class="hidden"
                :disabled="submittingReturn"
                @change="handleReturnPhotosSelected"
              />

              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 class="font-semibold text-gray-900">Return Request</h4>
                  <p class="text-sm text-gray-600">Order #{{ order.id.slice(-8).toUpperCase() }}</p>
                </div>
                <button
                  type="button"
                  class="text-sm font-semibold text-gray-500 transition hover:text-gray-700"
                  :disabled="submittingReturn"
                  @click="cancelReturnRequest"
                >
                  Cancel
                </button>
              </div>

              <div class="mt-4 space-y-3">
                <div
                  v-for="item in order.items"
                  :key="`return-${order.id}-${item.productId}`"
                  class="rounded-xl border border-orange-100 bg-white p-4"
                >
                  <label class="flex items-start gap-3">
                    <input
                      :checked="isReturnItemSelected(item.productId)"
                      type="checkbox"
                      class="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                      :disabled="submittingReturn || isItemFullyReturned(order, item)"
                      @change="toggleReturnItem(item, $event.target.checked)"
                    />
                    <span class="min-w-0">
                      <span class="block font-semibold text-gray-900">{{ item.name }}</span>
                      <span class="block text-sm text-gray-500">
                      Qty {{ item.quantity }} - ${{ Number(item.unitPrice * item.quantity).toLocaleString() }}
                      </span>
                    </span>
                  </label>

                  <div v-if="isReturnItemSelected(item.productId)" class="mt-3 flex items-center gap-3 pl-7">
                    <label class="text-sm font-semibold text-gray-600" :for="`return-qty-${order.id}-${item.productId}`">
                      Return quantity
                    </label>
                    <input
                      :id="`return-qty-${order.id}-${item.productId}`"
                      type="number"
                      min="1"
                      :max="getRemainingReturnQuantity(order, item)"
                      step="1"
                      :value="getReturnItemQuantity(item.productId)"
                      class="w-24 rounded-lg border border-orange-100 px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      :disabled="submittingReturn"
                      @input="updateReturnItemQuantity(item, $event.target.value)"
                      @blur="normalizeReturnItemQuantity(item)"
                    />
                    <span class="text-sm text-gray-500">of {{ getRemainingReturnQuantity(order, item) }}</span>
                  </div>
                </div>
              </div>

              <div class="mt-4">
                <label class="text-sm font-semibold uppercase tracking-wide text-gray-500" for="returnReason">
                  Reason
                </label>
                <textarea
                  id="returnReason"
                  v-model="returnForm.reason"
                  rows="4"
                  maxlength="500"
                  class="mt-2 w-full rounded-xl border border-orange-100 bg-white px-4 py-3 text-gray-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  placeholder="Enter the reason for this return"
                  :disabled="submittingReturn"
                />
              </div>

              <div class="mt-4">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="text-sm font-semibold uppercase tracking-wide text-gray-500">Photos</p>
                    <p class="text-sm text-gray-600">Attach up to 5 product photos. JPG, PNG, or other image files are supported.</p>
                  </div>
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="submittingReturn || returnForm.photos.length >= 5"
                    @click="openReturnPhotoPicker"
                  >
                    Add Photos
                  </button>
                </div>

                <div v-if="returnForm.photos.length" class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div
                    v-for="photo in returnForm.photos"
                    :key="photo.preview"
                    class="relative overflow-hidden rounded-xl border border-orange-100 bg-white"
                  >
                    <img
                      :src="photo.preview"
                      :alt="photo.file.name"
                      class="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      class="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-bold text-gray-700 shadow hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                      :disabled="submittingReturn"
                      @click="removeReturnPhoto(photo.preview)"
                    >
                      <span aria-hidden="true">&times;</span>
                      <span class="sr-only">Remove photo</span>
                    </button>
                  </div>
                </div>
              </div>

              <p v-if="returnFormError" class="mt-3 text-sm font-medium text-red-600">{{ returnFormError }}</p>

              <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-gray-600">
                  Estimated refund:
                  <span class="font-semibold text-gray-900">${{ Number(getReturnFormRefund(order)).toLocaleString() }}</span>
                </p>
                <button
                  type="submit"
                  class="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
                  :disabled="submittingReturn"
                >
                  {{ submittingReturn ? 'Submitting...' : 'Submit Return' }}
                </button>
              </div>
            </form>
          </article>
        </div>
      </div>

      <div v-else-if="activeTab === 'invoices'" class="space-y-6">
        <div class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">Invoices</h2>
              <p class="text-sm text-gray-500">
                View invoices for paid orders and download PDF copies.
              </p>
            </div>
            <span class="text-sm font-medium text-gray-500">
              {{ invoices.length }} {{ invoices.length === 1 ? 'invoice' : 'invoices' }}
            </span>
          </div>
        </div>

        <div v-if="invoicesLoading" class="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-500 shadow-sm">
          Loading your invoices...
        </div>

        <div
          v-else-if="invoicesError"
          class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm"
        >
          {{ invoicesError }}
        </div>

        <div
          v-else-if="invoices.length === 0"
          class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 shadow-sm"
        >
          You have no invoices yet.
        </div>

        <div v-else class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div class="hidden grid-cols-[1.1fr_1fr_0.7fr_0.8fr_0.8fr] gap-4 border-b border-gray-100 bg-gray-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
            <span>Invoice</span>
            <span>Order</span>
            <span>Amount</span>
            <span>Date</span>
            <span class="text-right">PDF</span>
          </div>

          <div class="divide-y divide-gray-100">
            <article
              v-for="invoice in invoices"
              :key="invoice.id"
              class="grid gap-4 px-6 py-5 md:grid-cols-[1.1fr_1fr_0.7fr_0.8fr_0.8fr] md:items-center"
            >
              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 md:hidden">Invoice</p>
                <p class="font-semibold text-gray-900">{{ invoice.invoiceNumber }}</p>
                <span
                  class="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                  :class="getInvoiceStatusClass(invoice.status)"
                >
                  {{ formatInvoiceStatus(invoice.status) }}
                </span>
              </div>

              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 md:hidden">Order</p>
                <p class="font-medium text-gray-800">#{{ invoice.orderId.slice(-8).toUpperCase() }}</p>
              </div>

              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 md:hidden">Amount</p>
                <p class="font-semibold text-gray-900">${{ Number(invoice.amount || 0).toLocaleString() }}</p>
              </div>

              <div>
                <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 md:hidden">Date</p>
                <p class="text-sm text-gray-600">{{ formatDate(invoice.createdAt) }}</p>
              </div>

              <div class="flex md:justify-end">
                <button
                  type="button"
                  class="inline-flex items-center rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300"
                  :disabled="downloadingInvoiceId === invoice.id"
                  @click="handleDownloadInvoice(invoice)"
                >
                  {{ downloadingInvoiceId === invoice.id ? 'Downloading...' : 'Download' }}
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div v-else-if="activeTab === 'returns'" class="space-y-6">
        <div class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">Return Requests</h2>
              <p class="text-sm text-gray-500">
                Track submitted product returns and their review status.
              </p>
            </div>
            <span class="text-sm font-medium text-gray-500">
              {{ returnRequests.length }} {{ returnRequests.length === 1 ? 'request' : 'requests' }}
            </span>
          </div>
        </div>

        <div v-if="returnRequestsLoading" class="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-500 shadow-sm">
          Loading your return requests...
        </div>

        <div
          v-else-if="returnRequestsError"
          class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm"
        >
          {{ returnRequestsError }}
        </div>

        <div
          v-else-if="returnRequests.length === 0"
          class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 shadow-sm"
        >
          You have no return requests yet.
        </div>

        <div v-else class="space-y-4">
          <article
            v-for="request in returnRequests"
            :key="request.id"
            class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
          >
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div class="flex flex-wrap items-center gap-3">
                  <h3 class="font-semibold text-gray-900">Order #{{ request.orderId.slice(-8).toUpperCase() }}</h3>
                  <span
                    class="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                    :class="getReturnStatusClass(request.status)"
                  >
                    {{ formatReturnStatus(request.status) }}
                  </span>
                </div>
                <p class="mt-2 text-sm text-gray-500">Submitted on {{ formatDate(request.createdAt) }}</p>
              </div>
              <p class="text-sm text-gray-600">
                Refund:
                <span class="font-semibold text-gray-900">${{ Number(request.refundAmount || 0).toLocaleString() }}</span>
              </p>
            </div>

            <div class="mt-4 space-y-2">
              <div
                v-for="item in request.items"
                :key="`${request.id}-${item.productId}`"
                class="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700"
              >
                <span class="font-semibold text-gray-900">{{ item.name }}</span>
                <span class="text-gray-500"> - Qty {{ item.quantity }}</span>
              </div>
            </div>

            <p class="mt-4 text-sm text-gray-600">{{ request.reason }}</p>
            <div v-if="request.photoUrls?.length" class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <a
                v-for="photoUrl in request.photoUrls"
                :key="photoUrl"
                :href="resolveAssetUrl(photoUrl)"
                target="_blank"
                rel="noopener noreferrer"
                class="block overflow-hidden rounded-xl border border-gray-100 bg-gray-50"
              >
                <img
                  :src="resolveAssetUrl(photoUrl)"
                  alt="Return request photo"
                  class="aspect-square w-full object-cover transition hover:opacity-90"
                />
              </a>
            </div>
            <p
              v-if="request.status === 'rejected' && request.managerNotes"
              class="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <span class="font-semibold">Rejection reason:</span> {{ request.managerNotes }}
            </p>
          </article>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-xl font-semibold text-gray-900">Wishlist</h2>
              <p class="text-sm text-gray-500">
                View your saved products and jump back to their details.
              </p>
            </div>
            <span class="text-sm font-medium text-gray-500">
              {{ wishlistItems.length }} {{ wishlistItems.length === 1 ? 'item' : 'items' }}
            </span>
          </div>
        </div>

        <div v-if="wishlistLoading" class="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-500 shadow-sm">
          Loading your wishlist...
        </div>

        <div
          v-else-if="wishlistError"
          class="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm"
        >
          {{ wishlistError }}
        </div>

        <div
          v-else-if="wishlistItems.length === 0"
          class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500 shadow-sm"
        >
          You have no saved products yet.
        </div>

        <div v-else class="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="item in wishlistItems"
            :key="item.productId"
            class="relative rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <button
              type="button"
              class="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:border-red-300 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="removingWishlistProductId === item.productId"
              @click="removeWishlistProduct(item.productId)"
            >
              <span aria-hidden="true">&times;</span>
              <span class="sr-only">Remove from wishlist</span>
            </button>

            <router-link :to="`/products/${item.product.productId}`" class="block">
              <div class="aspect-[4/3] overflow-hidden rounded-xl bg-gray-100">
                <img
                  v-if="item.product.imageUrl"
                  :src="item.product.imageUrl"
                  :alt="`${item.product.model} by ${item.product.name}`"
                  class="h-full w-full object-cover"
                />
                <div
                  v-else
                  class="flex h-full w-full items-center justify-center text-sm text-gray-400"
                >
                  No Image
                </div>
              </div>

              <h3 class="mt-4 line-clamp-2 min-h-[48px] font-semibold text-gray-900">
                {{ item.product.model }}
              </h3>
              <p class="mt-1 text-sm text-gray-500">{{ item.product.name }}</p>
              <p class="mt-3 line-clamp-2 min-h-[40px] text-sm text-gray-600">
                {{ item.product.description }}
              </p>

              <div class="mt-4">

                <div v-if="item.product.hasDiscount">

                  <p class="text-sm text-red-500 line-through">
                    ${{ Number(item.product.originalPrice).toLocaleString() }}
                  </p>

                  <div class="flex items-center gap-2">

                    <p class="text-lg font-bold text-green-600">
                      ${{ Number(item.product.discountedPrice).toLocaleString() }}
                    </p>

                    <span
                      class="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"
                    >
                      -{{ item.product.discountPercentage }}%
                    </span>

                  </div>

                  <p class="text-xs text-orange-600 mt-1">
                    {{ item.product.activeCampaignName }}
                  </p>

                </div>

                <div v-else>

                  <p class="text-lg font-bold text-orange-600">
                    ${{ Number(item.product.price).toLocaleString() }}
                  </p>

                </div>

                <p class="text-xs text-gray-500">
                  Stock: {{ item.product.quantityInStock ?? 'N/A' }}
                </p>

              </div>
            </router-link>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProfile, resolveAssetUrl, updateProfile } from '../api/authApi'
import { downloadInvoice, getMyInvoices } from '../api/invoiceApi'
import { cancelOrder, getMyOrders } from '../api/orderApi'
import { getMyReturnRequests, submitReturnRequest } from '../api/returnApi'
import { authStore } from '../store/auth'
import { wishlistStore } from '../store/wishlist'
import {
  canRequestReturn as canRequestReturnForItem,
  createEmptyReturnForm,
  getApprovedReturnedQuantityForItem as getApprovedReturnedQuantityForItemFromRequests,
  getPendingReturnQuantityForItem as getPendingReturnQuantityForItemFromRequests,
  getRemainingReturnQuantity as getRemainingReturnQuantityFromRequests,
  getReturnEligibilityStatus as getReturnEligibilityStatusForItem,
  getReturnWindowDeadline as getReturnWindowDeadlineForOrder,
  hasPendingReturnForItem as hasPendingReturnForItemFromRequests,
  isWithinReturnWindow as isWithinReturnWindowForOrder,
  loadCustomerReturnRequests,
  submitReturnRequestFlow,
} from '../utils/profileReturns'

const route = useRoute()
const router = useRouter()

const user = ref({})
const loading = ref(true)
const error = ref('')
const isEditing = ref(false)
const saving = ref(false)
const formError = ref('')
const formMessage = ref('')
const photoError = ref('')
const orders = ref([])
const ordersLoading = ref(false)
const ordersError = ref('')
const invoices = ref([])
const invoicesLoading = ref(false)
const invoicesError = ref('')
const returnRequests = ref([])
const returnRequestsLoading = ref(false)
const returnRequestsError = ref('')
const wishlistLoading = ref(false)
const wishlistError = ref('')
const removingWishlistProductId = ref('')
const downloadingInvoiceId = ref('')
const cancellingOrderId = ref('')
const submittingReturn = ref(false)
const returnFormError = ref('')
const photoInput = ref(null)
const returnPhotoInput = ref(null)
const selectedPhotoFile = ref(null)
const selectedPhotoPreview = ref('')
const shouldRemovePhoto = ref(false)
const fieldErrors = ref({
  name: '',
  taxId: '',
  address: '',
})

const form = ref({
  name: '',
  taxId: '',
  address: '',
  profileImage: '',
})

const returnForm = ref(createEmptyReturnForm())

const tabs = computed(() => {
  const baseTabs = [
    { id: 'profile', label: 'Profile Details' },
    { id: 'orders', label: 'Order Tracking' },
    { id: 'invoices', label: 'Invoices' },
  ]

  if (user.value.role === 'customer') {
    baseTabs.push({ id: 'returns', label: 'Returns' })
    baseTabs.push({ id: 'wishlist', label: 'Wishlist' })
  }

  return baseTabs
})

const activeTab = computed(() => {
  if (route.query.tab === 'orders') return 'orders'
  if (route.query.tab === 'invoices') return 'invoices'
  if (route.query.tab === 'returns' && user.value.role === 'customer') return 'returns'
  if (route.query.tab === 'wishlist' && user.value.role === 'customer') return 'wishlist'
  return 'profile'
})

const wishlistItems = computed(() => wishlistStore.items || [])

const displayProfileImage = computed(() => {
  if (isEditing.value && selectedPhotoPreview.value) {
    return selectedPhotoPreview.value
  }

  if (isEditing.value && shouldRemovePhoto.value) {
    return ''
  }

  return form.value.profileImage || user.value.profileImage || ''
})

const getProfileImageUrl = (value) => resolveAssetUrl(value)

const setActiveTab = (tabId) => {
  const nextQuery = { ...route.query }

  if (tabId === 'orders' || tabId === 'invoices' || tabId === 'returns' || tabId === 'wishlist') {
    nextQuery.tab = tabId
  } else {
    delete nextQuery.tab
  }

  router.replace({
    query: nextQuery,
  })
}

const fetchProfile = async () => {
  try {
    const res = await getProfile()
    user.value = res.data.user
    syncFormWithUser()

    if (user.value.role === 'customer' && activeTab.value === 'orders') {
      await fetchReturnRequests()
    }
  } catch (err) {
    error.value = err?.response?.data?.message || 'Failed to load profile. Please try again.'
  } finally {
    loading.value = false
  }
}

const fetchOrders = async () => {
  ordersLoading.value = true
  ordersError.value = ''

  try {
    const res = await getMyOrders()
    orders.value = res.data.orders || []
    if (user.value.role === 'customer') {
      await fetchReturnRequests()
    }
  } catch (err) {
    ordersError.value = err?.response?.data?.message || 'Failed to load orders. Please try again.'
  } finally {
    ordersLoading.value = false
  }
}

const fetchReturnRequests = async () => {
  returnRequestsLoading.value = true
  returnRequestsError.value = ''

  try {
    returnRequests.value = await loadCustomerReturnRequests({
      userRole: user.value.role,
      getMyReturnRequests,
    })
  } catch (err) {
    returnRequestsError.value = err?.response?.data?.message || 'Failed to load return requests. Please try again.'
  } finally {
    returnRequestsLoading.value = false
  }
}

const fetchInvoices = async () => {
  invoicesLoading.value = true
  invoicesError.value = ''

  try {
    const res = await getMyInvoices()
    invoices.value = res.data.invoices || []
  } catch (err) {
    invoicesError.value = err?.response?.data?.message || 'Failed to load invoices. Please try again.'
  } finally {
    invoicesLoading.value = false
  }
}

const fetchWishlist = async () => {
  if (user.value.role !== 'customer') {
    wishlistStore.clear()
    return
  }

  wishlistLoading.value = true
  wishlistError.value = ''

  try {
    await wishlistStore.ensureLoaded(true)
  } catch (err) {
    wishlistError.value = err?.response?.data?.message || 'Failed to load wishlist. Please try again.'
  } finally {
    wishlistLoading.value = false
  }
}

const formatRole = (role) => {
  const roles = {
    customer: 'Customer',
    sales_manager: 'Sales Manager',
    product_manager: 'Product Manager',
  }
  return roles[role] || role
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const formatDateTime = (dateStr) => {
  if (!dateStr) return 'Unknown'
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatPaymentStatus = (status) => {
  const labels = {
    pending_payment: 'Pending Payment',
    paid: 'Paid',
    payment_failed: 'Payment Failed',
    cancelled: 'Cancelled',
  }
  return labels[status] || status
}

const formatDeliveryStatus = (status) => {
  const labels = {
    processing: 'Processing',
    shipped: 'In transit',
    out_for_delivery: 'In transit',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
  }
  return labels[status] || status
}

const formatInvoiceStatus = (status) => {
  const labels = {
    generated: 'Generated',
    emailed: 'Emailed',
    failed: 'Email Failed',
  }
  return labels[status] || status
}

const formatReturnStatus = (status) => {
  const labels = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }
  return labels[status] || status
}

const getDisplayTimeline = (order) => {
  const timeline = Array.isArray(order.timeline) ? order.timeline : []
  const shippedStep = timeline.find((step) => step.key === 'shipped')
  const visibleTimeline = timeline
    .filter((step) => step.key !== 'shipped')
    .map((step) => ({
      ...step,
      label: step.key === 'out_for_delivery' ? 'In transit' : step.label,
    }))

  const normalizedTimeline =
    shippedStep?.state === 'current'
      ? visibleTimeline.map((step) => {
          if (step.key === 'processing') return { ...step, state: 'completed' }
          if (step.key === 'out_for_delivery') return { ...step, state: 'current' }
          return step
        })
      : visibleTimeline

  return normalizedTimeline.map((step, index) => ({
    ...step,
    isLast: index === normalizedTimeline.length - 1,
  }))
}

const getDeliveryBadgeClass = (status) => {
  const classes = {
    processing: 'bg-amber-100 text-amber-700',
    shipped: 'bg-blue-100 text-blue-700',
    out_for_delivery: 'bg-purple-100 text-purple-700',
    delivered: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-red-100 text-red-700',
  }
  return classes[status] || 'bg-gray-100 text-gray-700'
}

const getInvoiceStatusClass = (status) => {
  const classes = {
    generated: 'bg-blue-100 text-blue-700',
    emailed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-amber-100 text-amber-700',
  }
  return classes[status] || 'bg-gray-100 text-gray-700'
}

const getReturnStatusClass = (status) => {
  const classes = {
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-emerald-100 text-emerald-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return classes[status] || 'bg-gray-100 text-gray-700'
}

const goToProductReview = (productId) => {
  router.push({
    path: `/products/${productId}`,
    query: { review: '1' },
  })
}

const canCancelOrder = (order) => {
  return order.status === 'paid' && order.deliveryStatus === 'processing'
}

const getReturnRequestsForOrder = (orderId) => {
  return returnRequests.value.filter((request) => request.orderId === orderId && request.status !== 'rejected')
}

const getPendingReturnQuantityForItem = (orderId, productId) => {
  return getPendingReturnQuantityForItemFromRequests(returnRequests.value, orderId, productId)
}

const getApprovedReturnedQuantityForItem = (orderId, productId) => {
  return getApprovedReturnedQuantityForItemFromRequests(returnRequests.value, orderId, productId)
}

const hasPendingReturnForItem = (orderId, productId) => {
  return hasPendingReturnForItemFromRequests(returnRequests.value, orderId, productId)
}

const getRemainingReturnQuantity = (order, item) => {
  return getRemainingReturnQuantityFromRequests(returnRequests.value, order, item)
}

const isItemFullyReturned = (order, item) => {
  return getRemainingReturnQuantity(order, item) === 0
}

const canReviewItem = (order, item) => {
  return order.deliveryStatus === 'delivered' && !isItemFullyReturned(order, item)
}

const getReviewButtonLabel = (order, item) => {
  if (isItemFullyReturned(order, item)) return 'Return Requested'
  return order.deliveryStatus === 'delivered' ? 'Leave Review' : 'Available after delivery'
}

const getReturnWindowDeadline = (order) => {
  return getReturnWindowDeadlineForOrder(order)
}

const isWithinReturnWindow = (order) => {
  return isWithinReturnWindowForOrder(order)
}

const getReturnEligibilityStatus = (order, item) => {
  return getReturnEligibilityStatusForItem({
    userRole: user.value.role,
    order,
    item,
    returnRequests: returnRequests.value,
    formatDate,
  })
}

const canRequestReturn = (order, item) => {
  return canRequestReturnForItem({
    userRole: user.value.role,
    order,
    item,
    returnRequests: returnRequests.value,
  })
}

const startReturnRequest = (order, item) => {
  clearReturnPhotoPreviews()
  returnFormError.value = ''
  returnForm.value = {
    ...createEmptyReturnForm(),
    orderId: order.id,
    items: [{ productId: item.productId, quantity: 1 }],
  }
}

const getReturnPhotoInput = () => {
  if (Array.isArray(returnPhotoInput.value)) {
    return returnPhotoInput.value.find(Boolean) || null
  }

  return returnPhotoInput.value
}

const cancelReturnRequest = () => {
  clearReturnPhotoPreviews()
  returnFormError.value = ''
  returnForm.value = createEmptyReturnForm()
  const input = getReturnPhotoInput()
  if (input) {
    input.value = ''
  }
}

const isReturnItemSelected = (productId) => {
  return returnForm.value.items.some((item) => item.productId === productId)
}

const getReturnItemQuantity = (productId) => {
  return returnForm.value.items.find((item) => item.productId === productId)?.quantity ?? ''
}

const toggleReturnItem = (item, checked) => {
  if (checked) {
    if (!isReturnItemSelected(item.productId)) {
      returnForm.value.items.push({ productId: item.productId, quantity: 1 })
    }
    return
  }

  returnForm.value.items = returnForm.value.items.filter(
    (selectedItem) => selectedItem.productId !== item.productId
  )
}

const updateReturnItemQuantity = (item, value) => {
  let nextQuantity = value

  if (value !== '') {
    const parsedQuantity = Number(value)
    const order = orders.value.find((candidateOrder) => candidateOrder.id === returnForm.value.orderId)
    const maxQuantity = order ? getRemainingReturnQuantity(order, item) : Number(item.quantity || 1)

    if (!Number.isFinite(parsedQuantity)) {
      nextQuantity = ''
    } else if (parsedQuantity > maxQuantity) {
      nextQuantity = maxQuantity
    } else if (parsedQuantity < 1) {
      nextQuantity = value
    } else {
      nextQuantity = Math.floor(parsedQuantity)
    }
  }

  returnForm.value.items = returnForm.value.items.map((selectedItem) =>
    selectedItem.productId === item.productId
      ? { ...selectedItem, quantity: nextQuantity }
      : selectedItem
  )
}

const normalizeReturnItemQuantity = (item) => {
  const order = orders.value.find((candidateOrder) => candidateOrder.id === returnForm.value.orderId)
  const selectedItem = returnForm.value.items.find(
    (returnItem) => returnItem.productId === item.productId
  )
  const parsedQuantity = Number(selectedItem?.quantity)
  const maxQuantity = order ? getRemainingReturnQuantity(order, item) : Number(item.quantity || 1)
  const boundedQuantity = Math.min(
    maxQuantity,
    Math.max(1, Number.isInteger(parsedQuantity) ? parsedQuantity : 1)
  )

  returnForm.value.items = returnForm.value.items.map((returnItem) =>
    returnItem.productId === item.productId
      ? { ...returnItem, quantity: boundedQuantity }
      : returnItem
  )
}

const getReturnFormRefund = (order) => {
  const quantityByProductId = returnForm.value.items.reduce((acc, item) => {
    acc[item.productId] = Number(item.quantity || 0)
    return acc
  }, {})

  return order.items.reduce((total, item) => {
    const returnQuantity = quantityByProductId[item.productId] || 0
    return total + Number(item.unitPrice || 0) * returnQuantity
  }, 0)
}

const openReturnPhotoPicker = () => {
  if (submittingReturn.value || returnForm.value.photos.length >= 5) {
    return
  }

  getReturnPhotoInput()?.click()
}

const clearReturnPhotoPreviews = () => {
  returnForm.value.photos.forEach((photo) => {
    window.URL.revokeObjectURL(photo.preview)
  })
}

const handleReturnPhotosSelected = (event) => {
  returnFormError.value = ''
  const files = Array.from(event.target.files || [])

  if (!files.length) {
    return
  }

  const remainingSlots = 5 - returnForm.value.photos.length

  if (files.length > remainingSlots) {
    returnFormError.value = `You can attach up to 5 photos per return request.`
  }

  const validPhotos = []

  for (const file of files.slice(0, remainingSlots)) {
    if (!file.type.startsWith('image/')) {
      returnFormError.value = 'Only image files can be attached.'
      continue
    }

    if (file.size > 5 * 1024 * 1024) {
      returnFormError.value = 'Each return photo must be smaller than 5MB.'
      continue
    }

    validPhotos.push({
      file,
      preview: window.URL.createObjectURL(file),
    })
  }

  returnForm.value.photos = [...returnForm.value.photos, ...validPhotos]
  event.target.value = ''
}

const removeReturnPhoto = (preview) => {
  const photoToRemove = returnForm.value.photos.find((photo) => photo.preview === preview)
  if (photoToRemove) {
    window.URL.revokeObjectURL(photoToRemove.preview)
  }

  returnForm.value.photos = returnForm.value.photos.filter((photo) => photo.preview !== preview)
}

const handleSubmitReturnRequest = async (order) => {
  returnFormError.value = ''
  submittingReturn.value = true

  try {
    await submitReturnRequestFlow({
      order,
      returnForm: returnForm.value,
      returnRequests: returnRequests.value,
      submitReturnRequest,
      fetchReturnRequests,
      resetReturnForm: cancelReturnRequest,
    })
  } catch (err) {
    returnFormError.value =
      err?.response?.data?.message ||
      err?.message ||
      'Failed to submit return request. Please try again.'
  } finally {
    submittingReturn.value = false
  }
}

const handleCancelOrder = async (order) => {
  cancellingOrderId.value = order.id
  ordersError.value = ''

  try {
    await cancelOrder(order.id)
    await fetchOrders()
  } catch (err) {
    ordersError.value = err?.response?.data?.message || 'Failed to cancel order. Please try again.'
  } finally {
    cancellingOrderId.value = ''
  }
}

const handleDownloadInvoice = async (invoice) => {
  downloadingInvoiceId.value = invoice.id
  invoicesError.value = ''

  try {
    const res = await downloadInvoice(invoice.id)
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${invoice.invoiceNumber}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    invoicesError.value = err?.response?.data?.message || 'Failed to download invoice. Please try again.'
  } finally {
    downloadingInvoiceId.value = ''
  }
}

const removeWishlistProduct = async (productId) => {
  removingWishlistProductId.value = productId
  wishlistError.value = ''

  try {
    await wishlistStore.toggle(productId)
  } catch (err) {
    wishlistError.value = err?.response?.data?.message || 'Failed to remove wishlist item. Please try again.'
  } finally {
    removingWishlistProductId.value = ''
  }
}

const getTimelineDotClass = (state) => {
  const classes = {
    completed: 'bg-orange-500 text-white',
    current: 'bg-orange-100 text-orange-700 ring-4 ring-orange-50',
    pending: 'bg-gray-100 text-gray-400',
  }
  return classes[state] || classes.pending
}

const getTimelineMarker = (step) => {
  if (step.state === 'completed') return 'OK'
  if (step.state === 'current') return 'NOW'

  const markers = {
    processing: 'P',
    shipped: 'S',
    out_for_delivery: 'I',
    delivered: 'D',
    cancelled: 'X',
  }

  return markers[step.key] || step.label.slice(0, 1).toUpperCase()
}

const formatTimelineState = (state) => {
  const labels = {
    completed: 'Completed',
    current: 'Current Step',
    pending: 'Upcoming',
  }
  return labels[state] || state
}

const syncFormWithUser = () => {
  form.value = {
    name: user.value.name || '',
    taxId: user.value.taxId || '',
    address: user.value.address || '',
    profileImage: user.value.profileImage || '',
  }
}

const startEditing = () => {
  formError.value = ''
  formMessage.value = ''
  photoError.value = ''
  clearFieldErrors()
  syncFormWithUser()
  selectedPhotoFile.value = null
  selectedPhotoPreview.value = ''
  shouldRemovePhoto.value = false
  isEditing.value = true
}

const cancelEditing = () => {
  formError.value = ''
  formMessage.value = ''
  photoError.value = ''
  clearFieldErrors()
  syncFormWithUser()
  selectedPhotoFile.value = null
  selectedPhotoPreview.value = ''
  shouldRemovePhoto.value = false
  if (photoInput.value) {
    photoInput.value.value = ''
  }
  isEditing.value = false
}

const clearFieldErrors = () => {
  fieldErrors.value = {
    name: '',
    taxId: '',
    address: '',
  }
}

const clearFieldError = (fieldName) => {
  fieldErrors.value[fieldName] = ''
}

const openPhotoPicker = () => {
  photoInput.value?.click()
}

const handlePhotoSelected = (event) => {
  photoError.value = ''
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  if (!file.type.startsWith('image/')) {
    photoError.value = 'Please choose a valid image file.'
    event.target.value = ''
    return
  }

  if (file.size > 2 * 1024 * 1024) {
    photoError.value = 'Please choose an image smaller than 2MB.'
    event.target.value = ''
    return
  }

  selectedPhotoFile.value = file
  selectedPhotoPreview.value = URL.createObjectURL(file)
  shouldRemovePhoto.value = false
}

const removePhoto = () => {
  photoError.value = ''
  form.value.profileImage = ''
  selectedPhotoFile.value = null
  selectedPhotoPreview.value = ''
  shouldRemovePhoto.value = true
  if (photoInput.value) {
    photoInput.value.value = ''
  }
}

const validateForm = (payload) => {
  clearFieldErrors()

  if (!payload.name) {
    fieldErrors.value.name = 'Name is required.'
  }

  if (!payload.taxId) {
    fieldErrors.value.taxId = 'Tax ID is required.'
  }

  if (!payload.address) {
    fieldErrors.value.address = 'Address is required.'
  }

  return !fieldErrors.value.name && !fieldErrors.value.taxId && !fieldErrors.value.address
}

const saveProfile = async () => {
  formError.value = ''
  formMessage.value = ''

  const payload = {
    name: form.value.name.trim(),
    taxId: form.value.taxId.trim(),
    address: form.value.address.trim(),
  }

  if (!validateForm(payload)) {
    formError.value = 'Name, tax ID, and address are required.'
    const firstInvalidField =
      (!payload.name && document.getElementById('name')) ||
      (!payload.taxId && document.getElementById('taxId')) ||
      (!payload.address && document.getElementById('address'))

    firstInvalidField?.focus()
    return
  }

  saving.value = true

  try {
    const formData = new FormData()
    formData.append('name', payload.name)
    formData.append('taxId', payload.taxId)
    formData.append('address', payload.address)

    if (selectedPhotoFile.value) {
      formData.append('profileImage', selectedPhotoFile.value)
    }

    if (shouldRemovePhoto.value) {
      formData.append('removeProfileImage', 'true')
    }

    const res = await updateProfile(formData)
    user.value = res.data.user
    clearFieldErrors()
    photoError.value = ''
    selectedPhotoFile.value = null
    selectedPhotoPreview.value = ''
    shouldRemovePhoto.value = false

    authStore.updateUser({
      ...authStore.user,
      name: res.data.user.name,
      email: res.data.user.email,
      role: res.data.user.role,
      profileImage: res.data.user.profileImage || '',
    })

    syncFormWithUser()
    isEditing.value = false
    formMessage.value = 'Profile updated successfully.'
  } catch (err) {
    formError.value = err.response?.data?.message || 'Failed to update profile. Please try again.'
  } finally {
    saving.value = false
  }
}

watch(
  () => activeTab.value,
  (tab) => {
    if (tab === 'orders' && !ordersLoading.value) {
      fetchOrders()
    }

    if (tab === 'invoices' && !invoicesLoading.value) {
      fetchInvoices()
    }

    if (tab === 'returns' && !returnRequestsLoading.value) {
      fetchReturnRequests()
    }

    if (tab === 'wishlist' && !wishlistLoading.value) {
      fetchWishlist()
    }
  },
  { immediate: true }
)

onMounted(fetchProfile)
onUnmounted(clearReturnPhotoPreviews)
</script>

<template>
  <div class="max-w-4xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6 text-gray-800">My Return Requests</h1>

    <div v-if="isLoading" class="text-center py-10">Loading your returns...</div>
    <div v-else-if="requests.length === 0" class="text-center py-10 bg-white rounded shadow text-gray-500">
      You have no return history.
    </div>

    <div v-else class="space-y-4">
      <div v-for="req in requests" :key="req.id || req._id" class="bg-white p-5 rounded-lg shadow border border-gray-200">
        <div class="flex justify-between items-start mb-4">
          <div>
            <h3 class="font-semibold text-gray-800">Order ID: {{ req.orderId }}</h3>
            <p class="text-sm text-gray-500">Requested: {{ new Date(req.createdAt).toLocaleDateString() }}</p>
          </div>
          <span :class="{
            'bg-yellow-100 text-yellow-800': req.status === 'pending',
            'bg-green-100 text-green-800': req.status === 'approved',
            'bg-red-100 text-red-800': req.status === 'rejected'
          }" class="px-3 py-1 rounded-full text-xs font-bold uppercase">
            {{ req.status }}
          </span>
        </div>

        <ul class="text-sm text-gray-700 list-disc pl-5 mb-4">
          <li v-for="item in req.items" :key="item.productId">{{ item.quantity }}x {{ item.name }}</li>
        </ul>

        <div v-if="req.photoUrls?.length" class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <a
            v-for="photoUrl in req.photoUrls"
            :key="photoUrl"
            :href="resolveAssetUrl(photoUrl)"
            target="_blank"
            rel="noopener noreferrer"
            class="block overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
          >
            <img
              :src="resolveAssetUrl(photoUrl)"
              alt="Return request photo"
              class="aspect-square w-full object-cover transition hover:opacity-90"
            />
          </a>
        </div>

        <div class="flex justify-between items-end border-t pt-4">
          <div>
            <p v-if="req.resolvedAt" class="text-xs text-gray-500 mb-1">
              Resolved on: {{ new Date(req.resolvedAt).toLocaleDateString() }}
            </p>
            <p v-if="req.status === 'rejected' && req.managerNotes" class="text-sm text-red-600">
              <span class="font-bold">Reason:</span> {{ req.managerNotes }}
            </p>
          </div>
          <div class="text-right">
            <span class="text-sm text-gray-500 block">Refund Amount</span>
            <span class="font-bold text-lg text-gray-900">${{ Number(req.refundAmount || 0).toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getMyReturnRequests } from '../api/returnApi'
import { resolveAssetUrl } from '../api/authApi'

const requests = ref([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const res = await getMyReturnRequests()
    requests.value = res.data.returnRequests || []
  } catch (error) {
    console.error("Failed to load customer returns:", error)
  } finally {
    isLoading.value = false
  }
})
</script>

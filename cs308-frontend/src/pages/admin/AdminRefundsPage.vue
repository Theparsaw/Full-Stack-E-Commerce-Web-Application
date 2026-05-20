<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6 text-gray-800">Return Requests</h1>

    <div class="flex space-x-2 mb-6">
      <button 
        @click="currentTab = 'pending'" 
        :class="currentTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'" 
        class="px-4 py-2 rounded font-medium transition-colors">
        Pending Requests
      </button>
      <button 
        @click="currentTab = 'history'" 
        :class="currentTab === 'history' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'" 
        class="px-4 py-2 rounded font-medium transition-colors">
        Return History
      </button>
    </div>

    <div v-if="isLoading" class="text-center text-gray-500 py-10">Loading requests...</div>
    <div v-else-if="requests.length === 0" class="text-center text-gray-500 py-10 bg-white rounded shadow">
      No {{ currentTab }} return requests found.
    </div>

    <div v-else class="bg-white shadow rounded-lg overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photos</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th v-if="currentTab === 'pending'" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            <th v-if="currentTab === 'history'" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resolution</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="req in requests" :key="req._id">
            <td class="px-6 py-4">
              <div class="text-sm font-medium text-gray-900">{{ req.userId?.name || 'Unknown' }}</div>
              <div class="text-sm text-gray-500">{{ req.userId?.email || 'N/A' }}</div>
            </td>
            <td class="px-6 py-4">
              <ul class="text-sm text-gray-700 list-disc pl-4">
                <li v-for="item in req.items" :key="item.productId">{{ item.quantity }}x {{ item.name }}</li>
              </ul>
            </td>
            <td class="px-6 py-4 text-sm text-gray-700 max-w-xs truncate" :title="req.reason">{{ req.reason }}</td>
            <td class="px-6 py-4">
              <div v-if="req.photoUrls?.length" class="flex flex-wrap gap-2">
                <a
                  v-for="photoUrl in req.photoUrls"
                  :key="photoUrl"
                  :href="resolveAssetUrl(photoUrl)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block h-14 w-14 overflow-hidden rounded border border-gray-200 bg-gray-50"
                >
                  <img
                    :src="resolveAssetUrl(photoUrl)"
                    alt="Return evidence"
                    class="h-full w-full object-cover transition hover:opacity-90"
                  />
                </a>
              </div>
              <span v-else class="text-sm text-gray-400">No photos</span>
            </td>
            <td class="px-6 py-4 text-sm font-semibold text-gray-900">${{ req.refundAmount.toFixed(2) }}</td>
            
            <td v-if="currentTab === 'pending'" class="px-6 py-4 text-center space-x-2">
              <button @click="approve(req._id)" class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm">Approve</button>
              <button @click="openRejectModal(req._id)" class="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm">Reject</button>
            </td>

            <td v-if="currentTab === 'history'" class="px-6 py-4">
              <span :class="req.status === 'approved' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'" class="px-2 py-1 text-xs font-bold rounded uppercase">
                {{ req.status }}
              </span>
              <p v-if="req.resolvedAt" class="text-xs text-gray-500 mt-2">On: {{ new Date(req.resolvedAt).toLocaleDateString() }}</p>
              <p v-if="req.status === 'rejected' && req.managerNotes" class="text-xs text-gray-700 mt-1" :title="req.managerNotes">
                <span class="font-bold">Note:</span> {{ req.managerNotes }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 class="text-lg font-bold mb-4">Reject Return</h3>
        <textarea v-model="managerNotes" class="w-full border rounded p-2 mb-4" rows="3" placeholder="Manager Notes..."></textarea>
        <div class="flex justify-end space-x-2">
          <button @click="showModal = false" class="px-4 py-2 bg-gray-200 rounded">Cancel</button>
          <button @click="confirmReject" class="px-4 py-2 bg-red-600 text-white rounded">Confirm</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { getPendingReturnRequests, getReturnHistory, approveReturnRequest, rejectReturnRequest } from '../../api/returnApi'
import { resolveAssetUrl } from '../../api/authApi'

const currentTab = ref('pending')
const requests = ref([])
const isLoading = ref(true)
const showModal = ref(false)
const selectedRequestId = ref(null)
const managerNotes = ref('')

const loadRequests = async () => {
  isLoading.value = true
  try {
    const res = currentTab.value === 'pending' 
      ? await getPendingReturnRequests() 
      : await getReturnHistory()
    requests.value = [...(res.data.data || [])].sort((left, right) => {
      const leftDate = new Date(left.createdAt || left.resolvedAt || 0).getTime()
      const rightDate = new Date(right.createdAt || right.resolvedAt || 0).getTime()
      return rightDate - leftDate
    })
  } catch (error) {
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

// Automatically reload the data whenever the tab is clicked
watch(currentTab, loadRequests)

const approve = async (id) => {
  if (!confirm('Approve return and restore stock?')) return
  try {
    await approveReturnRequest(id)
    loadRequests()
  } catch (error) {
    alert('Failed to approve return.')
  }
}

const openRejectModal = (id) => {
  selectedRequestId.value = id
  managerNotes.value = ''
  showModal.value = true
}

const confirmReject = async () => {
  try {
    await rejectReturnRequest(selectedRequestId.value, managerNotes.value)
    showModal.value = false
    loadRequests()
  } catch (error) {
    alert('Failed to reject return.')
  }
}

onMounted(() => loadRequests())
</script>

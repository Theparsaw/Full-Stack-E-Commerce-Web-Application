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

    <div v-else class="overflow-hidden rounded-lg bg-white shadow">
      <table class="w-full table-fixed divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="w-[24%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
            <th class="w-[14%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
            <th class="w-[23%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
            <th class="w-[13%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photos</th>
            <th class="w-[11%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
            <th v-if="currentTab === 'pending'" class="w-[15%] px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
            <th v-if="currentTab === 'history'" class="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resolution</th>
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
            
            <td v-if="currentTab === 'pending'" class="px-6 py-4">
              <div class="flex flex-col items-center justify-center gap-2 xl:flex-row">
                <button
                  type="button"
                  @click="openApproveModal(req)"
                  :disabled="approvingRequestId === req._id"
                  class="w-24 rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                >
                  {{ approvingRequestId === req._id ? 'Approving' : 'Approve' }}
                </button>
                <button
                  type="button"
                  @click="openRejectModal(req._id)"
                  :disabled="approvingRequestId === req._id"
                  class="w-24 rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  Reject
                </button>
              </div>
            </td>

            <td v-if="currentTab === 'history'" class="px-6 py-4 align-top">
              <span :class="req.status === 'approved' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'" class="px-2 py-1 text-xs font-bold rounded uppercase">
                {{ req.status }}
              </span>
              <p v-if="req.resolvedAt" class="text-xs text-gray-500 mt-2">On: {{ formatDisplayDate(req.resolvedAt) }}</p>
              <p v-if="req.reviewedBy" class="text-xs text-gray-600 mt-1">
                <span class="font-bold">Reviewed by:</span> {{ formatReviewer(req.reviewedBy) }}
              </p>
              <p v-if="req.status === 'rejected' && req.managerNotes" class="text-xs text-gray-700 mt-1" :title="req.managerNotes">
                <span class="font-bold">Reason:</span> {{ req.managerNotes }}
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showApproveModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-96 shadow-xl">
        <h3 class="text-lg font-bold mb-2">Approve Return</h3>
        <p class="text-sm text-gray-700 mb-5">
          Approve this return and restore stock?
        </p>
        <div class="flex justify-end space-x-2">
          <button
            type="button"
            @click="closeApproveModal"
            :disabled="Boolean(approvingRequestId)"
            class="px-4 py-2 bg-gray-200 rounded disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="confirmApprove"
            :disabled="Boolean(approvingRequestId)"
            class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
          >
            {{ approvingRequestId ? 'Approving...' : 'Approve' }}
          </button>
        </div>
      </div>
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
import { formatDisplayDate } from '../../utils/dateFormat'

const currentTab = ref('pending')
const requests = ref([])
const isLoading = ref(true)
const showApproveModal = ref(false)
const showModal = ref(false)
const selectedApproveRequestId = ref(null)
const selectedRequestId = ref(null)
const managerNotes = ref('')
const approvingRequestId = ref(null)

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

const formatReviewer = (reviewer) => {
  if (!reviewer) return 'Unknown'
  if (typeof reviewer === 'string') return reviewer
  return reviewer.name || reviewer.email || 'Unknown'
}

// Automatically reload the data whenever the tab is clicked
watch(currentTab, loadRequests)

const openApproveModal = (request) => {
  if (approvingRequestId.value) return
  selectedApproveRequestId.value = request._id
  showApproveModal.value = true
}

const closeApproveModal = () => {
  if (approvingRequestId.value) return
  showApproveModal.value = false
  selectedApproveRequestId.value = null
}

const confirmApprove = async () => {
  if (approvingRequestId.value || !selectedApproveRequestId.value) return

  approvingRequestId.value = selectedApproveRequestId.value

  try {
    await approveReturnRequest(selectedApproveRequestId.value)
    showApproveModal.value = false
    selectedApproveRequestId.value = null
    await loadRequests()
  } catch (error) {
    alert('Failed to approve return.')
  } finally {
    approvingRequestId.value = null
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

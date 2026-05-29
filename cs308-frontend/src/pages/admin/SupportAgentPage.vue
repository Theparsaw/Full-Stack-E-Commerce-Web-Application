<template>
  <div class="flex gap-4 h-[calc(100vh-160px)]">

    <!-- Left: Conversation List -->
    <div class="w-80 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
      <div>
        <p class="text-sm font-semibold text-orange-600 mb-1">Support Panel</p>
        <h2 class="text-xl font-bold text-gray-900">Live Chat</h2>
      </div>

      <!-- Unclaimed -->
      <div class="rounded-2xl border border-gray-200 bg-white p-3">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Unclaimed ({{ unclaimed.length }})</p>
        <div v-if="unclaimed.length === 0" class="text-sm text-gray-400">No waiting conversations.</div>
        <div
          v-for="conv in unclaimed"
          :key="conv._id"
          class="mb-2 cursor-pointer rounded-xl border border-orange-100 bg-orange-50 p-3 hover:bg-orange-100"
          @click="handleClaim(conv)"
        >
          <p class="font-semibold text-gray-900 text-sm">{{ conv.customerName }}</p>
          <p class="text-xs text-gray-500">{{ conv.customerEmail }}</p>
          <p class="text-xs text-orange-600 mt-1">{{ conv.subject }}</p>
          <button
            class="mt-2 w-full rounded-xl bg-orange-500 py-1 text-xs font-semibold text-white hover:bg-orange-600"
            @click.stop="handleClaim(conv)"
          >
            Claim
          </button>
        </div>
      </div>

      <!-- My Active -->
      <div class="rounded-2xl border border-gray-200 bg-white p-3">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">My Conversations ({{ myConversations.length }})</p>
        <div v-if="myConversations.length === 0" class="text-sm text-gray-400">No active conversations.</div>
        <div
          v-for="conv in myConversations"
          :key="conv._id"
          class="mb-2 cursor-pointer rounded-xl border p-3 transition"
          :class="activeConversation?._id === conv._id
            ? 'border-orange-500 bg-orange-50'
            : 'border-gray-200 bg-white hover:bg-gray-50'"
          @click="selectConversation(conv)"
        >
          <p class="font-semibold text-gray-900 text-sm">{{ conv.customerName }}</p>
          <p class="text-xs text-gray-500">{{ conv.customerEmail }}</p>
          <p class="text-xs text-gray-400 mt-1">{{ conv.subject }}</p>
        </div>
      </div>
    </div>

    <!-- Middle: Chat Window -->
    <div class="flex flex-1 flex-col rounded-3xl border border-gray-200 bg-white overflow-hidden">
      <div v-if="!activeConversation" class="flex h-full items-center justify-center text-gray-400">
        <div class="text-center">
          <p class="text-4xl mb-2">💬</p>
          <p>Select or claim a conversation to start chatting</p>
        </div>
      </div>

      <template v-else>
        <!-- Chat header -->
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <p class="font-bold text-gray-900">{{ activeConversation.customerName }}</p>
            <p class="text-xs text-gray-500">{{ activeConversation.customerEmail }}</p>
          </div>
          <button
            @click="handleCloseConversation"
            class="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            Close Chat
          </button>
        </div>

        <!-- Messages -->
        <div ref="messagesEl" class="flex-1 space-y-3 overflow-y-auto p-4">
          <div v-for="msg in messages" :key="msg._id" class="flex" :class="msg.senderRole === 'support_agent' ? 'justify-end' : 'justify-start'">
            <div
              class="max-w-[70%] rounded-2xl px-4 py-2 text-sm"
              :class="msg.senderRole === 'support_agent' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-800'"
            >
              <p v-if="msg.senderRole !== 'support_agent'" class="mb-1 text-xs font-semibold opacity-60">{{ msg.senderName }}</p>
              <p v-if="msg.text">{{ msg.text }}</p>
              <a
                v-if="msg.attachmentUrl"
                :href="resolveUrl(msg.attachmentUrl)"
                target="_blank"
                class="mt-1 flex items-center gap-1 underline text-xs"
              >
                📎 {{ msg.attachmentName || 'Attachment' }}
              </a>
              <p class="mt-1 text-right text-xs opacity-50">{{ formatTime(msg.createdAt) }}</p>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="border-t border-gray-100 p-3">
          <p v-if="sendError" class="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{{ sendError }}</p>
          <div v-if="selectedFile" class="mb-2 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-700">
            📎 {{ selectedFile.name }}
            <button @click="selectedFile = null" class="ml-auto font-bold">✕</button>
          </div>
          <div class="flex items-end gap-2">
            <label class="cursor-pointer text-gray-400 hover:text-orange-500">
              📎
              <input type="file" class="hidden" accept=".pdf,image/*" @change="handleFileSelected" />
            </label>
            <textarea
              v-model="inputText"
              rows="2"
              placeholder="Type a reply..."
              class="flex-1 resize-none rounded-2xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
              @keydown.enter.exact.prevent="handleSend"
            />
            <button
              @click="handleSend"
              :disabled="sending || (!inputText.trim() && !selectedFile)"
              class="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Right: Customer Context -->
    <div v-if="activeConversation && context" class="w-72 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
      <div class="rounded-2xl border border-gray-200 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Customer</p>
        <p class="font-semibold text-gray-900">{{ context.customer?.name }}</p>
        <p class="text-sm text-gray-500">{{ context.customer?.email }}</p>
        <p class="text-sm text-gray-500 mt-1">{{ context.customer?.address || 'No address' }}</p>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Recent Orders ({{ context.orders?.length }})</p>
        <div v-if="!context.orders?.length" class="text-sm text-gray-400">No orders.</div>
        <div v-for="order in context.orders" :key="order._id" class="mb-2 rounded-xl bg-gray-50 p-2 text-xs">
          <p class="font-semibold text-gray-800">#{{ order._id.slice(-8).toUpperCase() }}</p>
          <p class="text-gray-500">Status: {{ order.status }}</p>
          <p class="text-gray-500">Total: ${{ order.totalPrice }}</p>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Deliveries ({{ context.deliveries?.length }})</p>
        <div v-if="!context.deliveries?.length" class="text-sm text-gray-400">No deliveries.</div>
        <div v-for="d in context.deliveries" :key="d._id" class="mb-2 rounded-xl bg-gray-50 p-2 text-xs">
          <p class="font-semibold text-gray-800">{{ d.status }}</p>
          <p class="text-gray-500">{{ d.address }}</p>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">Wishlist ({{ context.wishlistItems?.length }})</p>
        <div v-if="!context.wishlistItems?.length" class="text-sm text-gray-400">Empty wishlist.</div>
        <div v-for="item in context.wishlistItems" :key="item.productId" class="text-xs text-gray-700 mb-1">
          • {{ item.productId }}
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import {
  getUnclaimedConversations,
  getMyAgentConversations,
  claimConversation,
  getMessages,
  sendMessage,
  getCustomerContext,
  closeConversation,
} from '../../api/chatApi'
import { authStore } from '../../store/auth'

const unclaimed = ref([])
const myConversations = ref([])
const activeConversation = ref(null)
const messages = ref([])
const context = ref(null)
const inputText = ref('')
const selectedFile = ref(null)
const sending = ref(false)
const sendError = ref('')
const messagesEl = ref(null)
let pollInterval = null

const resolveUrl = (url) => {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'}${url}`
}

const formatTime = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
}

const loadLists = async () => {
  try {
    const [u, m] = await Promise.all([
      getUnclaimedConversations(),
      getMyAgentConversations(),
    ])
    unclaimed.value = u.data.conversations || []
    myConversations.value = m.data.conversations || []
  } catch {}
}

const loadMessages = async () => {
  if (!activeConversation.value) return
  try {
    const res = await getMessages(activeConversation.value._id)
    messages.value = res.data.messages || []
    scrollToBottom()
  } catch {}
}

const selectConversation = async (conv) => {
  activeConversation.value = conv
  messages.value = []
  context.value = null
  await loadMessages()
  try {
    const res = await getCustomerContext(conv._id)
    context.value = res.data
  } catch {}
}

const handleClaim = async (conv) => {
  try {
    const res = await claimConversation(conv._id)
    const claimed = res.data.conversation
    unclaimed.value = unclaimed.value.filter(c => c._id !== conv._id)
    myConversations.value = [claimed, ...myConversations.value]
    await selectConversation(claimed)
  } catch {}
}

const handleSend = async () => {
  if ((!inputText.value.trim() && !selectedFile.value) || sending.value) return
  sending.value = true
  sendError.value = ''
  const text = inputText.value.trim()
  const file = selectedFile.value
  inputText.value = ''
  selectedFile.value = null
  try {
    await sendMessage(activeConversation.value._id, text, file)
    await loadMessages()
  } catch (err) {
    sendError.value = err?.response?.data?.message || 'Failed to send message'
    inputText.value = text // restore text on failure
  } finally {
    sending.value = false
  }
}

const handleCloseConversation = async () => {
  if (!activeConversation.value) return
  try {
    await closeConversation(activeConversation.value._id)
    myConversations.value = myConversations.value.filter(c => c._id !== activeConversation.value._id)
    activeConversation.value = null
    messages.value = []
    context.value = null
  } catch {}
}

const handleFileSelected = (e) => {
  selectedFile.value = e.target.files?.[0] || null
}

const startPolling = () => {
  pollInterval = setInterval(async () => {
    await loadLists()
    await loadMessages()
  }, 3000)
}

onMounted(async () => {
  await loadLists()
  startPolling()
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})
</script>

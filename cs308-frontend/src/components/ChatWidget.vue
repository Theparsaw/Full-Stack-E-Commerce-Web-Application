<template>
  <div v-if="authStore.isLoggedIn && authStore.role === 'customer'">
    <!-- Chat toggle button -->
    <button
      @click="toggleChat"
      class="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition hover:bg-orange-600"
    >
      <span v-if="!isOpen" class="text-2xl">💬</span>
      <span v-else class="text-2xl">✕</span>
    </button>

    <!-- Chat window -->
    <div
      v-if="isOpen"
      class="fixed bottom-24 right-6 z-50 flex w-96 flex-col rounded-3xl border border-gray-200 bg-white shadow-2xl"
      style="height: 520px"
    >
      <!-- Header -->
      <div class="flex items-center justify-between rounded-t-3xl bg-orange-500 px-5 py-4 text-white">
        <div>
          <p class="font-bold">Customer Support</p>
          <p class="text-xs opacity-80">
            {{ conversation ? (conversation.status === 'active' ? 'Agent connected' : 'Waiting for agent...') : 'Start a conversation' }}
          </p>
        </div>
        <button
          v-if="conversation && conversation.status !== 'closed'"
          @click="handleClose"
          class="rounded-xl border border-white/30 px-3 py-1 text-xs font-semibold hover:bg-white/10"
        >
          End Chat
        </button>
      </div>

      <!-- Messages -->
      <div ref="messagesEl" class="flex-1 space-y-3 overflow-y-auto p-4">
        <div v-if="!conversation" class="flex h-full items-center justify-center text-center text-gray-400">
          <div>
            <p class="text-4xl mb-2">👋</p>
            <p class="font-medium text-gray-600">Hi! How can we help you?</p>
            <p class="text-sm mt-1">Start a chat and an agent will assist you.</p>
          </div>
        </div>

        <div v-for="msg in messages" :key="msg._id" class="flex" :class="msg.senderId === authStore.user?.id ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-[75%] rounded-2xl px-4 py-2 text-sm"
            :class="msg.senderId === authStore.user?.id
              ? 'bg-orange-500 text-white'
              : 'bg-gray-100 text-gray-800'"
          >
            <p v-if="msg.senderId !== authStore.user?.id" class="mb-1 text-xs font-semibold opacity-60">{{ msg.senderName }}</p>
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
        <div v-if="!conversation" class="flex justify-center">
          <button
            @click="handleStart"
            :disabled="starting"
            class="rounded-2xl bg-orange-500 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {{ starting ? 'Starting...' : 'Start Chat' }}
          </button>
        </div>

        <div v-else-if="conversation.status !== 'closed'" class="space-y-2">
          <!-- Attachment preview -->
          <div v-if="selectedFile" class="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-orange-700">
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
              placeholder="Type a message..."
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

        <div v-else class="text-center text-sm text-gray-400">
          This conversation has been closed.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { authStore } from '../store/auth'
import {
  startConversation,
  getMyConversation,
  getMessages,
  sendMessage,
  closeConversation,
} from '../api/chatApi'

const isOpen = ref(false)
const conversation = ref(null)
const messages = ref([])
const inputText = ref('')
const selectedFile = ref(null)
const sending = ref(false)
const starting = ref(false)
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
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

const loadConversation = async () => {
  try {
    const res = await getMyConversation()
    conversation.value = res.data.conversation
    if (conversation.value) {
      await loadMessages()
    }
  } catch {}
}

const loadMessages = async () => {
  if (!conversation.value) return
  try {
    const res = await getMessages(conversation.value._id)
    messages.value = res.data.messages || []
    scrollToBottom()
  } catch {}
}

const startPolling = () => {
  if (pollInterval) return
  pollInterval = setInterval(loadMessages, 3000)
}

const stopPolling = () => {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

const toggleChat = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value && !conversation.value) {
    await loadConversation()
  }
  if (isOpen.value && conversation.value) {
    startPolling()
  }
}

const handleStart = async () => {
  starting.value = true
  try {
    const res = await startConversation('Support Request')
    conversation.value = res.data.conversation
    startPolling()
  } catch {} finally {
    starting.value = false
  }
}

const handleSend = async () => {
  if ((!inputText.value.trim() && !selectedFile.value) || sending.value) return
  sending.value = true
  const text = inputText.value.trim()
  const file = selectedFile.value
  inputText.value = ''
  selectedFile.value = null
  try {
    await sendMessage(conversation.value._id, text, file)
    await loadMessages()
  } catch {} finally {
    sending.value = false
  }
}

const handleClose = async () => {
  if (!conversation.value) return
  try {
    await closeConversation(conversation.value._id)
    conversation.value.status = 'closed'
    stopPolling()
  } catch {}
}

const handleFileSelected = (e) => {
  selectedFile.value = e.target.files?.[0] || null
}

watch(isOpen, (open) => {
  if (!open) stopPolling()
})

onUnmounted(stopPolling)
</script>

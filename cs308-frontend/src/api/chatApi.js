import api from './authApi'
import { authStore } from '../store/auth'

const getAuthConfig = () => ({
  headers: { Authorization: `Bearer ${authStore.token}` },
})

export const startConversation = (subject) =>
  api.post('/chat', { subject }, getAuthConfig())

export const getMyConversation = () =>
  api.get('/chat/my', getAuthConfig())

export const getMessages = (conversationId) =>
  api.get(`/chat/${conversationId}/messages`, getAuthConfig())

export const sendMessage = (conversationId, text, file = null) => {
  const formData = new FormData()
  if (text) formData.append('text', text)
  if (file) formData.append('attachment', file)
  return api.post(`/chat/${conversationId}/messages`, formData, {
    headers: {
      Authorization: `Bearer ${authStore.token}`,
      'Content-Type': 'multipart/form-data',
    },
  })
}

export const closeConversation = (conversationId) =>
  api.patch(`/chat/${conversationId}/close`, {}, getAuthConfig())

// Support agent
export const getUnclaimedConversations = () =>
  api.get('/chat/unclaimed', getAuthConfig())

export const getMyAgentConversations = () =>
  api.get('/chat/agent/my', getAuthConfig())

export const claimConversation = (conversationId) =>
  api.patch(`/chat/${conversationId}/claim`, {}, getAuthConfig())

export const getCustomerContext = (conversationId) =>
  api.get(`/chat/${conversationId}/context`, getAuthConfig())

import api from './authApi'
import { authStore } from '../store/auth'

const getAuthConfig = () => ({
  headers: { Authorization: `Bearer ${authStore.token}` },
})

export const getMyReturnRequests = () => api.get('/returns/my-returns', getAuthConfig())
export const submitReturnRequest = (payload) => api.post('/returns', payload, getAuthConfig())

export const getPendingReturnRequests = () => api.get('/returns/pending', getAuthConfig())
export const approveReturnRequest = (id) => api.patch(`/returns/${id}/approve`, {}, getAuthConfig())
export const rejectReturnRequest = (id, managerNotes) => api.patch(`/returns/${id}/reject`, { managerNotes }, getAuthConfig())

export const getReturnHistory = () => 
  api.get('/returns/history', getAuthConfig())

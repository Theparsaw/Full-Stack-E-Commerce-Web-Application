<template>
  <div class="theme-page-shell min-h-screen flex items-center justify-center">
    <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">

      <h1 class="text-2xl font-bold mb-6 text-center">Login</h1>

      <!-- Show error message if login fails -->
      <p v-if="error" class="text-red-500 text-sm mb-4 text-center">{{ error }}</p>
      <p v-if="registrationMessage" class="text-green-600 text-sm mb-4 text-center">
        {{ registrationMessage }}
      </p>

      <form @submit.prevent="handleLogin">

        <!-- Email field -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            placeholder="Enter your email"
            class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <!-- Password field -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            v-model="password"
            type="password"
            placeholder="Enter your password"
            class="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <!-- Submit button -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {{ loading ? 'Logging in...' : 'Login' }}
        </button>

      </form>

      <!-- Link to register page -->
      <p class="mt-4 text-center text-sm text-gray-600">
        Don't have an account?
        <router-link to="/register" class="text-blue-600 hover:underline">Register</router-link>
      </p>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { loginUser } from '../api/authApi'
import { activateUserCartId, getCart, getGuestCart, mergeGuestCartIntoUserCart } from '../api/cartApi'
import { authStore } from '../store/auth'
import { cartStore } from '../store/cart'

const CART_MERGE_ERROR_KEY = 'cart-merge-error'

// Router lets us redirect the user after login
const router = useRouter()
const route = useRoute()

// Form fields — v-model connects these to the input fields above
const email = ref('')
const password = ref('')

// State for loading spinner and error message
const loading = ref(false)
const error = ref('')
const registrationMessage = ref(
  route.query.registered === '1' ? 'Account created. Please log in to continue.' : ''
)

const syncCartTotalItems = async () => {
  try {
    const cartRes = await getCart()
    cartStore.setTotalItems(cartRes.data?.totalItems)
  } catch {
    cartStore.clear()
  }
}

const hasGuestCartItems = async () => {
  const guestCartRes = await getGuestCart()
  return Number(guestCartRes.data?.totalItems || 0) > 0
}

const handleLogin = async () => {
  error.value = ''
  registrationMessage.value = ''
  loading.value = true

  try {
    const shouldOpenCartAfterLogin = await hasGuestCartItems()
    const res = await loginUser({ email: email.value, password: password.value })

    authStore.setAuth(res.data.token, res.data.user)
    activateUserCartId()

    const userRole = res.data.user?.role
    const isAdminLike =
      userRole === 'sales_manager' ||
      userRole === 'product_manager' ||
      userRole === 'admin'

    // Only normal users should run cart logic
    if (!isAdminLike) {
      try {
        await mergeGuestCartIntoUserCart()
        await syncCartTotalItems()
      } catch (mergeError) {
        const message =
          mergeError?.response?.data?.message || 'Logged in, but some cart items could not be restored.'

        localStorage.setItem(CART_MERGE_ERROR_KEY, message)
        await syncCartTotalItems()

        router.push('/cart')
        return
      }
    } else {
      // Admin-type users should not access cart
      cartStore.setTotalItems(0)
      localStorage.removeItem(CART_MERGE_ERROR_KEY)
    }

    if (userRole === 'sales_manager') {
      router.push('/admin/pricing')
    } else if (userRole === 'product_manager' || userRole === 'admin') {
      router.push('/admin/dashboard')
    } else if (shouldOpenCartAfterLogin) {
      router.push('/cart')
    } else {
      router.push('/')
    }

  } catch (err) {
    if (!err.response) {
      error.value = 'Cannot reach the backend server. Make sure the backend is running on http://localhost:5001.'
    } else {
      error.value = err.response?.data?.message || 'Login failed. Please try again.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="theme-app-shell min-h-screen">
    <header class="theme-header sticky top-0 z-50 border-b border-orange-100/70 shadow-lg shadow-slate-900/10 backdrop-blur">
      <div class="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
        <router-link to="/" class="text-2xl font-bold text-orange-600 shrink-0">
          CS308 Store
        </router-link>

        <div class="flex-1">
          <form @submit.prevent="submitSearch">
            <div class="relative flex items-center overflow-hidden rounded-full border border-orange-200 bg-white/88 shadow-sm transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-200">
              <input
                v-model="searchInput"
                type="text"
                placeholder="Search products, categories, brands..."
                class="flex-1 min-w-0 px-5 py-3 outline-none bg-transparent text-sm text-stone-800 placeholder-stone-400"
              />
              <div class="flex items-center shrink-0 border-l border-orange-200 mx-1">
                <select
                  :value="activeSort"
                  @change="e => setSort(e.target.value)"
                  class="text-sm text-slate-700 bg-transparent pl-3 pr-7 py-2.5 outline-none cursor-pointer appearance-none"
                  style="background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23f97316%22 stroke-width=%222.5%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E%3Cpath d=%22M6 9l6 6 6-6%22/%3E%3C/svg%3E'); background-repeat: no-repeat; background-position: right 10px center;"
                >
                  <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>
          </form>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <label class="sr-only" for="theme-select">Theme</label>
          <select
            id="theme-select"
            v-model="currentTheme"
            class="theme-select h-11 rounded-xl border border-orange-200 bg-white/72 px-3 text-sm font-medium text-slate-800 outline-none transition hover:border-orange-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
            aria-label="Choose color theme"
          >
            <option v-for="theme in themes" :key="theme.value" :value="theme.value">
              {{ theme.label }}
            </option>
          </select>

          <router-link
            v-if="showShoppingActions"
            to="/cart"
            class="relative flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 bg-white/72 text-slate-800 backdrop-blur hover:border-orange-300 hover:bg-white/90 transition"
          >
          
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5 text-slate-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1 5h12m-9 0a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z"
              />
            </svg>
            <span class="text-sm font-medium text-slate-800">Cart</span>
            <span
              v-if="cartStore.totalItems > 0"
              class="absolute -right-2 -top-2 inline-flex min-w-6 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-xs font-semibold text-white"
            >
              {{ cartStore.totalItems }}
            </span>
          </router-link>
          <router-link
            v-if="authStore.isLoggedIn && authStore.role === 'customer'"
            to="/notifications"
            class="relative flex items-center justify-center rounded-xl border border-orange-200 bg-white/72 px-4 py-2.5 text-slate-800 backdrop-blur hover:border-orange-300 hover:bg-white/90 transition"
          >
            <span class="text-lg">🔔</span>

            <span
              v-if="notificationStore.unreadCount > 0"
              class="absolute -right-2 -top-2 inline-flex min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-white"
            >
              {{ notificationStore.unreadCount }}
            </span>
          </router-link>

          <router-link
            v-if="!authStore.isLoggedIn"
            to="/login"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 bg-white/72 text-slate-800 backdrop-blur hover:border-orange-300 hover:bg-white/90 transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5 text-slate-700"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.8"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M15.75 6.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 1115 0"
              />
            </svg>
            <span class="text-sm font-medium text-slate-800">Login</span>
          </router-link>

          <template v-else>
            <div
              v-if="showHeaderWishlist"
              class="relative"
            >
              <div class="group relative">
                <router-link
                  :to="{ path: '/profile', query: { tab: 'wishlist' } }"
                  class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-orange-200 bg-white/72 text-slate-700 shadow-sm backdrop-blur transition hover:border-orange-300 hover:bg-white/90 hover:text-orange-500"
                  aria-label="Open wishlist"
                  title="Open wishlist"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 fill-transparent transition-colors group-hover:fill-current group-focus-visible:fill-current"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="1.8"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12.001 20.727l-.783-.714C6.43 15.647 3.25 12.736 3.25 8.994A4.744 4.744 0 017.994 4.25c1.565 0 3.066.744 4.007 1.917.94-1.173 2.442-1.917 4.007-1.917a4.744 4.744 0 014.742 4.744c0 3.742-3.18 6.653-7.968 11.02l-.78.713z"
                    />
                  </svg>
                </router-link>

                <div
                  v-if="route.path === '/'"
                  class="pointer-events-none absolute right-0 top-full z-50 w-80 pt-3 opacity-0 transition duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
                >
                  <router-link
                    :to="{ path: '/profile', query: { tab: 'wishlist' } }"
                    class="block rounded-2xl border border-orange-100 bg-white p-4 shadow-xl"
                  >
                    <div class="mb-3 flex items-center justify-between gap-3">
                      <p class="text-sm font-semibold text-gray-900">Click, you have some discounts! 🤩</p>
                      <span class="text-xs font-medium text-orange-500">
                        {{ wishlistPreviewCounter }}
                      </span>
                    </div>

                    <div v-if="wishlistPreviewItems.length === 0" class="text-sm text-gray-500">
                      No saved products yet.
                    </div>

                    <div v-else class="space-y-3">
                      <div
                        v-for="(item, index) in wishlistPreviewItems"
                        :key="item.productId"
                        class="flex items-center gap-3"
                      >
                        <div class="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-orange-300 bg-gray-100">
                          <img
                            v-if="item.product?.imageUrl"
                            :src="item.product.imageUrl"
                            :alt="`${item.product.model} by ${item.product.name}`"
                            class="h-full w-full object-cover"
                          />
                          <div
                            v-else
                            class="flex h-full w-full items-center justify-center text-[10px] text-gray-400"
                          >
                            No Image
                          </div>
                          <div
                            v-if="wishlistOverflowCount > 0 && index === wishlistPreviewItems.length - 1"
                            class="absolute inset-0 flex items-center justify-center bg-gray-900/45 text-sm font-semibold text-white"
                          >
                            +{{ wishlistOverflowCount }}
                          </div>
                        </div>

                        <div class="min-w-0">
                          <p class="truncate text-sm font-medium text-gray-900">{{ item.product?.model }}</p>
                          <p class="truncate text-xs text-gray-500">{{ item.product?.name }}</p>
                        </div>
                      </div>
                    </div>
                  </router-link>
                </div>
              </div>
            </div>

            <router-link
              to="/profile"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 bg-white/72 text-slate-800 backdrop-blur hover:border-orange-300 hover:bg-white/90 transition"
            >
              <img
                v-if="authStore.user?.profileImage"
                :src="getProfileImageUrl(authStore.user.profileImage)"
                alt="Profile photo"
                class="w-6 h-6 rounded-full object-cover border border-orange-200"
              />
              <div
                v-else
                class="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold"
              >
                {{ authStore.user?.name?.charAt(0)?.toUpperCase() }}
              </div>
              <span class="text-sm font-medium text-slate-800">{{ authStore.user?.name }}</span>
            </router-link>

            <button
              type="button"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-orange-200 bg-white/72 text-slate-800 backdrop-blur hover:border-orange-300 hover:bg-white/90 transition cursor-pointer"
              @click="handleLogout"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5 text-slate-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-3h8.25m0 0l-3-3m3 3l-3 3"
                />
              </svg>
              <span class="text-sm font-medium text-slate-800">Logout</span>
            </button>
          </template>

          <router-link
            v-if="authStore.isLoggedIn && ['sales_manager', 'product_manager'].includes(authStore.role)"
            :to="adminHomeRoute"
            class="px-4 py-2.5 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition"
          >
            Admin
          </router-link>
        </div>
      </div>
    </header>

    <main>
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, watch, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { resolveAssetUrl } from './api/authApi'
import { getCart, resetCartId } from './api/cartApi'
import { authStore } from './store/auth'
import { cartStore } from './store/cart'
import { wishlistStore } from './store/wishlist'
import { notificationStore } from './store/notificationStore'

const router = useRouter()
const route = useRoute()
const searchInput = ref('')
const THEME_STORAGE_KEY = 'cs308-theme'

const themes = [
  { value: 'sunrise', label: 'Sunrise' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'forest', label: 'Forest' },
  { value: 'plum', label: 'Plum' },
]

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'sunrise'
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return themes.some((theme) => theme.value === storedTheme) ? storedTheme : 'sunrise'
}

const currentTheme = ref(getInitialTheme())

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme === 'plum' ? 'dark' : 'light'
}

const sortOptions = [
  { value: '',          label: 'Recommended' },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'popularity', label: 'Most Popular' },
  { value: 'newest',     label: 'Newest' },
]

const activeSort = computed(() =>
  typeof route.query.sort === 'string' ? route.query.sort : ''
)

const showHeaderWishlist = computed(() =>
  authStore.isLoggedIn && authStore.role === 'customer'
)

const showShoppingActions = computed(() =>
  !authStore.isLoggedIn || authStore.role === 'customer'
)

const adminHomeRoute = computed(() => {
  if (authStore.role === 'sales_manager') {
    return '/admin/pricing'
  }

  if (authStore.role === 'product_manager') {
    return '/admin/dashboard'
  }

  return '/'
})

const wishlistPreviewItems = computed(() => wishlistStore.items.slice(0, 4))
const wishlistOverflowCount = computed(() => Math.max(wishlistStore.items.length - 4, 0))
const wishlistPreviewCounter = computed(() =>
  wishlistStore.items.length > 4
    ? '4+ more'
    : `${wishlistPreviewItems.value.length} ${wishlistPreviewItems.value.length === 1 ? 'item' : 'items'}`
)

const setSort = (value) => {
  const query = { ...route.query }
  if (value) {
    query.sort = value
  } else {
    delete query.sort
  }
  router.push({ path: route.path, query })
}

const getProfileImageUrl = (value) => resolveAssetUrl(value)

const syncCartCount = async () => {
  try {
    const res = await getCart()
    cartStore.setTotalItems(res.data?.totalItems)
  } catch (error) {
    cartStore.clear()
  }
}

const handleLogout = () => {
  authStore.clearAuth()
  cartStore.clear()
  resetCartId()
  wishlistStore.clear()
  router.push('/login')
}

const submitSearch = () => {
  const trimmed = searchInput.value.trim()
  const query = { ...route.query }
  
  if (trimmed) {
    query.search = trimmed
  } else {
    delete query.search
  }
  
  router.push({ path: '/', query })
}

watch(
  () => route.query.search,
  (newSearch) => {
    searchInput.value = typeof newSearch === 'string' ? newSearch : ''
  },
  { immediate: true }
)

watch(
  currentTheme,
  (theme) => {
    applyTheme(theme)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  },
  { immediate: true }
)

watch(
  () => authStore.token,
  () => {
    syncCartCount()
    wishlistStore.clear()

    if (authStore.isLoggedIn && authStore.role === 'customer') {
      wishlistStore.ensureLoaded().catch(() => {})
    }
  },
  { immediate: true }
)

onMounted(() => {
  syncCartCount()

  if (
    authStore.isLoggedIn &&
    authStore.role === 'customer'
  ) {
    notificationStore.loadNotifications()
  }
})
</script>

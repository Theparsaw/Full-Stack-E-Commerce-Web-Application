<template>
  <div class="theme-page-shell">
    <HomeHero
      v-if="!isSearching && !loading && heroSlides.length"
      :slides="heroSlides"
      @shop-now="scrollToProducts"
    />

    <TrustFeatures v-if="!isSearching" />

    <div id="products-section" class="max-w-7xl mx-auto px-4 py-6 md:px-6">
      
      <div v-if="isSearching || activeSort" class="flex items-center gap-3 flex-wrap mb-4 px-2">
        <p v-if="isSearching" class="text-sm text-gray-700">
          Showing results for:
          <span class="font-semibold text-orange-600">"{{ activeSearch }}"</span>
        </p>
        <p v-if="activeSort" class="text-sm text-gray-500">
          Sorted by:
          <span class="font-semibold text-gray-700">
            {{ sortOptions.find(o => o.value === activeSort)?.label }}
          </span>
        </p>
        <button
          v-if="isSearching || activeSort"
          @click="clearSearch"
          class="flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors hover:underline"
        >
          &larr; Go back
        </button>
      </div>

      <section class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-catalog-section-title text-gray-900">Categories</h2>
          <button
            v-if="selectedCategories.length > 0"
            @click="selectedCategories = []"
            class="text-sm text-orange-600 hover:underline"
          >
            Clear filters
          </button>
        </div>

        <div class="flex gap-3 overflow-x-auto pb-2">
          <button
            @click="toggleCategory('')"
            :class="[
              'px-4 py-2 rounded-full border whitespace-nowrap transition',
              selectedCategories.length === 0
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
            ]"
          >
            All
          </button>

          <button
            v-for="categoryId in uniqueCategories"
            :key="categoryId"
            @click="toggleCategory(categoryId)"
            :class="[
              'px-4 py-2 rounded-full border whitespace-nowrap transition capitalize',
              selectedCategories.includes(categoryId)
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
            ]"
          >
            {{ getCategoryLabel(categoryId) }}
          </button>
        </div>
      </section>

      <div v-if="loading" class="text-gray-600">Loading products...</div>
      <div v-else-if="error" class="text-red-600">{{ error }}</div>

      <template v-else>
        <div
          v-if="isSearching && filteredProducts.length === 0"
          class="bg-white border border-gray-200 rounded-3xl p-8 text-gray-600"
        >
          No products found for
          <span class="font-semibold text-gray-900">"{{ activeSearch }}"</span>.
        </div>

        <template v-else-if="isSearching">
          <ProductSection
            :title="selectedCategories.length > 0 ? 'Filtered Search Results' : 'Search Results'"
            :products="filteredProducts"
            :getCategoryLabel="getCategoryLabel"
          />
        </template>

        <template v-else>
          <ProductSection
            :title="selectedCategories.length > 0
              ? (selectedCategories.length === 1 ? getCategoryLabel(selectedCategories[0]) : 'Selected Categories')
              : 'All Products'"
            :products="filteredProducts"
            :getCategoryLabel="getCategoryLabel"
          />
        </template>
      </template>
    </div>

    <HeroSection class="mt-8" />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProductSection from '../components/ProductsSection.vue'
import HeroSection from '../components/HeroSection.vue'
import HomeHero from '../components/HomeHero.vue'
import TrustFeatures from '../components/TrustFeatures.vue'
import { getCategories } from '../api/categoryApi'
import { getProducts } from '../api/productApi'

const route = useRoute()
const router = useRouter()

const products = ref([])
const categories = ref([])
const loading = ref(true)
const error = ref('')
const selectedCategories = ref([])

const sortOptions = [
  { value: '',          label: 'Recommended' },
  { value: 'price_asc',  label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'popularity', label: 'Most Popular' },
  { value: 'newest',     label: 'Newest' },
]

const activeSearch = computed(() =>
  typeof route.query.search === 'string' ? route.query.search.trim() : ''
)

const isSearching = computed(() => activeSearch.value.length > 0)

const activeSort = computed(() =>
  typeof route.query.sort === 'string' ? route.query.sort : ''
)

const categoryMap = computed(() => {
  return Object.fromEntries(categories.value.map(cat => [cat.categoryId, cat.name]))
})

const uniqueCategories = computed(() => {
  const ids = new Set(products.value.map(product => product.categoryId))
  const activeCategories = Array.from(ids).filter(Boolean)
  
  return activeCategories.sort((a, b) => {
    const labelA = getCategoryLabel(a) || ''
    const labelB = getCategoryLabel(b) || ''
    return labelA.localeCompare(labelB)
  })
})

const filteredProducts = computed(() => {
  if (selectedCategories.value.length === 0) return products.value
  return products.value.filter(product => selectedCategories.value.includes(product.categoryId))
})

const popularProducts = computed(() =>
  [...products.value]
    .sort((left, right) => {
      if ((right.popularity ?? 0) !== (left.popularity ?? 0)) {
        return (right.popularity ?? 0) - (left.popularity ?? 0)
      }
      return new Date(right.createdAt ?? 0) - new Date(left.createdAt ?? 0)
    })
    .slice(0, 8)
)

const promoImages = [
  '/promos/photo01.png',
  '/promos/61JZTWfKMRL._AC_SL1500_.png',
  '/promos/71brAk7Sc2L._AC_SL1500_.png',
  '/promos/61vJtKbAssL._AC_SL1500_.png'
]

const heroProductIds = ['p018', 'p009', 'p036', 'p011']

const heroProducts = computed(() => {
  const productsById = new Map(products.value.map(product => [product.productId, product]))
  const orderedProducts = heroProductIds
    .map(productId => productsById.get(productId))
    .filter(Boolean)

  return orderedProducts.length ? orderedProducts : popularProducts.value.slice(0, 4)
})

const heroSlides = computed(() =>
  heroProducts.value.slice(0, 4).map((product, index) => ({
    id: product.productId,
    eyebrow: `${getCategoryLabel(product.categoryId)} offer`,
    title: product.model,
    description: product.description,
    cta: 'Shop now',
    badge: index === 0 ? 'Top pick this week' : `${Math.min(10 + (index * 5), 25)}% off featured selection`,
    panelTitle: 'Homepage spotlight',
    panelText: `Now featured at $${Number(product.price ?? 0).toLocaleString()}. Stock available: ${product.quantityInStock ?? 0}.`,
    image: promoImages[index] || promoImages[0],
    imageAlt: `${product.model} by ${product.name}`
  }))
)

const getCategoryLabel = (categoryId) => {
  const label = categoryMap.value[categoryId] || categoryId;
  if (!label) return '';
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const toggleCategory = (categoryId) => {
  if (!categoryId) {
    selectedCategories.value = []
    return
  }
  const index = selectedCategories.value.indexOf(categoryId)
  if (index > -1) {
    selectedCategories.value.splice(index, 1)
  } else {
    selectedCategories.value.push(categoryId)
  }
}

const loadProducts = async () => {
  loading.value = true
  error.value = ''
  try {
    const [productsRes, categoriesRes] = await Promise.all([
      getProducts(activeSearch.value, activeSort.value),
      getCategories(),
    ])
    products.value = productsRes.data ?? []
    categories.value = categoriesRes.data.categories || []
  } catch (err) {
    error.value = 'Failed to load products'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const clearSearch = () => {
  selectedCategories.value = []
  router.push({ path: '/', query: {} })
}

const scrollToProducts = () => {
  document.getElementById('products-section')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
}

watch(
  () => [route.query.search, route.query.sort],
  () => {
    loadProducts()
  },
  { immediate: true }
)
</script>

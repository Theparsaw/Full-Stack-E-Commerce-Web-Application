<template>
  <section class="mb-10" v-if="products && products.length">
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-catalog-section-title text-gray-900">{{ title }}</h2>
      <span class="text-sm text-gray-500">{{ products.length }} products</span>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div
        v-for="product in products"
        :key="product.productId"
        class="group relative flex min-w-0"
      >
        <div
          class="pointer-events-none absolute right-3 top-3 z-20 opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        >
          <WishlistButton :product-id="product.productId" />
        </div>

        <router-link
          :to="`/products/${product.productId}`"
          class="relative z-10 flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md cursor-pointer"
        >
          <div
            class="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-slate-950/0 transition-colors duration-200 group-hover:bg-slate-950/35 group-focus-within:bg-slate-950/35"
          />

          <div class="relative aspect-[4/3] rounded-xl bg-gray-100 mb-4 overflow-hidden">
            <img
              v-if="product.imageUrl"
              :src="product.imageUrl"
              :alt="`${product.model} by ${product.name}`"
              class="w-full h-full object-contain"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center text-gray-400 text-sm"
            >
              No Image
            </div>

            <div
              class="pointer-events-none absolute inset-x-0 bottom-[30px] z-20 flex justify-center opacity-0 transition-all duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
            >
              <ProductCardAddToCartButton
                :product="product"
                class="translate-x-3 scale-95 group-hover:translate-x-0 group-hover:scale-100 group-focus-within:translate-x-0 group-focus-within:scale-100"
              />
            </div>
          </div>

          <p class="text-xs text-orange-600 font-semibold mb-1 capitalize">
            {{ getCategoryLabel(product.categoryId) }}
          </p>

          <p class="font-product-meta text-gray-500 mb-1">
            Product ID: {{ product.productId }}
          </p>

          <h3 class="font-product-card-title text-gray-900 line-clamp-2 min-h-[48px]">
            {{ product.model }}
          </h3>

          <p class="text-sm text-gray-500 mt-1">{{ product.name }}</p>

          <div class="mt-2 flex items-center gap-2 text-sm">
            <span class="text-amber-500 font-semibold">{{ renderAverageStars(product.averageRating) }}</span>
            <span class="text-gray-500">{{ formatAverageRating(product) }}</span>
          </div>

          <p class="text-sm text-gray-600 mt-3 line-clamp-2 min-h-[40px]">
            {{ product.description }}
          </p>

          <div class="mt-auto min-h-[68px] pt-4">
            <div v-if="product.hasDiscount">
              <p class="text-sm text-gray-400 line-through">
                ${{ Number(product.originalPrice).toLocaleString() }}
              </p>

              <div class="flex items-center gap-2">
                <p class="font-product-grid-price text-red-600">
                  ${{ Number(product.discountedPrice).toLocaleString() }}
                </p>

                <span
                  class="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"
                >
                  -{{ product.discountPercentage }}%
                </span>
              </div>
            </div>

            <div v-else>
              <p class="font-product-grid-price text-orange-600">
                ${{ Number(product.price).toLocaleString() }}
              </p>
            </div>
            <p class="text-xs text-gray-500">
              Stock: {{ product.quantityInStock ?? 'N/A' }}
            </p>
          </div>
        </router-link>
      </div>
    </div>
  </section>
</template>

<script setup>
import ProductCardAddToCartButton from "./ProductCardAddToCartButton.vue"
import WishlistButton from "./WishlistButton.vue"

defineProps({
  title: {
    type: String,
    required: true
  },
  products: {
    type: Array,
    required: true
  },
  getCategoryLabel: {
    type: Function,
    required: true
  }
})

const hasRatings = (product) => Number(product?.reviewCount || 0) > 0

const renderAverageStars = (rating) => {
  const roundedRating = Math.round(Number(rating || 0))
  return '★'.repeat(roundedRating) + '☆'.repeat(5 - roundedRating)
}

const formatAverageRating = (product) => {
  if (!hasRatings(product)) return 'No ratings yet'

  const average = Number(product.averageRating).toFixed(1)
  const count = Number(product.reviewCount)
  return `${average} (${count} review${count === 1 ? '' : 's'})`
}
</script>

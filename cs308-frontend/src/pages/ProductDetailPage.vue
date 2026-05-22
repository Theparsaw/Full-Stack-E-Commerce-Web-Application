<template>
  <div class="p-6 max-w-4xl mx-auto">
    <button
      @click="goBack"
      class="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2 transition-colors"
    >
      <span>&larr;</span> Back to Products
    </button>

    <div v-if="loading" class="flex justify-center py-12 text-gray-600">
      <span class="animate-pulse">Loading product details...</span>
    </div>
    
    <div v-else-if="error" class="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
      {{ error }}
    </div>

    <div v-else class="space-y-8">
      <div class="bg-white border rounded-xl p-8 shadow-sm flex flex-col md:flex-row gap-8">
        <div class="w-full md:w-1/2 bg-gray-100 rounded-lg min-h-[300px] overflow-hidden">
          <img
            v-if="product.imageUrl"
            :src="product.imageUrl"
            :alt="`${product.model} by ${product.name}`"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-gray-400"
          >
            <span>No Image Available</span>
          </div>
        </div>

        <div class="w-full md:w-1/2 flex flex-col">
          <div class="mb-3 flex items-start justify-between gap-4">
            <div>
              <h1 class="text-3xl font-bold mb-2 text-gray-900">{{ product.model }}</h1>
              <p class="mb-3 text-sm font-medium text-gray-500">
                Product ID: {{ displayProductId }}
              </p>
              <div v-if="product.hasDiscount">
                <p class="text-sm text-gray-400 line-through">
                  ${{ Number(product.originalPrice).toLocaleString() }}
                </p>

                <div class="flex items-center gap-2">
                  <p class="text-3xl font-bold text-red-600">
                    ${{ Number(product.discountedPrice).toLocaleString() }}
                  </p>

                  <span
                    class="rounded bg-red-100 px-2 py-1 text-sm font-semibold text-red-700"
                  >
                    -{{ product.discountPercentage }}%
                  </span>
                </div>

                <p class="mt-1 text-sm text-green-600 font-medium">
                  {{ product.campaignName }}
                </p>
              </div>

              <div v-else>
                <p class="text-3xl font-bold text-green-600">
                  ${{ Number(product.price).toLocaleString() }}
                </p>
              </div>
            </div>
            <WishlistButton
              v-if="product.productId"
              :product-id="product.productId"
              variant="detail"
            />
          </div>

          <div class="mb-4 flex items-center gap-2 text-sm">
            <span class="text-amber-500 font-semibold">{{ renderAverageStars(product.averageRating) }}</span>
            <span class="text-gray-600">{{ formatAverageRating(product) }}</span>
          </div>
          
          <p class="text-gray-700 mb-6">{{ product.description }}</p>

          <div class="grid grid-cols-2 gap-4 mb-8 text-sm">
            <div><strong class="text-gray-900">Product ID:</strong> <span class="text-gray-600">{{ displayProductId }}</span></div>
            <div><strong class="text-gray-900">Brand:</strong> <span class="text-gray-600">{{ product.name }}</span></div>
            <div><strong class="text-gray-900">Category:</strong> <span class="text-gray-600">{{ product.categoryId }}</span></div>
            <div><strong class="text-gray-900">Stock:</strong> <span class="text-gray-600">{{ product.quantityInStock }}</span></div>
            <div><strong class="text-gray-900">Warranty:</strong> <span class="text-gray-600">{{ product.warrantyStatus }}</span></div>
          </div>

          <div class="mt-auto pt-6 border-t flex flex-col gap-4">
            <div class="flex items-center gap-4">
              <div class="flex items-center border rounded-lg">
                <button @click="decreaseQuantity" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-l-lg" :disabled="quantity <= 1">-</button>
                <span class="px-4 py-2 border-x min-w-[3rem] text-center">{{ quantity }}</span>
                <button @click="increaseQuantity" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-r-lg" :disabled="quantity >= availableStock">+</button>
              </div>
              
              <button 
                @click="handleAddToCart"
                class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                :disabled="isOutOfStock || addingToCart"
              >
                <span v-if="addingToCart">Adding...</span>
                <span v-else-if="isOutOfStock">Out of Stock</span>
                <span v-else>Add to Cart</span>
              </button>
            </div>

            <div v-if="cartMessage" :class="cartMessageTone === 'error' ? 'text-red-600' : 'text-green-600'" class="text-sm mt-2">
              {{ cartMessage }}
            </div>
          </div>
        </div>
      </div>

      <section ref="reviewSection" class="bg-white border rounded-xl p-8 shadow-sm">
        <div class="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 class="text-2xl font-semibold text-gray-900">Customer Reviews</h2>
            <p class="text-sm text-gray-500 mt-1">Only approved reviews are shown publicly.</p>
          </div>
          <span class="text-sm font-medium text-gray-500">{{ reviews.length }} review<span v-if="reviews.length !== 1">s</span></span>
        </div>

        <div v-if="reviewsLoading" class="text-gray-500">Loading reviews...</div>
        <div v-else-if="reviewsError" class="p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
          {{ reviewsError }}
        </div>
        <div v-else-if="reviews.length === 0" class="text-gray-600">
          No approved reviews yet.
        </div>
        <div v-else class="space-y-4">
          <article
            v-for="review in reviews"
            :key="review._id"
            class="border rounded-lg p-4 bg-slate-50"
          >
            <div class="flex items-center justify-between gap-4">
              <div>
                <h3 class="font-semibold text-gray-900">{{ review.reviewerName }}</h3>
                <p class="text-sm text-gray-500">{{ formatReviewDate(review.createdAt) }}</p>
              </div>
              <div class="flex items-center gap-3">
                <button
                  v-if="isOwnReview(review)"
                  type="button"
                  @click="startReviewEdit(review)"
                  class="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  Edit
                </button>
                <div class="text-amber-500 font-semibold">{{ renderStars(review.rating) }}</div>
              </div>
            </div>
            <p class="mt-3 text-gray-700 whitespace-pre-line">{{ review.comment }}</p>
          </article>
        </div>
      </section>

      <div
        v-if="reviewMessage"
        :class="reviewMessageTone === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-700 border-green-200'"
        class="rounded-lg border p-3 text-sm"
      >
        {{ reviewMessage }}
      </div>

      <section v-if="canShowReviewForm" class="bg-white border rounded-xl p-8 shadow-sm">
        <div class="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 class="text-2xl font-semibold text-gray-900">{{ reviewFormTitle }}</h2>
            <p class="text-sm text-gray-500 mt-1" v-if="authStore.isLoggedIn">
              <span v-if="isEditingReview">Rating-only edits go live immediately. Comment edits require product manager approval.</span>
              <span v-else-if="canAddCommentToOwnRating">Your rating is already public. Add a comment and it will appear after product manager approval.</span>
              <span v-else-if="ownReviewHasPendingComment">Your comment is waiting for product manager approval.</span>
              <span v-else>You can review this product only after delivery. Ratings without comments go live immediately; comments require approval.</span>
            </p>
            <p class="text-sm text-gray-500 mt-1" v-else>
              Log in to submit a review.
            </p>
          </div>
          <button
            v-if="!authStore.isLoggedIn"
            @click="goToLoginForReview"
            class="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Go to Login
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleReviewSubmit">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Rating</label>

            <div class="flex gap-2">
              <span
                v-for="star in 5"
                :key="star"
                @mouseenter="hoverRating = star"
                @mouseleave="hoverRating = 0"
                @click="reviewForm.rating = String(star)"
                class="text-3xl cursor-pointer transition"
                :class="(hoverRating || Number(reviewForm.rating)) >= star ? 'text-yellow-400' : 'text-gray-300'"
              >
                ★
              </span>
            </div>

            <p class="mt-1 text-sm text-gray-500">
              {{ reviewForm.rating ? `${reviewForm.rating} star${Number(reviewForm.rating) > 1 ? 's' : ''}` : 'No rating selected' }}
            </p>

            <button
              v-if="reviewForm.rating"
              type="button"
              @click="reviewForm.rating = ''"
              class="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Clear rating
            </button>

            <p v-if="reviewErrors.rating" class="mt-1 text-sm text-red-600">
              {{ reviewErrors.rating }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Comment</label>
            <textarea
              v-model="reviewForm.comment"
              rows="5"
              class="w-full border rounded-lg px-3 py-2"
              placeholder="Share what you liked or disliked about this product, if you want."
            />
            <p class="mt-1 text-xs text-gray-500">{{ reviewForm.comment.trim().length }}/500</p>
            <p v-if="reviewErrors.comment" class="mt-1 text-sm text-red-600">{{ reviewErrors.comment }}</p>
          </div>

          <p v-if="reviewErrors.general" class="text-sm text-red-600">{{ reviewErrors.general }}</p>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              class="bg-slate-900 text-white px-5 py-3 rounded-lg font-semibold hover:bg-slate-800 disabled:bg-slate-400"
              :disabled="submittingReview || !authStore.isLoggedIn || ownReviewHasPendingComment"
            >
              <span v-if="submittingReview">{{ isEditingReview ? 'Updating...' : 'Submitting...' }}</span>
              <span v-else-if="canAddCommentToOwnRating">Submit Comment</span>
              <span v-else-if="ownReviewHasPendingComment">Comment Pending Approval</span>
              <span v-else>{{ isEditingReview ? 'Update Review' : 'Submit Review' }}</span>
            </button>
            <button
              v-if="isEditingReview"
              type="button"
              @click="cancelReviewEdit"
              class="rounded-lg border border-gray-200 px-5 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
              :disabled="submittingReview"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section v-else class="bg-white border rounded-xl p-8 shadow-sm">
        <h2 class="text-2xl font-semibold text-gray-900">Your Review</h2>
        <p class="mt-2 text-sm text-gray-500">
          You have already reviewed this product. Use the Edit button on your review above to update it.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { addGuestItemToCart, addItemToCart } from '../api/cartApi'
import { getProductById } from '../api/productApi'
import { createReview, getApprovedReviewsByProductId, updateReview } from '../api/reviewApi'
import { authStore } from '../store/auth'
import { cartStore } from '../store/cart'
import WishlistButton from '../components/WishlistButton.vue'

const route = useRoute()
const router = useRouter()

const product = ref({})
const loading = ref(true)
const error = ref('')
const quantity = ref(1)
const reviews = ref([])
const reviewsLoading = ref(true)
const reviewsError = ref('')
const reviewSection = ref(null)

const addingToCart = ref(false)
const cartMessage = ref('')
const cartMessageTone = ref('success')
const submittingReview = ref(false)
const reviewMessage = ref('')
const reviewMessageTone = ref('success')
const hoverRating = ref(0)
const editingReviewId = ref('')

const reviewForm = reactive({
  rating: '',
  comment: '',
})

const reviewErrors = reactive({
  rating: '',
  comment: '',
  general: '',
})

const getUserIdFromToken = () => {
  try {
    const payload = authStore.token?.split('.')?.[1]
    if (!payload) return ''

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decodedPayload = JSON.parse(window.atob(normalizedPayload))
    return String(decodedPayload.id || decodedPayload._id || '')
  } catch (_error) {
    return ''
  }
}

const currentUserId = computed(() =>
  String(authStore.user?.id || authStore.user?._id || getUserIdFromToken())
)
const isEditingReview = computed(() => Boolean(editingReviewId.value))
const displayProductId = computed(() => product.value?.productId || route.params.id)
const availableStock = computed(() => {
  const stock = Number(product.value?.quantityInStock)
  return Number.isFinite(stock) ? Math.max(0, stock) : 0
})
const isOutOfStock = computed(() => availableStock.value <= 0)

const goBack = () => {
  router.push('/products')
}

const goToLoginForReview = () => {
  router.push(`/login?redirect=${encodeURIComponent(route.fullPath)}`)
}

const decreaseQuantity = () => {
  if (quantity.value > 1) quantity.value--
}

const increaseQuantity = () => {
  if (quantity.value < availableStock.value) quantity.value++
}

const resetReviewErrors = () => {
  reviewErrors.rating = ''
  reviewErrors.comment = ''
  reviewErrors.general = ''
}

const resetReviewForm = () => {
  reviewForm.rating = ''
  reviewForm.comment = ''
  hoverRating.value = 0
}

const getReviewSubmitErrorMessage = (responseData) => {
  const errors = responseData?.details || responseData?.errors || {}

  if (errors.productId) return errors.productId

  const messages = {
    PURCHASE_REQUIRED: 'You can only review products you have purchased.',
    DELIVERY_REQUIRED: 'You can review this product after the order is delivered.',
    ORDER_CANCELLED: 'Cancelled orders are not eligible for reviews.',
    RETURN_REQUESTED: 'Returned products are not eligible for reviews.',
    DUPLICATE_REVIEW: 'You have already reviewed this product.',
  }

  if (responseData?.code && messages[responseData.code]) {
    return messages[responseData.code]
  }

  if (
    responseData?.message &&
    responseData.message.trim().toLowerCase() !== 'verification failed'
  ) {
    return responseData.message
  }

  return 'This product is not eligible for review. Reviews are only available for delivered purchases that have not been returned.'
}

const isOwnReview = (review) =>
  authStore.isLoggedIn && currentUserId.value && String(review.userId) === currentUserId.value

const ownApprovedReview = computed(() => reviews.value.find((review) => isOwnReview(review)))
const ownReviewHasApprovedComment = computed(() => Boolean(ownApprovedReview.value?.comment?.trim()))
const ownReviewHasPendingComment = computed(() => ownApprovedReview.value?.commentStatus === 'pending')
const canAddCommentToOwnRating = computed(() =>
  Boolean(ownApprovedReview.value) &&
  !ownReviewHasApprovedComment.value &&
  !ownReviewHasPendingComment.value &&
  !isEditingReview.value
)
const canShowReviewForm = computed(() =>
  !ownApprovedReview.value ||
  isEditingReview.value ||
  canAddCommentToOwnRating.value ||
  ownReviewHasPendingComment.value
)
const reviewFormTitle = computed(() => {
  if (isEditingReview.value) return 'Edit Your Review'
  if (canAddCommentToOwnRating.value || ownReviewHasPendingComment.value) return 'Add a Comment'
  return 'Write a Review'
})

const syncRatingOnlyReviewForm = () => {
  if (
    ownApprovedReview.value &&
    !isEditingReview.value &&
    !reviewForm.rating &&
    ownApprovedReview.value.rating
  ) {
    reviewForm.rating = String(ownApprovedReview.value.rating)
  }
}

const startReviewEdit = (review) => {
  editingReviewId.value = review._id
  reviewForm.rating = review.rating ? String(review.rating) : ''
  reviewForm.comment = review.comment || ''
  reviewMessage.value = ''
  reviewMessageTone.value = 'success'
  resetReviewErrors()
}

const cancelReviewEdit = () => {
  editingReviewId.value = ''
  resetReviewForm()
  resetReviewErrors()
  reviewMessage.value = ''
  reviewMessageTone.value = 'success'
}

const hasRating = (rating) => {
  const ratingNumber = Number(rating)
  return Number.isInteger(ratingNumber) && ratingNumber >= 1 && ratingNumber <= 5
}

const renderStars = (rating) => {
  if (!hasRating(rating)) return 'No rating'

  const ratingNumber = Number(rating)
  return '★'.repeat(ratingNumber) + '☆'.repeat(5 - ratingNumber)
}

const renderAverageStars = (rating) => {
  const roundedRating = Math.round(Number(rating || 0))
  return '★'.repeat(roundedRating) + '☆'.repeat(5 - roundedRating)
}

const formatAverageRating = (productValue) => {
  const count = Number(productValue?.reviewCount || 0)
  if (count === 0) return 'No ratings yet'

  return `${Number(productValue.averageRating).toFixed(1)} average rating (${count} review${count === 1 ? '' : 's'})`
}

const formatReviewDate = (dateValue) => {
  if (!dateValue) return 'Unknown date'

  return new Date(dateValue).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const loadReviews = async () => {
  reviewsLoading.value = true
  reviewsError.value = ''

  try {
    const res = await getApprovedReviewsByProductId(route.params.id)
    reviews.value = res.data?.data || []
    syncRatingOnlyReviewForm()
  } catch (err) {
    reviewsError.value = err?.response?.data?.message || 'Failed to load reviews.'
    console.error(err)
  } finally {
    reviewsLoading.value = false
  }
}

const loadProduct = async () => {
  const res = await getProductById(route.params.id)
  product.value = res.data
}

const focusReviewFormFromRoute = async () => {
  if (route.query.review !== '1') return

  await nextTick()
  reviewSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const handleAddToCart = async () => {
  cartMessage.value = ''

  if (isOutOfStock.value) {
    cartMessage.value = 'Product is out of stock'
    cartMessageTone.value = 'error'
    return
  }

  addingToCart.value = true

  try {
    const res = authStore.isLoggedIn
      ? await addItemToCart(product.value.productId, quantity.value)
      : await addGuestItemToCart(product.value, quantity.value)

    cartStore.setTotalItems(res.data?.totalItems)
    cartMessage.value = `${quantity.value} item(s) added to cart`
    cartMessageTone.value = 'success'
  } catch (err) {
    cartMessage.value = err?.response?.data?.message || 'Failed to add to cart'
    cartMessageTone.value = 'error'
    console.error(err)
  } finally {
    addingToCart.value = false
  }
}

const handleReviewSubmit = async () => {
  reviewMessage.value = ''
  reviewMessageTone.value = 'success'
  resetReviewErrors()

  if (!authStore.isLoggedIn) {
    reviewErrors.general = 'Please log in to leave a review.'
    reviewMessage.value = 'Please log in to leave a review.'
    reviewMessageTone.value = 'error'
    return
  }

  submittingReview.value = true

  try {
    const payload = {
      productId: route.params.id,
      comment: reviewForm.comment.trim(),
    }

    if (reviewForm.rating) {
      payload.rating = Number(reviewForm.rating)
    }

    const reviewToUpdateId = isEditingReview.value
      ? editingReviewId.value
      : canAddCommentToOwnRating.value
        ? ownApprovedReview.value?._id
        : ''

    const updatePayload = {
      comment: payload.comment,
    }

    if (reviewForm.rating) {
      updatePayload.rating = Number(reviewForm.rating)
    } else if (isEditingReview.value) {
      updatePayload.rating = null
    }

    const res = reviewToUpdateId
      ? await updateReview(reviewToUpdateId, updatePayload)
      : await createReview(payload)

    reviewMessage.value = res.data?.message || (isEditingReview.value ? 'Review updated successfully.' : 'Review submitted successfully.')
    reviewMessageTone.value = 'success'
    editingReviewId.value = ''
    resetReviewForm()
    await Promise.all([loadProduct(), loadReviews()])
  } catch (err) {
    const responseData = err?.response?.data
    const errors = responseData?.details || responseData?.errors || {}
    const message = getReviewSubmitErrorMessage(responseData)

    reviewErrors.rating = errors.rating || ''
    reviewErrors.comment = errors.comment || ''
    reviewErrors.general = message
    reviewMessage.value = message
    reviewMessageTone.value = 'error'
    console.error(err)
  } finally {
    submittingReview.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      loadProduct(),
      loadReviews(),
    ])
    await focusReviewFormFromRoute()
  } catch (err) {
    error.value = 'Failed to load product details.'
    console.error(err)
  } finally {
    loading.value = false
  }
})
</script>

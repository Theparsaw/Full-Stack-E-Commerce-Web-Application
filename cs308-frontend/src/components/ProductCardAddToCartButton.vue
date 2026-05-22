<template>
  <button
    type="button"
    :aria-label="buttonLabel"
    :title="buttonLabel"
    :disabled="isDisabled"
    :class="buttonClasses"
    @click.stop.prevent="handleClick"
  >
    <span class="relative flex h-4 w-4 items-center justify-center">
      <svg
        v-if="isAdded"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class="h-4 w-4 transition-transform duration-300 ease-out"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M5 12.75 9 16.75 19 7.25"
        />
      </svg>

      <svg
        v-else
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.9"
        :class="[
          'h-4 w-4 transition-transform duration-300 ease-out',
          isAdding ? 'animate-pulse' : '',
        ]"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3.75 4.75h1.34c.48 0 .9.34 1 .81l.23 1.13m0 0 1.14 5.63a1 1 0 0 0 .98.8h8.33a1 1 0 0 0 .97-.76l1.23-4.91H7.46m-.14-.76h13.93M9.5 18.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm8 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"
        />
      </svg>
    </span>

    <span
      class="max-w-[8rem] overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300 ease-out"
    >
      {{ buttonText }}
    </span>
  </button>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { addGuestItemToCart, addItemToCart } from "../api/cartApi";
import { authStore } from "../store/auth";
import { cartStore } from "../store/cart";

const props = defineProps({
  product: {
    type: Object,
    required: true,
  },
});

const isAdding = ref(false);
const isAdded = ref(false);

let addedStateResetTimer = null;

const availableStock = computed(() => {
  const stock = Number(props.product?.quantityInStock);
  return Number.isFinite(stock) ? Math.max(0, stock) : 0;
});

const isOutOfStock = computed(() => availableStock.value <= 0);
const isDisabled = computed(() => isAdding.value || isOutOfStock.value);

const buttonText = computed(() => {
  if (isOutOfStock.value) return "Out of stock";
  if (isAdding.value) return "Adding...";
  if (isAdded.value) return "Added";
  return "Add to cart";
});

const buttonLabel = computed(() => `${buttonText.value}: ${props.product?.model || "product"}`);

const buttonClasses = computed(() => [
  "home-card-add-to-cart inline-flex h-11 items-center gap-2 rounded-full border px-4 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-200",
  "disabled:cursor-not-allowed disabled:opacity-70",
  isAdded.value ? "home-card-add-to-cart--added" : "",
]);

const clearAddedStateResetTimer = () => {
  if (addedStateResetTimer) {
    window.clearTimeout(addedStateResetTimer);
    addedStateResetTimer = null;
  }
};

const queueAddedStateReset = () => {
  clearAddedStateResetTimer();
  addedStateResetTimer = window.setTimeout(() => {
    isAdded.value = false;
    addedStateResetTimer = null;
  }, 1800);
};

const handleClick = async () => {
  if (isDisabled.value) {
    return;
  }

  clearAddedStateResetTimer();
  isAdded.value = false;
  isAdding.value = true;

  try {
    const response = authStore.isLoggedIn
      ? await addItemToCart(props.product.productId, 1)
      : await addGuestItemToCart(props.product, 1);

    cartStore.setTotalItems(response.data?.totalItems);
    isAdded.value = true;
    queueAddedStateReset();
  } catch (error) {
    console.error("Failed to add product to cart", error);
  } finally {
    isAdding.value = false;
  }
};

onBeforeUnmount(() => {
  clearAddedStateResetTimer();
});
</script>

<style scoped>
.home-card-add-to-cart {
  background: color-mix(in srgb, var(--theme-surface) 90%, transparent);
  border-color: color-mix(in srgb, var(--theme-border) 72%, rgba(15, 23, 42, 0.18));
  color: var(--theme-text-soft);
  box-shadow: 0 18px 40px -28px rgba(15, 23, 42, 0.58);
}

.home-card-add-to-cart:hover:not(:disabled),
.home-card-add-to-cart:focus-visible {
  background: color-mix(in srgb, var(--theme-surface) 96%, transparent);
  border-color: var(--theme-accent);
  color: var(--theme-accent);
  box-shadow: 0 22px 42px -24px rgba(var(--theme-glow-rgb), 0.58);
  transform: translateY(-1px);
}

.home-card-add-to-cart--added {
  background: linear-gradient(135deg, var(--theme-accent) 0%, var(--theme-accent-hover) 100%);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 24px 46px -24px rgba(var(--theme-glow-rgb), 0.72);
}

.home-card-add-to-cart--added:hover:not(:disabled),
.home-card-add-to-cart--added:focus-visible {
  color: #fff;
}

.home-card-add-to-cart:disabled {
  background: color-mix(in srgb, var(--theme-surface) 82%, transparent);
  border-color: color-mix(in srgb, var(--theme-border-soft) 84%, transparent);
  color: var(--theme-text-muted);
  box-shadow: none;
}
</style>

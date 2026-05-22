<template>
  <section class="theme-page-shell relative min-h-[calc(100vh-5rem)] overflow-hidden">
    <div class="absolute inset-0 bg-[linear-gradient(180deg,var(--theme-surface-glow)_0%,var(--theme-bg)_52%,var(--theme-muted)_100%)]" />
    <div class="relative mx-auto max-w-7xl px-4 py-7 md:px-6 lg:py-10">
      <div
        ref="heroPanelRef"
        class="theme-hero-panel group relative min-h-[34rem] overflow-hidden rounded-[2rem] border border-white/18 shadow-2xl transition duration-150 md:min-h-[37rem]"
        :style="heroPanelStyle"
        @mousemove="updateHeroGlow"
        @mouseleave="resetHeroGlow"
      >
        <div class="absolute -inset-6 rounded-[2.5rem] bg-orange-300/14 blur-3xl" />
        <div class="absolute -left-16 top-10 h-72 w-72 rounded-full bg-indigo-200/16 blur-3xl" />
        <div class="absolute bottom-0 right-0 h-[26rem] w-[26rem] rounded-full bg-amber-200/16 blur-3xl" />
        <div class="absolute left-1/3 top-1/4 h-80 w-80 rounded-full bg-white/7 blur-3xl" />

        <div
          v-for="(slide, index) in slides"
          :key="slide.id"
          class="absolute inset-0 overflow-hidden rounded-[inherit] transition-opacity duration-500 [backface-visibility:hidden] [transform:translateZ(0)]"
          :class="index === currentSlideIndex ? 'opacity-100' : 'opacity-0'"
        >
          <div class="theme-hero-overlay absolute inset-0" />
          <div class="absolute inset-y-6 right-4 w-full overflow-hidden rounded-[1.75rem] [backface-visibility:hidden] [transform:translateZ(0)] md:inset-y-8 md:right-8 md:w-[46%] lg:inset-y-10 lg:right-10 lg:w-[42%]">
            <img
              :src="slide.image"
              :alt="slide.imageAlt"
              class="h-full w-full object-contain object-center"
            >
          </div>
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_78%_35%,var(--theme-hero-radial),transparent_24%)]" />
        </div>

        <div
          class="pointer-events-none absolute inset-0 transition duration-200"
          :style="heroGlowStyle"
        />
        <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,var(--theme-hero-sheen),transparent_34%,rgba(255,255,255,0.06)_60%,var(--theme-hero-radial)_100%)]" />

        <div class="relative z-10 flex min-h-[34rem] flex-col p-7 md:min-h-[37rem] md:p-8 lg:p-10">
          <div class="flex max-w-2xl flex-1 flex-col">
            <div class="min-h-[13rem] md:min-h-[15rem] lg:min-h-[16.5rem]">
              <p class="mb-4 text-sm font-semibold uppercase tracking-[0.35em] text-orange-300">
                {{ activeSlide.eyebrow }}
              </p>
              <h1 class="mb-5 text-4xl font-bold leading-tight text-white md:text-6xl">
                {{ activeSlide.title }}
              </h1>
              <p class="max-w-xl text-base leading-7 text-stone-200 md:text-lg">
                {{ activeSlide.description }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-4 pt-4">
              <button
                type="button"
                class="inline-flex items-center rounded-full bg-orange-500 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                @click="$emit('shop-now')"
              >
                {{ activeSlide.cta }}
              </button>
              <div class="rounded-full border border-white/12 bg-black/24 px-4 py-2 text-sm font-medium text-stone-100 backdrop-blur-sm">
                {{ activeSlide.badge }}
              </div>
            </div>
          </div>

          <div class="mt-8 w-full max-w-sm min-h-[15rem] rounded-[1.75rem] border border-white/12 bg-black/24 p-4 backdrop-blur-md md:mt-10">
            <p class="text-xs uppercase tracking-[0.35em] text-orange-200">Live promotions</p>
            <div class="mt-4 flex items-center gap-3">
              <button
                type="button"
                class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/10 text-lg font-semibold text-white transition hover:border-orange-300/60 hover:bg-white/16"
                aria-label="Previous slide"
                @click="goToPreviousSlide"
              >
                &#8592;
              </button>
              <button
                type="button"
                class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/10 text-lg font-semibold text-white transition hover:border-orange-300/60 hover:bg-white/16"
                aria-label="Next slide"
                @click="goToNextSlide"
              >
                &#8594;
              </button>
              <p class="text-sm text-stone-200">{{ currentSlideIndex + 1 }} / {{ slides.length }}</p>
            </div>

            <div class="mt-5 flex items-center gap-2">
              <button
                v-for="(slide, index) in slides"
                :key="slide.id"
                type="button"
                class="h-2.5 rounded-full transition"
                :class="index === currentSlideIndex ? 'w-9 bg-orange-400' : 'w-2.5 bg-white/35 hover:bg-white/55'"
                :aria-label="`Go to slide ${index + 1}`"
                @click="setSlide(index)"
              />
            </div>

            <div class="mt-5 min-h-[6.5rem] rounded-[1.5rem] border border-white/10 bg-white/8 p-5">
              <p class="text-sm font-semibold text-white">{{ activeSlide.panelTitle }}</p>
              <p class="mt-2 text-sm leading-6 text-stone-200">{{ activeSlide.panelText }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  slides: {
    type: Array,
    default: () => []
  }
})

defineEmits(['shop-now'])

const heroPanelRef = ref(null)
const heroGlow = ref({
  x: 50,
  y: 50,
  opacity: 0,
  rotateX: 0,
  rotateY: 0
})
const currentSlideIndex = ref(0)
let autoplayId = null

const slides = computed(() => props.slides)

const activeSlide = computed(() => slides.value[currentSlideIndex.value] ?? {
  eyebrow: '',
  title: '',
  description: '',
  cta: 'Shop now',
  badge: '',
  panelTitle: '',
  panelText: '',
  image: '',
  imageAlt: ''
})

const setSlide = (index) => {
  const total = slides.value.length
  if (!total) return
  currentSlideIndex.value = (index + total) % total
  restartAutoplay()
}

const goToNextSlide = () => {
  setSlide(currentSlideIndex.value + 1)
}

const goToPreviousSlide = () => {
  setSlide(currentSlideIndex.value - 1)
}

const clearAutoplay = () => {
  if (autoplayId) {
    window.clearInterval(autoplayId)
    autoplayId = null
  }
}

const startAutoplay = () => {
  clearAutoplay()
  if (slides.value.length < 2) return
  autoplayId = window.setInterval(() => {
    currentSlideIndex.value = (currentSlideIndex.value + 1) % slides.value.length
  }, 5500)
}

const restartAutoplay = () => {
  startAutoplay()
}

const updateHeroGlow = (event) => {
  const bounds = heroPanelRef.value?.getBoundingClientRect()
  if (!bounds) return
  heroGlow.value = {
    x: ((event.clientX - bounds.left) / bounds.width) * 100,
    y: ((event.clientY - bounds.top) / bounds.height) * 100,
    opacity: 1,
    rotateX: ((0.5 - (event.clientY - bounds.top) / bounds.height) * 4.5),
    rotateY: ((((event.clientX - bounds.left) / bounds.width) - 0.5) * 6)
  }
}

const resetHeroGlow = () => {
  heroGlow.value = {
    x: 50, y: 50, opacity: 0, rotateX: 0, rotateY: 0
  }
}

const heroPanelStyle = computed(() => ({
  transform: `perspective(1400px) translateZ(0) rotateX(${heroGlow.value.rotateX}deg) rotateY(${heroGlow.value.rotateY}deg)`,
  boxShadow: `0 28px 80px rgba(28, 25, 23, 0.34), 0 0 54px rgba(var(--theme-glow-rgb), ${0.08 + heroGlow.value.opacity * 0.1})`,
  willChange: 'transform',
  WebkitMaskImage: '-webkit-radial-gradient(white, black)'
}))

const heroGlowStyle = computed(() => ({
  background: `
    radial-gradient(circle at ${heroGlow.value.x}% ${heroGlow.value.y}%,
    rgba(var(--theme-glow-rgb), ${0.3 * heroGlow.value.opacity}) 0%,
    rgba(var(--theme-glow-soft-rgb), ${0.2 * heroGlow.value.opacity}) 16%,
    rgba(var(--theme-glow-pale-rgb), ${0.1 * heroGlow.value.opacity}) 30%,
    rgba(28, 25, 23, 0) 48%)
  `
}))

watch(slides, (nextSlides) => {
  if (currentSlideIndex.value >= nextSlides.length) {
    currentSlideIndex.value = 0
  }
  startAutoplay()
}, { immediate: true })

onMounted(() => {
  startAutoplay()
})

onUnmounted(() => {
  clearAutoplay()
})
</script>

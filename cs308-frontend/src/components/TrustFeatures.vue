<template>
  <section class="border-b border-orange-100 bg-[linear-gradient(90deg,var(--theme-bg-strong)_0%,var(--theme-surface-soft)_46%,var(--theme-bg)_100%)]">
    <div class="mx-auto grid max-w-7xl gap-4 px-4 py-6 md:grid-cols-2 md:px-6 lg:grid-cols-4">
      <article
        v-for="item in trustItems"
        :key="item.title"
        class="flex items-center gap-4 rounded-3xl border border-white/70 bg-white/72 px-5 py-4 shadow-sm backdrop-blur"
      >
        <div
          class="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600"
          v-html="item.icon"
        />
        <div>
          <h2 class="text-sm font-semibold text-stone-900">{{ item.title }}</h2>
          <p class="text-sm text-stone-600">{{ item.description }}</p>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup>
const trustItems = [
  {
    title: 'Fast shipping',
    description: 'Quick dispatch on the products you need most.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5h11.25v8.25H3zM14.25 10.5h3.129a1.5 1.5 0 011.2.6l1.671 2.228V15.75h-6M7.5 18a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm10.5 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" /></svg>`
  },
  {
    title: 'Secure checkout',
    description: 'Protected payments and trusted order handling.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75M6 10.5h12v9H6z" /></svg>`
  },
  {
    title: 'Responsive support',
    description: 'Get help fast when orders or accounts need attention.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75A3.375 3.375 0 1112 13.125M12 16.5h.008v.008H12V16.5zm8.25-4.5A8.25 8.25 0 113.75 12a8.25 8.25 0 0116.5 0z" /></svg>`
  },
  {
    title: 'Quality picks',
    description: 'Selected products across audio, gaming, and laptops.',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m6 2.25A9 9 0 1112 3a9 9 0 019 9z" /></svg>`
  }
]
</script>

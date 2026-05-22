<template>
  <div
    ref="sectionRef"
    class="theme-hero-panel relative w-full overflow-hidden border-t border-orange-100/70"
    style="min-height: 36rem;"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" />

    <div class="absolute inset-0 bg-[var(--theme-hero-scrim)]" />
    <div class="absolute inset-0 bg-[linear-gradient(135deg,var(--theme-hero-sheen),transparent_34%,rgba(255,255,255,0.06)_60%,var(--theme-hero-radial)_100%)]" />

    <div class="relative z-10 mx-auto flex min-h-[36rem] max-w-7xl flex-col justify-between px-4 py-10 md:px-6 lg:px-8">
      <div class="grid gap-8 pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div class="max-w-2xl">
          <p class="font-footer-kicker mb-3 uppercase tracking-[0.35em] text-orange-300">
            Stay Connected
          </p>
          <h2 class="font-footer-title mb-4 text-white">
            Real support, fast answers, and a footer that stays alive under your cursor.
          </h2>
          <p class="max-w-xl text-sm leading-7 text-slate-200 md:text-base">
            Reach out for order help, technical questions, shipping issues, or business requests.
            The interactive particle field remains fully live across the entire bottom section.
          </p>
        </div>

        <div class="mt-6 rounded-[2rem] border border-white/18 bg-white/12 p-5 shadow-2xl shadow-indigo-950/20 backdrop-blur-md lg:mt-16">
          <h3 class="font-footer-card-title mb-2 text-white">Contact support</h3>
          <p class="mb-5 max-w-md text-sm text-slate-200">
            Our team is available for product questions, returns, account issues, and warranty support.
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <a
              href="mailto:support@cs308store.com"
              class="rounded-2xl border border-white/18 bg-white/12 px-4 py-3 text-sm text-white transition hover:border-amber-200/70 hover:bg-white/18"
            >
              support@cs308store.com
            </a>
            <a
              href="tel:+900000000000"
              class="rounded-2xl border border-white/18 bg-white/12 px-4 py-3 text-sm text-white transition hover:border-amber-200/70 hover:bg-white/18"
            >
              +90 (000) 000 00 00
            </a>
          </div>
        </div>
      </div>

      <div class="grid gap-4 pt-10 md:grid-cols-3">
        <div class="rounded-[1.5rem] border border-white/18 bg-white/12 p-4 backdrop-blur-sm">
          <p class="font-footer-overline mb-1 uppercase tracking-[0.3em] text-orange-200">Help desk</p>
          <p class="text-sm text-white">Order updates, refund questions, and warranty support.</p>
        </div>
        <div class="rounded-[1.5rem] border border-white/18 bg-white/12 p-4 backdrop-blur-sm">
          <p class="font-footer-overline mb-1 uppercase tracking-[0.3em] text-orange-200">Business</p>
          <p class="text-sm text-white">Bulk orders, reseller contact, and collaboration requests.</p>
        </div>
        <div class="rounded-[1.5rem] border border-white/18 bg-white/12 p-4 backdrop-blur-sm">
          <p class="font-footer-overline mb-1 uppercase tracking-[0.3em] text-orange-200">Availability</p>
          <p class="text-sm text-white">Responsive support flow with a live, interactive footer backdrop.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref(null)
const sectionRef = ref(null)
let animationId, ctx, w, h, themeObserver
const particles = []
const mouse = { x: -1000, y: -1000 }

const COUNT = 90
const CONNECT_DIST = 130
const MOUSE_RADIUS = 140

class Particle {
  constructor() {
    this.x = Math.random() * w
    this.y = Math.random() * h
    this.vx = (Math.random() - 0.5) * 0.6
    this.vy = (Math.random() - 0.5) * 0.6
    this.r = Math.random() * 2.2 + 0.8
    this.opacity = Math.random() * 0.5 + 0.5
    const palette = getThemeParticlePalette()
    this.color = palette[Math.floor(Math.random() * palette.length)]
  }

  update() {
    const dx = this.x - mouse.x
    const dy = this.y - mouse.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < MOUSE_RADIUS && d > 0) {
      const f = (MOUSE_RADIUS - d) / MOUSE_RADIUS
      this.x += (dx / d) * f * 2.5
      this.y += (dy / d) * f * 2.5
    }
    this.x += this.vx
    this.y += this.vy
    if (this.x < 0 || this.x > w) this.vx *= -1
    if (this.y < 0 || this.y > h) this.vy *= -1
    this.x = Math.max(0, Math.min(w, this.x))
    this.y = Math.max(0, Math.min(h, this.y))
  }

  draw() {
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${this.color},${this.opacity})`
    ctx.fill()
  }
}

const init = () => {
  const canvas = canvasRef.value
  ctx = canvas.getContext('2d')
  w = canvas.width = canvas.clientWidth
  h = canvas.height = canvas.clientHeight
  particles.length = 0
  for (let i = 0; i < COUNT; i++) particles.push(new Particle())
  animate()
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  ctx.fillStyle = 'rgba(10,10,20,0.18)'
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < CONNECT_DIST) {
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.strokeStyle = `rgba(${getThemeParticleAccent()},${(1 - d / CONNECT_DIST) * 0.45})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }
    }
    particles[i].update()
    particles[i].draw()
  }
}

const onMove = (e) => {
  const rect = sectionRef.value?.getBoundingClientRect()
  if (!rect) return
  mouse.x = e.clientX - rect.left
  mouse.y = e.clientY - rect.top
}
const onLeave = () => { mouse.x = -1000; mouse.y = -1000 }
const onResize = () => {
  if (!canvasRef.value) return
  w = canvasRef.value.width = canvasRef.value.clientWidth
  h = canvasRef.value.height = canvasRef.value.clientHeight
}

const onThemeChange = () => {
  const palette = getThemeParticlePalette()
  particles.forEach((particle) => {
    particle.color = palette[Math.floor(Math.random() * palette.length)]
  })
}

const getThemeParticlePalette = () => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-particle-palette')
    .trim()
  return value ? value.split('|') : ['199,210,254', '165,180,252', '251,191,36', '251,146,60', '255,237,213']
}

const getThemeParticleAccent = () => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-particle-accent')
    .trim() || '255,120,0'
}

onMounted(() => {
  init()
  themeObserver = new MutationObserver(onThemeChange)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  themeObserver?.disconnect()
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div class="financial-report-chart">
    <div
      v-if="points.length === 0"
      class="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center text-sm text-gray-500"
    >
      No chart data is available for the selected range.
    </div>

    <div
      v-else-if="visibleSeries.length === 0"
      class="rounded-2xl border border-dashed border-gray-200 px-6 py-12 text-center text-sm text-gray-500"
    >
      Select at least one series to draw the chart.
    </div>

    <div
      v-else
      ref="chartShell"
      class="relative rounded-2xl border border-gray-100 bg-white"
      :class="isBarChart ? 'max-h-[560px] overflow-auto' : 'overflow-x-auto overflow-y-hidden'"
      @mouseleave="hideTooltip"
    >
      <svg
        v-if="isBarChart"
        :width="barChartWidth"
        :height="barChartHeight"
        class="block"
        role="img"
        aria-label="Financial report bar chart"
      >
        <g>
          <line
            v-for="tick in scale.ticks"
            :key="`bar-grid-${tick}`"
            :x1="getBarX(tick)"
            :x2="getBarX(tick)"
            :y1="barPadding.top"
            :y2="barPadding.top + barPlotHeight"
            stroke="#e5e7eb"
            stroke-width="1"
          />
          <line
            :x1="barZeroX"
            :x2="barZeroX"
            :y1="barPadding.top"
            :y2="barPadding.top + barPlotHeight"
            stroke="#94a3b8"
            stroke-width="1.5"
          />
        </g>

        <g>
          <text
            v-for="tick in scale.ticks"
            :key="`bar-axis-${tick}`"
            :x="getBarX(tick)"
            :y="barPadding.top + barPlotHeight + 26"
            fill="#64748b"
            font-size="12"
            text-anchor="middle"
          >
            {{ formatAxisCurrency(tick) }}
          </text>
        </g>

        <g v-for="(point, pointIndex) in points" :key="point.key">
          <text
            :x="barPadding.left - 12"
            :y="getBarRowCenter(pointIndex)"
            fill="#334155"
            font-size="12"
            text-anchor="end"
            dominant-baseline="middle"
          >
            {{ point.label }}
          </text>

          <rect
            :x="barPadding.left"
            :y="getBarRowTop(pointIndex)"
            :width="barPlotWidth"
            :height="barRowHeight"
            fill="transparent"
            @mouseenter="showTooltip($event, point, pointIndex)"
            @mousemove="showTooltip($event, point, pointIndex)"
          />

          <rect
            v-if="tooltip?.index === pointIndex"
            :x="barPadding.left"
            :y="getBarRowTop(pointIndex)"
            :width="barPlotWidth"
            :height="barRowHeight"
            fill="#f8fafc"
            pointer-events="none"
          />

          <template v-for="(series, seriesIndex) in visibleSeries" :key="`${point.key}-${series.key}`">
            <rect
              :x="getBarRect(pointIndex, seriesIndex).x"
              :y="getBarRect(pointIndex, seriesIndex).y"
              :width="getBarRect(pointIndex, seriesIndex).width"
              :height="getBarRect(pointIndex, seriesIndex).height"
              :fill="series.color"
              rx="6"
            />
          </template>
        </g>
      </svg>

      <svg
        v-else
        :width="verticalChartWidth"
        :height="verticalChartHeight"
        class="block"
        role="img"
        :aria-label="`Financial report ${type} chart`"
      >
        <g>
          <line
            v-for="tick in scale.ticks"
            :key="`vertical-grid-${tick}`"
            :x1="verticalPadding.left"
            :x2="verticalPadding.left + verticalPlotWidth"
            :y1="getVerticalY(tick)"
            :y2="getVerticalY(tick)"
            stroke="#e5e7eb"
            stroke-width="1"
          />
          <line
            :x1="verticalPadding.left"
            :x2="verticalPadding.left + verticalPlotWidth"
            :y1="verticalZeroY"
            :y2="verticalZeroY"
            stroke="#94a3b8"
            stroke-width="1.5"
          />
        </g>

        <g>
          <text
            v-for="tick in scale.ticks"
            :key="`vertical-axis-${tick}`"
            :x="verticalPadding.left - 12"
            :y="getVerticalY(tick) + 4"
            fill="#64748b"
            font-size="12"
            text-anchor="end"
          >
            {{ formatAxisCurrency(tick) }}
          </text>
        </g>

        <g v-if="type === 'column'">
          <rect
            v-for="(point, pointIndex) in points"
            :key="`${point.key}-column-overlay`"
            :x="verticalPadding.left + pointIndex * verticalStep"
            :y="verticalPadding.top"
            :width="verticalStep"
            :height="verticalPlotHeight"
            fill="transparent"
            @mouseenter="showTooltip($event, point, pointIndex)"
            @mousemove="showTooltip($event, point, pointIndex)"
          />

          <rect
            v-if="tooltip"
            :x="verticalPadding.left + tooltip.index * verticalStep"
            :y="verticalPadding.top"
            :width="verticalStep"
            :height="verticalPlotHeight"
            fill="#f8fafc"
            pointer-events="none"
          />

          <template v-for="(point, pointIndex) in points" :key="`${point.key}-column-bars`">
            <rect
              v-for="(series, seriesIndex) in visibleSeries"
              :key="`${point.key}-${series.key}-column`"
              :x="getColumnRect(pointIndex, seriesIndex).x"
              :y="getColumnRect(pointIndex, seriesIndex).y"
              :width="getColumnRect(pointIndex, seriesIndex).width"
              :height="getColumnRect(pointIndex, seriesIndex).height"
              :fill="series.color"
              rx="8"
            />
          </template>
        </g>

        <g v-else>
          <rect
            v-for="(point, pointIndex) in points"
            :key="`${point.key}-line-overlay`"
            :x="verticalPadding.left + pointIndex * verticalStep"
            :y="verticalPadding.top"
            :width="verticalStep"
            :height="verticalPlotHeight"
            fill="transparent"
            @mouseenter="showTooltip($event, point, pointIndex)"
            @mousemove="showTooltip($event, point, pointIndex)"
          />

          <line
            v-if="tooltip"
            :x1="getVerticalCenterX(tooltip.index)"
            :x2="getVerticalCenterX(tooltip.index)"
            :y1="verticalPadding.top"
            :y2="verticalPadding.top + verticalPlotHeight"
            stroke="#cbd5e1"
            stroke-dasharray="4 4"
            pointer-events="none"
          />

          <path
            v-for="series in visibleSeries"
            :key="`${series.key}-line-path`"
            :d="getLinePath(series.key)"
            fill="none"
            :stroke="series.color"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <template v-for="(point, pointIndex) in points" :key="`${point.key}-line-points`">
            <circle
              v-for="series in visibleSeries"
              :key="`${point.key}-${series.key}-point`"
              :cx="getVerticalCenterX(pointIndex)"
              :cy="getVerticalY(point[series.key])"
              r="4.5"
              :fill="series.color"
              stroke="#ffffff"
              stroke-width="2"
            />
          </template>
        </g>

        <g>
          <template v-for="(point, pointIndex) in points" :key="`${point.key}-label`">
            <text
              v-if="shouldShowLabel(pointIndex)"
              :x="getVerticalCenterX(pointIndex)"
              :y="verticalPadding.top + verticalPlotHeight + 22"
              fill="#475569"
              font-size="12"
              :text-anchor="verticalLabelRotation === 0 ? 'middle' : 'end'"
              :transform="
                verticalLabelRotation === 0
                  ? undefined
                  : `rotate(${verticalLabelRotation} ${getVerticalCenterX(pointIndex)} ${verticalPadding.top + verticalPlotHeight + 22})`
              "
            >
              {{ point.label }}
            </text>
          </template>
        </g>
      </svg>

      <div
        v-if="tooltip"
        class="pointer-events-none absolute z-10 w-56 rounded-2xl bg-slate-900 px-3 py-2 text-xs text-white shadow-2xl"
        :style="tooltipStyle"
      >
        <p class="font-semibold text-white">{{ tooltip.point.rangeLabel || tooltip.point.label }}</p>
        <div class="mt-2 space-y-1.5">
          <div
            v-for="series in visibleSeries"
            :key="`${tooltip.point.key}-${series.key}-tooltip`"
            class="flex items-center justify-between gap-3"
          >
            <span class="inline-flex items-center gap-2 text-slate-200">
              <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: series.color }"></span>
              {{ series.label }}
            </span>
            <span class="font-semibold text-white">{{ formatCurrency(tooltip.point[series.key]) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { buildAxisScale, formatAxisCurrency, getLabelStep } from '../../utils/financialReport'

const props = defineProps({
  points: {
    type: Array,
    default: () => [],
  },
  type: {
    type: String,
    default: 'line',
  },
  seriesVisibility: {
    type: Object,
    default: () => ({
      revenue: true,
      costOfGoods: true,
      profitLoss: true,
      refunds: true,
    }),
  },
})

const SERIES = [
  { key: 'revenue', label: 'Revenue', color: '#10b981' },
  { key: 'costOfGoods', label: 'Cost of Goods', color: '#f59e0b' },
  { key: 'profitLoss', label: 'Profit / Loss', color: '#f97316' },
  { key: 'refunds', label: 'Refunds', color: '#ef4444' },
]

const chartShell = ref(null)
const tooltip = ref(null)

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const formatCurrency = (value) =>
  `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const visibleSeries = computed(() =>
  SERIES.filter((series) => props.seriesVisibility?.[series.key] !== false)
)

const visibleValues = computed(() =>
  props.points.flatMap((point) => visibleSeries.value.map((series) => Number(point?.[series.key] || 0)))
)

const scale = computed(() => buildAxisScale(visibleValues.value))

const valueRange = computed(() => Math.max(scale.value.max - scale.value.min, 1))

const isBarChart = computed(() => props.type === 'bar')

const verticalPadding = {
  top: 26,
  right: 28,
  bottom: 82,
  left: 84,
}

const verticalCategoryWidth = computed(() => {
  if (props.type === 'column') {
    return Math.max(92, visibleSeries.value.length * 30 + 26)
  }

  return 76
})

const verticalChartWidth = computed(
  () => Math.max(960, verticalPadding.left + verticalPadding.right + props.points.length * verticalCategoryWidth.value)
)

const verticalChartHeight = 430
const verticalPlotWidth = computed(() => verticalChartWidth.value - verticalPadding.left - verticalPadding.right)
const verticalPlotHeight = verticalChartHeight - verticalPadding.top - verticalPadding.bottom
const verticalStep = computed(() => verticalPlotWidth.value / Math.max(props.points.length, 1))
const verticalZeroY = computed(() => getVerticalY(0))
const verticalLabelStep = computed(() => getLabelStep(props.points.length, 10))
const verticalLabelRotation = computed(() =>
  props.points.length > 10 || props.points.some((point) => String(point?.label || '').length > 12) ? -35 : 0
)

const barPadding = {
  top: 24,
  right: 28,
  bottom: 52,
  left: 168,
}

const barRowHeight = computed(() => Math.max(52, visibleSeries.value.length * 18 + 18))
const barChartHeight = computed(
  () => Math.max(420, barPadding.top + barPadding.bottom + props.points.length * barRowHeight.value)
)
const barChartWidth = 1080
const barPlotWidth = barChartWidth - barPadding.left - barPadding.right
const barPlotHeight = computed(() => barChartHeight.value - barPadding.top - barPadding.bottom)
const barZeroX = computed(() => getBarX(0))

const tooltipStyle = computed(() => {
  if (!tooltip.value) return {}

  return {
    left: `${tooltip.value.left}px`,
    top: `${tooltip.value.top}px`,
  }
})

const getVerticalCenterX = (index) => verticalPadding.left + verticalStep.value * index + verticalStep.value / 2

const getVerticalY = (value) => {
  const numericValue = Number(value || 0)
  return verticalPadding.top + verticalPlotHeight - ((numericValue - scale.value.min) / valueRange.value) * verticalPlotHeight
}

const getColumnRect = (pointIndex, seriesIndex) => {
  const clusterWidth = Math.min(verticalStep.value * 0.74, verticalStep.value - 14)
  const gap = Math.min(8, clusterWidth * 0.08)
  const barCount = Math.max(visibleSeries.value.length, 1)
  const totalGap = gap * Math.max(barCount - 1, 0)
  const barWidth = Math.max(10, (clusterWidth - totalGap) / barCount)
  const totalWidth = barWidth * barCount + totalGap
  const startX = verticalPadding.left + verticalStep.value * pointIndex + (verticalStep.value - totalWidth) / 2
  const seriesKey = visibleSeries.value[seriesIndex]?.key
  const value = Number(props.points[pointIndex]?.[seriesKey] || 0)
  const valueY = getVerticalY(value)
  const zeroY = verticalZeroY.value
  const height = Math.abs(valueY - zeroY)

  return {
    x: startX + seriesIndex * (barWidth + gap),
    y: value >= 0 ? valueY : zeroY,
    width: barWidth,
    height: height === 0 ? 0 : Math.max(height, 3),
  }
}

const getLinePath = (seriesKey) =>
  props.points
    .map((point, index) => {
      const x = getVerticalCenterX(index)
      const y = getVerticalY(point?.[seriesKey])
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

const shouldShowLabel = (index) =>
  index === 0 || index === props.points.length - 1 || index % verticalLabelStep.value === 0

const getBarX = (value) => {
  const numericValue = Number(value || 0)
  return barPadding.left + ((numericValue - scale.value.min) / valueRange.value) * barPlotWidth
}

const getBarRowTop = (index) => barPadding.top + index * barRowHeight.value

const getBarRowCenter = (index) => getBarRowTop(index) + barRowHeight.value / 2

const getBarRect = (pointIndex, seriesIndex) => {
  const groupHeight = Math.min(barRowHeight.value * 0.72, barRowHeight.value - 10)
  const gap = 4
  const barCount = Math.max(visibleSeries.value.length, 1)
  const totalGap = gap * Math.max(barCount - 1, 0)
  const barHeight = Math.max(8, (groupHeight - totalGap) / barCount)
  const totalHeight = barHeight * barCount + totalGap
  const startY = getBarRowCenter(pointIndex) - totalHeight / 2
  const seriesKey = visibleSeries.value[seriesIndex]?.key
  const value = Number(props.points[pointIndex]?.[seriesKey] || 0)
  const valueX = getBarX(value)
  const zeroX = barZeroX.value
  const width = Math.abs(valueX - zeroX)

  return {
    x: value >= 0 ? zeroX : valueX,
    y: startY + seriesIndex * (barHeight + gap),
    width: width === 0 ? 0 : Math.max(width, 3),
    height: barHeight,
  }
}

const showTooltip = (event, point, index) => {
  const shell = chartShell.value
  if (!shell) return

  const shellRect = shell.getBoundingClientRect()
  const tooltipWidth = 224
  const tooltipHeight = 118
  const rawLeft = shell.scrollLeft + event.clientX - shellRect.left + 16
  const rawTop = shell.scrollTop + event.clientY - shellRect.top + 16
  const minLeft = shell.scrollLeft + 12
  const maxLeft = Math.max(minLeft, shell.scrollLeft + shell.clientWidth - tooltipWidth - 12)
  const minTop = shell.scrollTop + 12
  const maxTop = Math.max(minTop, shell.scrollTop + shell.clientHeight - tooltipHeight - 12)

  tooltip.value = {
    point,
    index,
    left: clamp(rawLeft, minLeft, maxLeft),
    top: clamp(rawTop, minTop, maxTop),
  }
}

const hideTooltip = () => {
  tooltip.value = null
}
</script>

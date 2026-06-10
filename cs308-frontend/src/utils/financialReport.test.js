import { describe, expect, test } from 'vitest'
import { buildAxisScale, buildFinancialChartPoints } from './financialReport'

describe('buildFinancialChartPoints', () => {
  const dailyPoints = [
    {
      date: '2026-05-01',
      revenue: 100,
      refunds: 10,
      costOfGoods: 60,
      profitLoss: 30,
      discountLoss: 10,
      orders: 1,
      itemsSold: 2,
    },
    {
      date: '2026-05-03',
      revenue: 40,
      refunds: 0,
      costOfGoods: 25,
      profitLoss: 15,
      discountLoss: 5,
      orders: 2,
      itemsSold: 3,
    },
    {
      date: '2026-05-10',
      revenue: 50,
      refunds: 0,
      costOfGoods: 30,
      profitLoss: 20,
      discountLoss: 0,
      orders: 1,
      itemsSold: 1,
    },
  ]

  test('fills every day in the selected range', () => {
    const points = buildFinancialChartPoints(dailyPoints, '2026-05-01', '2026-05-03', 'day')

    expect(points).toEqual([
      expect.objectContaining({
        key: '2026-05-01',
        revenue: 100,
        refunds: 10,
        costOfGoods: 60,
        profitLoss: 30,
        discountLoss: 10,
        orders: 1,
        itemsSold: 2,
      }),
      expect.objectContaining({
        key: '2026-05-02',
        revenue: 0,
        refunds: 0,
        costOfGoods: 0,
        profitLoss: 0,
        discountLoss: 0,
        orders: 0,
        itemsSold: 0,
      }),
      expect.objectContaining({
        key: '2026-05-03',
        revenue: 40,
        refunds: 0,
        costOfGoods: 25,
        profitLoss: 15,
        discountLoss: 5,
        orders: 2,
        itemsSold: 3,
      }),
    ])
  })

  test('groups the selected range by calendar week', () => {
    const points = buildFinancialChartPoints(dailyPoints, '2026-05-01', '2026-05-10', 'week')

    expect(points).toHaveLength(2)
    expect(points[0]).toEqual(
      expect.objectContaining({
        key: '2026-04-27',
        revenue: 140,
        refunds: 10,
        costOfGoods: 85,
        profitLoss: 45,
        discountLoss: 15,
        orders: 3,
        itemsSold: 5,
      })
    )
    expect(points[1]).toEqual(
      expect.objectContaining({
        key: '2026-05-04',
        revenue: 50,
        refunds: 0,
        costOfGoods: 30,
        profitLoss: 20,
        discountLoss: 0,
        orders: 1,
        itemsSold: 1,
      })
    )
  })

  test('groups the selected range by month', () => {
    const points = buildFinancialChartPoints(dailyPoints, '2026-05-01', '2026-05-31', 'month')

    expect(points).toHaveLength(1)
    expect(points[0]).toEqual(
      expect.objectContaining({
        key: '2026-05-01',
        label: '01.05.2026 - 31.05.2026',
        revenue: 190,
        refunds: 10,
        costOfGoods: 115,
        profitLoss: 65,
        discountLoss: 15,
        orders: 4,
        itemsSold: 6,
      })
    )
  })
})

describe('buildAxisScale', () => {
  test('creates a zero-based positive scale', () => {
    expect(buildAxisScale([1200, 400, 50])).toEqual({
      min: 0,
      max: 1500,
      step: 500,
      ticks: [0, 500, 1000, 1500],
    })
  })

  test('creates a mixed negative and positive scale', () => {
    expect(buildAxisScale([-120, 80, 40])).toEqual({
      min: -150,
      max: 100,
      step: 50,
      ticks: [-150, -100, -50, 0, 50, 100],
    })
  })
})

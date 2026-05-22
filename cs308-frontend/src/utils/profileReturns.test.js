import { describe, expect, it, vi } from 'vitest'
import {
  canRequestReturn,
  getReturnEligibilityStatus,
  loadCustomerReturnRequests,
  submitReturnRequestFlow,
} from './profileReturns'

class FakeFormData {
  constructor() {
    this.values = []
  }

  append(key, value) {
    this.values.push([key, value])
  }

  get(key) {
    return this.values.find(([entryKey]) => entryKey === key)?.[1]
  }

  getAll(key) {
    return this.values
      .filter(([entryKey]) => entryKey === key)
      .map(([, value]) => value)
  }
}

const baseOrder = {
  id: 'order-1',
  status: 'paid',
  deliveryStatus: 'delivered',
  paidAt: '2026-05-01T00:00:00.000Z',
  items: [
    { productId: 'product-1', name: 'Keyboard', quantity: 2, unitPrice: 80 },
  ],
}

const baseItem = baseOrder.items[0]

describe('profile returns helpers', () => {
  it('marks delivered items as eligible and keeps the return action available', () => {
    const status = getReturnEligibilityStatus({
      userRole: 'customer',
      order: baseOrder,
      item: baseItem,
      returnRequests: [],
      now: new Date('2026-05-20T00:00:00.000Z').getTime(),
      formatDate: () => 'May 31, 2026',
    })

    expect(status).toEqual({
      eligible: true,
      label: 'Return eligible until May 31, 2026',
    })
    expect(
      canRequestReturn({
        userRole: 'customer',
        order: baseOrder,
        item: baseItem,
        returnRequests: [],
        now: new Date('2026-05-20T00:00:00.000Z').getTime(),
      })
    ).toBe(true)
  })

  it('hides the return action and shows a pending label for items with an open request', () => {
    const returnRequests = [
      {
        orderId: 'order-1',
        status: 'pending',
        items: [{ productId: 'product-1', quantity: 1 }],
      },
    ]

    expect(
      getReturnEligibilityStatus({
        userRole: 'customer',
        order: baseOrder,
        item: baseItem,
        returnRequests,
        now: new Date('2026-05-20T00:00:00.000Z').getTime(),
      })
    ).toEqual({
      eligible: false,
      label: 'Return pending for 1 item(s)',
    })
    expect(
      canRequestReturn({
        userRole: 'customer',
        order: baseOrder,
        item: baseItem,
        returnRequests,
        now: new Date('2026-05-20T00:00:00.000Z').getTime(),
      })
    ).toBe(false)
  })

  it('loads customer return history exactly as the account page expects it', async () => {
    const history = [
      {
        id: 'return-1',
        orderId: 'order-1',
        status: 'approved',
        refundAmount: 80,
      },
      {
        id: 'return-2',
        orderId: 'order-2',
        status: 'rejected',
        refundAmount: 40,
        managerNotes: 'Opened item is not returnable',
      },
    ]
    const getMyReturnRequests = vi.fn().mockResolvedValue({
      data: {
        returnRequests: history,
      },
    })

    await expect(
      loadCustomerReturnRequests({
        userRole: 'customer',
        getMyReturnRequests,
      })
    ).resolves.toEqual(history)
    expect(getMyReturnRequests).toHaveBeenCalledTimes(1)
  })

  it('does not load return history for non-customer profiles', async () => {
    const getMyReturnRequests = vi.fn()

    await expect(
      loadCustomerReturnRequests({
        userRole: 'sales_manager',
        getMyReturnRequests,
      })
    ).resolves.toEqual([])
    expect(getMyReturnRequests).not.toHaveBeenCalled()
  })

  it('submits the profile return form, resets it, and refreshes account history', async () => {
    const submitReturnRequest = vi.fn().mockResolvedValue({})
    const fetchReturnRequests = vi.fn().mockResolvedValue([])
    const resetReturnForm = vi.fn()
    const formData = new FakeFormData()

    await submitReturnRequestFlow({
      order: baseOrder,
      returnForm: {
        orderId: 'order-1',
        items: [{ productId: 'product-1', quantity: 2 }],
        reason: ' Damaged in transit ',
        photos: [{ file: 'photo-a' }, { file: 'photo-b' }],
      },
      returnRequests: [],
      submitReturnRequest,
      fetchReturnRequests,
      resetReturnForm,
      createFormData: () => formData,
    })

    expect(submitReturnRequest).toHaveBeenCalledWith(formData)
    expect(formData.get('orderId')).toBe('order-1')
    expect(formData.get('reason')).toBe('Damaged in transit')
    expect(formData.get('items')).toBe(
      JSON.stringify([{ productId: 'product-1', quantity: 2 }])
    )
    expect(formData.getAll('photos')).toEqual(['photo-a', 'photo-b'])
    expect(resetReturnForm).toHaveBeenCalledTimes(1)
    expect(fetchReturnRequests).toHaveBeenCalledTimes(1)
    expect(submitReturnRequest.mock.invocationCallOrder[0]).toBeLessThan(
      resetReturnForm.mock.invocationCallOrder[0]
    )
    expect(resetReturnForm.mock.invocationCallOrder[0]).toBeLessThan(
      fetchReturnRequests.mock.invocationCallOrder[0]
    )
  })
})

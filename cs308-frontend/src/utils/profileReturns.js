import { formatDisplayDate } from './dateFormat'

const defaultFormatDate = (value) => {
  return formatDisplayDate(value, 'Unknown')
}

export const createEmptyReturnForm = () => ({
  orderId: '',
  items: [],
  reason: '',
  photos: [],
})

export const loadCustomerReturnRequests = async ({ userRole, getMyReturnRequests }) => {
  if (userRole !== 'customer') {
    return []
  }

  const res = await getMyReturnRequests()
  return res?.data?.returnRequests || []
}

export const getPendingReturnQuantityForItem = (returnRequests, orderId, productId) => {
  return returnRequests
    .filter((request) => request.orderId === orderId && request.status === 'pending')
    .flatMap((request) => request.items || [])
    .filter((item) => item.productId === productId)
    .reduce((total, item) => total + Number(item.quantity || 0), 0)
}

export const getApprovedReturnedQuantityForItem = (returnRequests, orderId, productId) => {
  return returnRequests
    .filter((request) => request.orderId === orderId && request.status === 'approved')
    .flatMap((request) => request.items || [])
    .filter((item) => item.productId === productId)
    .reduce((total, item) => total + Number(item.quantity || 0), 0)
}

export const hasPendingReturnForItem = (returnRequests, orderId, productId) => {
  return returnRequests.some((request) =>
    request.orderId === orderId &&
    request.status === 'pending' &&
    (request.items || []).some((item) => item.productId === productId)
  )
}

export const getRemainingReturnQuantity = (returnRequests, order, item) => {
  return Math.max(
    0,
    Number(item.quantity || 0) -
      getApprovedReturnedQuantityForItem(returnRequests, order.id, item.productId)
  )
}

export const getReturnWindowDeadline = (order) => {
  if (!order.paidAt) return null

  const paidAt = new Date(order.paidAt)
  if (Number.isNaN(paidAt.getTime())) return null

  const deadline = new Date(paidAt)
  deadline.setDate(deadline.getDate() + 30)
  return deadline
}

export const isWithinReturnWindow = (order, now = Date.now()) => {
  const deadline = getReturnWindowDeadline(order)
  return Boolean(deadline && now <= deadline.getTime())
}

export const getReturnEligibilityStatus = ({
  userRole,
  order,
  item,
  returnRequests,
  now = Date.now(),
  formatDate = defaultFormatDate,
}) => {
  if (userRole !== 'customer' || order.status !== 'paid') return null

  if (order.deliveryStatus !== 'delivered') {
    return { eligible: false, label: 'Return available after delivery' }
  }

  if (!isWithinReturnWindow(order, now)) {
    return { eligible: false, label: 'Return window expired' }
  }

  if (hasPendingReturnForItem(returnRequests, order.id, item.productId)) {
    return {
      eligible: false,
      label: `Return pending for ${getPendingReturnQuantityForItem(
        returnRequests,
        order.id,
        item.productId
      )} item(s)`,
    }
  }

  if (getRemainingReturnQuantity(returnRequests, order, item) <= 0) {
    return { eligible: false, label: 'Fully returned' }
  }

  const deadline = getReturnWindowDeadline(order)
  return { eligible: true, label: `Return eligible until ${formatDate(deadline)}` }
}

export const canRequestReturn = ({ userRole, order, item, returnRequests, now = Date.now() }) => {
  return userRole === 'customer' &&
    order.status === 'paid' &&
    order.deliveryStatus === 'delivered' &&
    isWithinReturnWindow(order, now) &&
    !hasPendingReturnForItem(returnRequests, order.id, item.productId) &&
    getRemainingReturnQuantity(returnRequests, order, item) > 0
}

export const buildReturnRequestFormData = ({
  order,
  returnForm,
  returnRequests,
  createFormData = () => new FormData(),
}) => {
  if (returnForm.items.length === 0) {
    throw new Error('Select at least one item to return.')
  }

  const invalidQuantityItem = returnForm.items.find((returnItem) => {
    const orderedItem = order.items.find((item) => item.productId === returnItem.productId)
    const quantity = Number(returnItem.quantity)
    const maxQuantity = orderedItem
      ? getRemainingReturnQuantity(returnRequests, order, orderedItem)
      : 0

    return !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > maxQuantity
  })

  if (invalidQuantityItem) {
    throw new Error('Enter a valid return quantity for each selected item.')
  }

  const reason = returnForm.reason.trim()
  if (!reason) {
    throw new Error('Enter a return reason.')
  }

  const formData = createFormData()
  formData.append('orderId', order.id)
  formData.append('reason', reason)
  formData.append(
    'items',
    JSON.stringify(
      returnForm.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      }))
    )
  )

  returnForm.photos.forEach((photo) => {
    formData.append('photos', photo.file)
  })

  return formData
}

export const submitReturnRequestFlow = async ({
  order,
  returnForm,
  returnRequests,
  submitReturnRequest,
  fetchReturnRequests,
  resetReturnForm,
  createFormData,
}) => {
  const formData = buildReturnRequestFormData({
    order,
    returnForm,
    returnRequests,
    createFormData,
  })

  await submitReturnRequest(formData)
  resetReturnForm()
  await fetchReturnRequests()

  return formData
}

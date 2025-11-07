export const orderDetailsPath = (orderId: string | number): string => {
    const value = String(orderId)
    const encoded = encodeURIComponent(value)
    return `/orders/${encoded}`
}

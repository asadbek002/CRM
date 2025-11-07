import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
    buildAttachmentDownloadUrl,
    fetchOrderDetail,
    OrderDetail,
} from '@/api'

function formatCurrency(amount?: number | null) {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
        return '-'
    }
    return new Intl.NumberFormat('uz-UZ', {
        style: 'currency',
        currency: 'UZS',
        maximumFractionDigits: 0,
    }).format(amount)
}

function formatDate(value?: string | null, withTime = false) {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return withTime
        ? date.toLocaleString()
        : date.toLocaleDateString()
}

export default function OrderDetails() {
    const params = useParams<{ id: string }>()
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const id = params.id
        if (!id) {
            setError('Order ID is missing')
            setLoading(false)
            return
        }
        const numericId = Number(id)
        if (!Number.isFinite(numericId) || numericId <= 0) {
            setError('Invalid order identifier')
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)
        fetchOrderDetail(numericId)
            .then((data) => {
                setOrder(data)
            })
            .catch((err) => {
                const detail = err?.response?.data?.detail
                setError(detail || 'Failed to load order details')
            })
            .finally(() => setLoading(false))
    }, [params.id])

    const paymentSummary = useMemo(() => {
        if (!order) return '-'
        return `${formatCurrency(order.paid_sum)} / Qoldiq: ${formatCurrency(order.balance)}`
    }, [order])

    if (loading) {
        return <div className="p-6 text-gray-600">Loading order...</div>
    }

    if (error) {
        return <div className="p-6 text-red-600">{error}</div>
    }

    if (!order) {
        return <div className="p-6 text-gray-600">Order not found.</div>
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900">Buyurtma #{order.id}</h1>
                    <p className="text-sm text-gray-500">
                        {order.client_name || '-'} • {order.client_phone || '-'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Link
                        className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
                        to={`/orders/${order.id}/upload`}
                    >
                        Fayllar
                    </Link>
                    <Link
                        className="px-3 py-2 rounded border border-gray-300 hover:bg-gray-50"
                        to={`/orders/${order.id}/verify`}
                    >
                        Tasdiqlash
                    </Link>
                </div>
            </div>

            <section className="grid md:grid-cols-2 gap-4">
                <Info title="Holati" value={order.status || '-'} />
                <Info title="To'lov" value={paymentSummary} />
                <Info title="To'lov holati" value={order.payment_status || '-'} />
                <Info title="Huquq" value={order.customer_type || '-'} />
                <Info title="Hujjat turi" value={order.doc_type || '-'} />
                <Info title="Davlat" value={order.country || '-'} />
                <Info title="Filial" value={order.branch || '-'} />
                <Info title="Mas'ul" value={order.manager || '-'} />
                <Info title="Deadline" value={formatDate(order.deadline)} />
                <Info title="Yaratilgan" value={formatDate(order.created_at)} />
                <Info title="Umumiy summa" value={formatCurrency(order.total_amount)} />
                <Info title="Eslatma" value={order.notes || '-'} />
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-3">Fayllar</h2>
                {order.attachments && order.attachments.length > 0 ? (
                    <ul className="space-y-2">
                        {order.attachments.map((attachment) => {
                            const sizeLabel =
                                typeof attachment.size === 'number'
                                    ? `${Math.round((attachment.size / 1024) * 10) / 10} KB`
                                    : '-'
                            return (
                                <li
                                    key={attachment.id}
                                    className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                                >
                                    <div>
                                        <div className="font-medium">{attachment.display_name}</div>
                                        <div className="text-xs text-gray-500">
                                            {attachment.mime || 'application/octet-stream'} •{' '}
                                            {sizeLabel}
                                        </div>
                                    </div>
                                    <a
                                        className="text-blue-600 hover:underline"
                                        href={buildAttachmentDownloadUrl(attachment.id)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Yuklab olish
                                    </a>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <div className="text-sm text-gray-500">Fayllar mavjud emas.</div>
                )}
            </section>

            <section>
                <h2 className="text-lg font-semibold mb-3">To'lovlar</h2>
                {order.payments && order.payments.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">Sana</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">Miqdor</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">Usul</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600">Izoh</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {order.payments.map((payment) => (
                                    <tr key={payment.id}>
                                        <td className="px-3 py-2">{formatDate(payment.paid_at, true)}</td>
                                        <td className="px-3 py-2">{formatCurrency(payment.amount)}</td>
                                        <td className="px-3 py-2">{payment.method || '-'}</td>
                                        <td className="px-3 py-2">{payment.note || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">To'lovlar hali kiritilmagan.</div>
                )}
            </section>
        </div>
    )
}

function Info({ title, value }: { title: string; value: string }) {
    return (
        <div className="rounded-xl border p-4 bg-white">
            <div className="text-xs uppercase text-gray-500">{title}</div>
            <div className="mt-1 text-sm text-gray-900 break-words">{value}</div>
        </div>
    )
}

import { useEffect, useMemo, useState } from 'react'
import api from '../api'

type OrderStatus = 'hali_boshlanmagan' | 'jarayonda' | 'tayyor' | 'topshirildi'

type Props = {
    orderId: number
    initial?: string | null
    onUpdated?: () => void
}

const STATUS_OPTIONS: OrderStatus[] = [
    'hali_boshlanmagan',
    'jarayonda',
    'tayyor',
    'topshirildi',
]

const STATUS_LABELS: Record<OrderStatus, string> = {
    hali_boshlanmagan: 'Hali boshlanmadi',
    jarayonda: 'Jarayonda',
    tayyor: 'Tayyor',
    topshirildi: 'Topshirildi',
}

const STATUS_TONE: Record<OrderStatus, string> = {
    hali_boshlanmagan: 'bg-slate-100 text-slate-700 border border-slate-200',
    jarayonda: 'bg-amber-100 text-amber-800 border border-amber-200',
    tayyor: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    topshirildi: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
}

const STATUS_ALIAS: Record<string, OrderStatus> = {
    hali_boshlanmagan: 'hali_boshlanmagan',
    hali_boshlanmadi: 'hali_boshlanmagan',
    jarayonda: 'jarayonda',
    tayyor: 'tayyor',
    topshirildi: 'topshirildi',
    yakunlandi: 'topshirildi',
}

const normalizeStatus = (raw?: string | null): OrderStatus => {
    if (!raw) return 'hali_boshlanmagan'
    const key = raw.toLowerCase() as keyof typeof STATUS_ALIAS
    return STATUS_ALIAS[key] || 'hali_boshlanmagan'
}

export default function OrderStatusSelect({ orderId, initial, onUpdated }: Props) {
    const [value, setValue] = useState<OrderStatus>('hali_boshlanmagan')
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        setValue(normalizeStatus(initial))
    }, [initial])

    const tone = useMemo(() => STATUS_TONE[value], [value])

    const onChange = async (next: OrderStatus) => {
        if (busy || next === value) return
        setBusy(true)
        try {
            await api.patch(`/orders/${orderId}/status`, { status: next })
            setValue(next)
            onUpdated?.()
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className={`inline-flex items-center rounded-full ${tone}`}>
            <select
                className="bg-transparent px-3 py-1 text-xs font-semibold focus:outline-none"
                value={value}
                disabled={busy}
                title={STATUS_LABELS[value]}
                onChange={e => onChange(e.target.value as OrderStatus)}
            >
                {STATUS_OPTIONS.map(option => (
                    <option key={option} value={option} className="text-gray-900">
                        {STATUS_LABELS[option]}
                    </option>
                ))}
            </select>
        </div>
    )
}

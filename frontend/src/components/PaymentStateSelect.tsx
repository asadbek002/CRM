// frontend/src/components/PaymentStateSelect.tsx
import { useEffect, useState } from 'react'
import api from '../api'

type PS = 'UNPAID' | 'PARTIAL' | 'PAID'

const LABELS: Record<PS, string> = {
    UNPAID: "To'lanmagan",
    PARTIAL: "Qisman to'langan",
    PAID: "To'liq to'langan",
}

export default function PaymentStateSelect({
    orderId,
    initial,
    onUpdated,
}: {
    orderId: number
    initial: PS
    onUpdated?: () => void
}) {
    const [value, setValue] = useState<PS>(initial)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        setValue(initial)
    }, [initial])

    const onChange = async (nv: PS) => {
        setBusy(true)
        try {
            await api.patch(`/orders/${orderId}/payment-state`, { payment_state: nv })
            setValue(nv)
            onUpdated?.()
        } finally {
            setBusy(false)
        }
    }

    return (
        <select
            className="border rounded px-2 py-1"
            disabled={busy}
            value={value}
            title={LABELS[value]}
            onChange={e => onChange(e.target.value as PS)}
        >
            {(['UNPAID', 'PARTIAL', 'PAID'] as PS[]).map(key => (
                <option key={key} value={key}>
                    {LABELS[key]}
                </option>
            ))}
        </select>
    )
}

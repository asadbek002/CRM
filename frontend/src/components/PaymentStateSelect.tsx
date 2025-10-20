// frontend/src/components/PaymentStateSelect.tsx
import { useState } from 'react'
import api from '../api'

type PS = 'UNPAID' | 'PARTIAL' | 'PAID'

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
            onChange={e => onChange(e.target.value as PS)}
        >
            <option value="UNPAID">UNPAID</option>
            <option value="PARTIAL">PARTIAL</option>
            <option value="PAID">PAID</option>
        </select>
    )
}

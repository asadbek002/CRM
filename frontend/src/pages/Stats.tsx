import { useState, useEffect } from 'react'
import api from '../api'

type PaymentState = 'UNPAID' | 'PARTIAL' | 'PAID'

type StateStats = {
    count: number
    total_amount: number
    paid_amount: number
    balance: number
}

type StatRow = {
    bucket: string
    orders: number
    sum: number
    total_amount: number
    states: Record<PaymentState, StateStats>
}

const STATUS_ORDER: PaymentState[] = ['PAID', 'PARTIAL', 'UNPAID']
const STATUS_LABELS: Record<PaymentState, string> = {
    PAID: "To'liq to'langan",
    PARTIAL: "Qisman to'langan",
    UNPAID: "To'lanmagan",
}

const GRAN_OPTIONS: { key: 'daily' | 'weekly' | 'monthly'; label: string }[] = [
    { key: 'daily', label: 'Kunlik' },
    { key: 'weekly', label: 'Haftalik' },
    { key: 'monthly', label: 'Oylik' },
]

const formatCurrency = (value: number | undefined | null) => {
    const num = Number(value ?? 0)
    return num.toLocaleString('uz-UZ')
}

const emptyStateStats = (): StateStats => ({ count: 0, total_amount: 0, paid_amount: 0, balance: 0 })

export default function StatsPage() {
    const [gran, setGran] = useState<'daily' | 'weekly' | 'monthly'>('daily')
    const [rows, setRows] = useState<StatRow[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        setLoading(true)
        setError(null)

            ; (async () => {
                try {
                    const response = await api.get('/orders/stats/payments', { params: { granularity: gran } })
                    if (!active) return
                    const rawRows = (response.data?.rows ?? []) as any[]
                    const normalized: StatRow[] = rawRows.map(item => {
                        const states: Record<PaymentState, StateStats> = {
                            PAID: emptyStateStats(),
                            PARTIAL: emptyStateStats(),
                            UNPAID: emptyStateStats(),
                        }

                        STATUS_ORDER.forEach(key => {
                            const stats = item?.states?.[key] ?? {}
                            states[key] = {
                                count: Number(stats.count ?? 0),
                                total_amount: Number(stats.total_amount ?? 0),
                                paid_amount: Number(stats.paid_amount ?? 0),
                                balance: Number(stats.balance ?? 0),
                            }
                        })

                        return {
                            bucket: String(item.bucket ?? ''),
                            orders: Number(item.orders ?? 0),
                            sum: Number(item.sum ?? 0),
                            total_amount: Number(item.total_amount ?? 0),
                            states,
                        }
                    })
                    setRows(normalized)
                } catch (err) {
                    if (!active) return
                    console.error('Failed to load payment stats', err)
                    setError("Ma'lumotni yuklashda xatolik yuz berdi")
                    setRows([])
                } finally {
                    if (active) {
                        setLoading(false)
                    }
                }
            })()

        return () => {
            active = false
        }
    }, [gran])

    const totals = rows.reduce(
        (acc, row) => {
            acc.orders += row.orders
            acc.sum += row.sum
            acc.total_amount += row.total_amount
            STATUS_ORDER.forEach(key => {
                const src = row.states[key] ?? emptyStateStats()
                const dst = acc.states[key]
                dst.count += src.count
                dst.total_amount += src.total_amount
                dst.paid_amount += src.paid_amount
                dst.balance += src.balance
            })
            return acc
        },
        {
            orders: 0,
            sum: 0,
            total_amount: 0,
            states: {
                PAID: emptyStateStats(),
                PARTIAL: emptyStateStats(),
                UNPAID: emptyStateStats(),
            } as Record<PaymentState, StateStats>,
        }
    )

    return (
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
            <h1 className="text-2xl mb-4">To'lovlar statistikasi</h1>
            <div className="flex flex-wrap gap-2 mb-4">
                {GRAN_OPTIONS.map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setGran(opt.key)}
                        className={`px-3 py-1 rounded border transition ${gran === opt.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

            <div className="overflow-x-auto rounded-2xl shadow">
                <table className="min-w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 text-left">
                            <th className="px-3 py-2">Davr</th>
                            <th className="px-3 py-2">Buyurtmalar</th>
                            <th className="px-3 py-2">Umumiy summa</th>
                            <th className="px-3 py-2">Jami to'langan</th>
                            {STATUS_ORDER.map(state => (
                                <th key={state} className="px-3 py-2">
                                    {STATUS_LABELS[state]}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4 + STATUS_ORDER.length} className="px-3 py-6 text-center text-gray-500">
                                    Yuklanmoqda...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={4 + STATUS_ORDER.length} className="px-3 py-6 text-center text-gray-500">
                                    Ma'lumot topilmadi
                                </td>
                            </tr>
                        ) : (
                            rows.map(row => (
                                <tr key={row.bucket} className="border-b">
                                    <td className="px-3 py-2 align-top font-medium">{row.bucket || '-'}</td>
                                    <td className="px-3 py-2 align-top">{row.orders}</td>
                                    <td className="px-3 py-2 align-top">{formatCurrency(row.total_amount)}</td>
                                    <td className="px-3 py-2 align-top text-green-700">{formatCurrency(row.sum)}</td>
                                    {STATUS_ORDER.map(state => {
                                        const stats = row.states[state] ?? emptyStateStats()
                                        return (
                                            <td key={state} className="px-3 py-2 align-top">
                                                <div className="font-medium">{stats.count} ta</div>
                                                <div className="text-xs text-gray-500">
                                                    Umumiy: {formatCurrency(stats.total_amount)}
                                                </div>
                                                <div className="text-xs text-emerald-600">
                                                    To'langan: {formatCurrency(stats.paid_amount)}
                                                </div>
                                                {stats.balance > 0 ? (
                                                    <div className="text-xs text-red-600">
                                                        Qoldiq: {formatCurrency(stats.balance)}
                                                    </div>
                                                ) : null}
                                            </td>
                                        )
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                    {rows.length > 0 && !loading && (
                        <tfoot>
                            <tr className="bg-gray-100 font-semibold">
                                <td className="px-3 py-2">Jami</td>
                                <td className="px-3 py-2">{totals.orders}</td>
                                <td className="px-3 py-2">{formatCurrency(totals.total_amount)}</td>
                                <td className="px-3 py-2">{formatCurrency(totals.sum)}</td>
                                {STATUS_ORDER.map(state => {
                                    const stats = totals.states[state]
                                    return (
                                        <td key={state} className="px-3 py-2">
                                            <div>{stats.count} ta</div>
                                            <div className="text-xs text-gray-500">
                                                Umumiy: {formatCurrency(stats.total_amount)}
                                            </div>
                                            <div className="text-xs text-emerald-600">
                                                To'langan: {formatCurrency(stats.paid_amount)}
                                            </div>
                                            {stats.balance > 0 ? (
                                                <div className="text-xs text-red-600">
                                                    Qoldiq: {formatCurrency(stats.balance)}
                                                </div>
                                            ) : null}
                                        </td>
                                    )
                                })}
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    )
}
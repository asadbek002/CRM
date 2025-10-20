// frontend/src/pages/Orders.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import PaymentStateSelect from '../components/PaymentStateSelect'

type PaymentState = 'UNPAID' | 'PARTIAL' | 'PAID'

type Row = {
    id: number
    client_name: string
    client_phone: string
    created_at: string
    payment_status: string
    payment_state?: PaymentState
    customer_type: string
    doc_type: string
    country: string
    branch: string
    manager: string
    deadline: string
    total_amount: number
    paid_sum: number
    balance: number
    payment_method: string
    status: string
}

const METHODS = ['naqd', 'plastik', 'bank', 'e9pay', 'tbank', 'other'] as const
type Method = typeof METHODS[number]

const todayStr = () => new Date().toISOString().slice(0, 10)

export default function Orders() {
    const [rows, setRows] = useState<Row[]>([])
    const [editPaid, setEditPaid] = useState<Record<number, number>>({})
    const [saving, setSaving] = useState<Record<number, boolean>>({})
    const [editMethod, setEditMethod] = useState<Record<number, Method>>({})
    // Yaratilgan sana bo‘yicha filter; '' => hammasi
    const [dateFilter, setDateFilter] = useState<string>('')

    const normalizeState = (row: Row): PaymentState => {
        const state = row.payment_state
        if (state === 'UNPAID' || state === 'PARTIAL' || state === 'PAID') return state
        const txt = row.payment_status?.toLowerCase?.() ?? ''
        if (txt.includes("to'liq") || txt.includes("to'landi") || txt.includes('tolandi') || txt.includes('paid')) {
            return 'PAID'
        }
        if (txt.includes('qisman') || txt.includes('partial')) {
            return 'PARTIAL'
        }
        return 'UNPAID'
    }

    const parseAmount = (s: string) => {
        const cleaned = s.replace(/\s/g, '').replace(/,/g, '')
        const n = Number(cleaned)
        return isNaN(n) ? 0 : n
    }

    const setPaidInput = (id: number, val: string) => {
        setEditPaid(prev => ({ ...prev, [id]: parseAmount(val) }))
    }

    const setMethodInput = (id: number, val: Method) => {
        setEditMethod(prev => ({ ...prev, [id]: val }))
    }

    const delOrder = async (id: number) => {
        if (!confirm('O‘chirishni tasdiqlaysizmi?')) return
        await api.delete(`/orders/${id}`)
        await load()
    }

    const savePayment = async (row: Row) => {
        const add = editPaid[row.id] || 0
        if (add <= 0) return
        const method: Method = editMethod[row.id] || (row.payment_method as Method) || 'naqd'
        setSaving(s => ({ ...s, [row.id]: true }))
        try {
            await api.post(`/payments/${row.id}`, { amount: add, method, note: 'jadvaldan kiritildi' })
            setEditPaid(p => {
                const copy = { ...p }
                delete copy[row.id]
                return copy
            })
            await load()
        } finally {
            setSaving(s => ({ ...s, [row.id]: false }))
        }
    }

    const load = async () => {
        if (!dateFilter) {
            const r = await api.get('/orders')
            setRows(r.data?.rows || [])
            return
        }
        const r = await api.get('/orders/by-date', {
            params: { date: dateFilter, mode: 'created' },
        })
        // MUHIM: mapping yo‘q — serverdan kelgan maydonlarni o‘zgartirmay qo‘yamiz
        setRows(r.data?.rows || [])
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFilter])

    return (
        <div className="mx-auto w-full max-w-[1600px] px-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-semibold">Buyurtmalar</h2>

                {/* KALENDAR — yaratilgan sana bo‘yicha filter */}
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <svg
                            className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                            className="border rounded px-3 py-2 pl-9"
                            placeholder="YYYY-MM-DD"
                            title="Yaratilgan sana bo‘yicha filtrlash"
                            max={todayStr()}
                        />
                    </div>
                    {dateFilter && (
                        <button className="border rounded px-2 py-2" onClick={() => setDateFilter('')}>
                            Hammasi
                        </button>
                    )}
                    <Link to="/orders/new">
                        <button className="btn">+ Buyurtma</button>
                    </Link>
                </div>
            </div>

            <div className="overflow-x-auto rounded-2xl shadow">
                <table className="orders-table min-w-[1200px] w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="px-4 py-3 text-left">Mijoz ismi</th>
                            <th className="px-4 py-3 text-left">Tel raqam</th>
                            <th className="px-4 py-3 text-left">Sana</th>
                            <th className="px-4 py-3 text-left">To‘lov holati</th>
                            <th className="px-4 py-3 text-left">Mijoz turi</th>
                            <th className="px-4 py-3 text-left">Hujjat turi</th>
                            <th className="px-4 py-3 text-left">Davlat</th>
                            <th className="px-4 py-3 text-left">Filial</th>
                            <th className="px-4 py-3 text-left">Hodim</th>
                            <th className="px-4 py-3 text-left">Deadline</th>
                            <th className="px-4 py-3 text-right">Umumiy</th>
                            <th className="px-4 py-3 text-right">To‘landi</th>
                            <th className="px-4 py-3 text-right">Qoldiq</th>
                            <th className="px-4 py-3 text-left">To‘lov turi</th>
                            <th className="px-4 py-3 text-left">Hujjatlar</th>
                            <th className="px-4 py-3 text-left">Amal</th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map(r => {
                            const pending = editPaid[r.id] || 0
                            const liveBalance = (r.total_amount || 0) - (r.paid_sum || 0) - pending
                            const selectedMethod: Method = editMethod[r.id] || (r.payment_method as Method) || 'naqd'

                            return (
                                <tr key={r.id} className="border-t">
                                    <td className="px-4 py-3">{r.client_name}</td>
                                    <td className="px-4 py-3">{r.client_phone}</td>
                                    <td className="px-4 py-3">{r.created_at}</td>

                                    <td className="px-4 py-3">
                                        <PaymentStateSelect
                                            orderId={r.id}
                                            initial={normalizeState(r)}
                                            onUpdated={load}
                                        />
                                    </td>

                                    <td className="px-4 py-3">{r.customer_type || '-'}</td>
                                    <td className="px-4 py-3">{r.doc_type}</td>
                                    <td className="px-4 py-3">{r.country}</td>
                                    <td className="px-4 py-3">{r.branch || '-'}</td>
                                    <td className="px-4 py-3">{r.manager || '-'}</td>
                                    <td className="px-4 py-3">{r.deadline || '-'}</td>

                                    <td className="px-4 py-3 text-right">{r.total_amount?.toLocaleString()}</td>

                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            <span>{(r.paid_sum || 0).toLocaleString()}</span>
                                            <input
                                                className="border rounded px-2 py-1 w-28 text-right"
                                                placeholder="+ summa"
                                                value={pending ? pending : ''}
                                                onChange={e => setPaidInput(r.id, e.target.value)}
                                            />
                                            <button
                                                className="border rounded px-3 py-1 disabled:opacity-50"
                                                disabled={saving[r.id] || !pending}
                                                onClick={() => savePayment(r)}
                                            >
                                                Saqlash
                                            </button>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3 text-right">{liveBalance.toLocaleString()}</td>

                                    <td className="px-4 py-3">
                                        <select
                                            className="border rounded px-2 py-1"
                                            value={selectedMethod}
                                            onChange={e => setMethodInput(r.id, e.target.value as Method)}
                                        >
                                            {METHODS.map(m => (
                                                <option key={m} value={m}>
                                                    {m}
                                                </option>
                                            ))}
                                        </select>
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className="flex gap-3">
                                            <Link to={`/orders/${r.id}/upload`} className="underline">
                                                Fayl
                                            </Link>
                                            <Link to={`/orders/${r.id}/verify`} className="underline text-blue-600">
                                                Tasdiqlash (QR)
                                            </Link>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3">
                                        <button className="underline text-red-600" onClick={() => delOrder(r.id)}>
                                            O‘chirish
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// frontend/src/pages/Orders.tsx
import { useEffect, useState } from 'react'
import api from '../api'
import { Link } from 'react-router-dom'

type Row = {
    id: number
    client_name: string
    client_phone: string
    created_at: string
    payment_status: string
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

export default function Orders() {
    const [rows, setRows] = useState<Row[]>([])
    // har bir order uchun kiritilayotgan yangi to‘lov
    const [editPaid, setEditPaid] = useState<Record<number, number>>({})
    const [saving, setSaving] = useState<Record<number, boolean>>({})

    const load = async () => {
        const r = await api.get('/orders')
        setRows(r.data.rows || [])
    }

    useEffect(() => {
        load()
    }, [])

    // sonni normalizatsiya (foydalanuvchi 100 000 deb yozsa ham qabul qilamiz)
    const parseAmount = (s: string) => {
        const cleaned = s.replace(/\s/g, '').replace(/,/g, '')
        const n = Number(cleaned)
        return isNaN(n) ? 0 : n
    }

    const setPaidInput = (id: number, val: string) => {
        setEditPaid(prev => ({ ...prev, [id]: parseAmount(val) }))
    }

    const savePayment = async (row: Row) => {
        const add = editPaid[row.id] || 0
        if (add <= 0) return

        setSaving(s => ({ ...s, [row.id]: true }))
        try {
            await api.post(`/payments/${row.id}`, {
                amount: add,
                method: row.payment_method || 'naqd',
                note: 'jadvaldan kiritildi',
            })
            // inputni tozalaymiz va ro‘yxatni yangilaymiz
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

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Buyurtmalar</h2>
                <Link to="/orders/new"><button>+ Buyurtma</button></Link>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full bg-white rounded-xl text-[15px]">
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
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map(r => {
                            const pending = editPaid[r.id] || 0
                            // UI’da jonli hisob: eski qoldiqdan emas, total - (oldin to'langan + yangi kiritilgan)
                            const liveBalance = (r.total_amount || 0) - (r.paid_sum || 0) - pending

                            return (
                                <tr key={r.id} className="border-t">
                                    <td className="px-4 py-3">{r.client_name}</td>
                                    <td className="px-4 py-3">{r.client_phone}</td>
                                    <td className="px-4 py-3">{r.created_at}</td>
                                    <td className="px-4 py-3">{r.payment_status}</td>
                                    <td className="px-4 py-3">{r.customer_type || '-'}</td>
                                    <td className="px-4 py-3">{r.doc_type}</td>
                                    <td className="px-4 py-3">{r.country}</td>
                                    <td className="px-4 py-3">{r.branch || '-'}</td>
                                    <td className="px-4 py-3">{r.manager || '-'}</td>
                                    <td className="px-4 py-3">{r.deadline || '-'}</td>

                                    <td className="px-4 py-3 text-right">
                                        {r.total_amount?.toLocaleString()}
                                    </td>

                                    {/* To‘landi: mavjud + input (yangi qo‘shiladigan) */}
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
                                                disabled={saving[r.id] || !pending}
                                                onClick={() => savePayment(r)}
                                                className="disabled:opacity-50"
                                            >
                                                Saqlash
                                            </button>
                                        </div>
                                    </td>

                                    {/* Qoldiq: liveBalance ko‘rsatiladi */}
                                    <td className="px-4 py-3 text-right">
                                        {liveBalance.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-3">
                                            <Link to={`/orders/${r.id}/upload`} className="underline">Fayl</Link>
                                            <Link to={`/orders/${r.id}/verify`} className="underline text-blue-600">Tasdiqlash (QR)</Link>
                                        </div>
                                    </td>


                                    <td className="px-4 py-3">{r.payment_method || '-'}</td>
                                    <td className="px-4 py-3">
                                        <Link to={`/orders/${r.id}/upload`} className="underline">
                                            Fayl
                                        </Link>
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

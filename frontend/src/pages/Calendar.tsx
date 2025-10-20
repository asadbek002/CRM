import { useState, useEffect } from 'react'
import api from '../api'

type Row = {
    id: number
    client_name: string
    client_phone: string
    created_at: string | null
    deadline: string | null
    total_amount: number
    paid_sum: number
    balance: number
    status: string
}

export default function CalendarPage() {
    const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
    const [rows, setRows] = useState<Row[]>([])

    useEffect(() => {
        (async () => {
            const r = await api.get('/orders/by-date', { params: { date, mode: 'deadline' } })
            setRows(r.data.rows || [])
        })()
    }, [date])

    return (
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
            <h1 className="text-2xl mb-4">Kalendar — kunlik buyurtmalar</h1>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border px-3 py-2 rounded" />
            <div className="mt-4 overflow-x-auto rounded-2xl shadow">
                <table className="min-w-full text-sm">
                    <thead><tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2">ID</th>
                        <th className="px-3 py-2">Mijoz</th>
                        <th className="px-3 py-2">Tel</th>
                        <th className="px-3 py-2">Deadline</th>
                        <th className="px-3 py-2">Summa</th>
                        <th className="px-3 py-2">To'langan</th>
                        <th className="px-3 py-2">Qoldiq</th>
                        <th className="px-3 py-2">Holat</th>
                    </tr></thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.id} className="border-b">
                                <td className="px-3 py-2">{r.id}</td>
                                <td className="px-3 py-2">{r.client_name}</td>
                                <td className="px-3 py-2">{r.client_phone}</td>
                                <td className="px-3 py-2">{r.deadline}</td>
                                <td className="px-3 py-2">{r.total_amount?.toLocaleString?.() ?? r.total_amount}</td>
                                <td className="px-3 py-2">{r.paid_sum?.toLocaleString?.() ?? r.paid_sum}</td>
                                <td className="px-3 py-2">{r.balance?.toLocaleString?.() ?? r.balance}</td>
                                <td className="px-3 py-2">{r.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

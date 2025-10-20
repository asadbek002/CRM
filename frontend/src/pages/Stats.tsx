import { useState, useEffect } from 'react'
import api from '../api'

type Point = { bucket: string, sum: number }

export default function StatsPage() {
    const [gran, setGran] = useState<'daily' | 'weekly' | 'monthly'>('daily')
    const [rows, setRows] = useState<Point[]>([])

    useEffect(() => {
        (async () => {
            const r = await api.get('/orders/stats/payments', { params: { granularity: gran } })
            setRows(r.data.rows || [])
        })()
    }, [gran])

    return (
        <div className="mx-auto w-full max-w-[1600px] px-4 py-6">
            <h1 className="text-2xl mb-4">To'lovlar statistikasi</h1>
            <div className="space-x-2 mb-4">
                <button onClick={() => setGran('daily')} className="border px-3 py-1 rounded">Kunlik</button>
                <button onClick={() => setGran('weekly')} className="border px-3 py-1 rounded">Haftalik</button>
                <button onClick={() => setGran('monthly')} className="border px-3 py-1 rounded">Oylik</button>
            </div>
            <div className="overflow-x-auto rounded-2xl shadow">
                <table className="min-w-full text-sm">
                    <thead><tr className="bg-gray-50 text-left"><th className="px-3 py-2">Bucket</th><th className="px-3 py-2">Sum</th></tr></thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.bucket} className="border-b">
                                <td className="px-3 py-2">{r.bucket}</td>
                                <td className="px-3 py-2">{r.sum?.toLocaleString?.() ?? r.sum}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

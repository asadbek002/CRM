import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    fetchDashboardActivity,
    fetchDashboardFilters,
    fetchDashboardSummary,
    fetchDashboardTimeline,
    fetchDashboardTop,
    DashboardFiltersState,
} from '../api'

const formatNumber = (value: number | undefined) =>
    (value ?? 0).toLocaleString('uz-UZ')

const formatCurrency = (value: number | undefined) =>
    `${(value ?? 0).toLocaleString('uz-UZ')} so'm`

export default function Dashboard() {
    const [dateFrom, setDateFrom] = useState<string>('')
    const [dateTo, setDateTo] = useState<string>('')
    const [branchId, setBranchId] = useState<string>('')
    const [managerId, setManagerId] = useState<string>('')
    const [customerType, setCustomerType] = useState<string>('')
    const [docType, setDocType] = useState<string>('')
    const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

    const filtersPayload: DashboardFiltersState = useMemo(
        () => ({
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            branch_id: branchId ? Number(branchId) : undefined,
            manager_id: managerId ? Number(managerId) : undefined,
            customer_type: customerType || undefined,
            doc_type: docType || undefined,
        }),
        [dateFrom, dateTo, branchId, managerId, customerType, docType]
    )

    const summaryQuery = useQuery({
        queryKey: ['dashboard-summary', filtersPayload],
        queryFn: () => fetchDashboardSummary(filtersPayload),
    })

    const timelineQuery = useQuery({
        queryKey: ['dashboard-timeline', filtersPayload, groupBy],
        queryFn: () => fetchDashboardTimeline({ ...filtersPayload, group_by: groupBy }),
    })

    const topQuery = useQuery({
        queryKey: ['dashboard-top', filtersPayload],
        queryFn: () => fetchDashboardTop(filtersPayload),
    })

    const activityQuery = useQuery({
        queryKey: ['dashboard-activity'],
        queryFn: fetchDashboardActivity,
    })

    const filterOptionsQuery = useQuery({
        queryKey: ['dashboard-filters'],
        queryFn: fetchDashboardFilters,
    })

    const summary = summaryQuery.data
    const timeline = timelineQuery.data ?? []
    const top = topQuery.data
    const activity = activityQuery.data ?? []
    const filterOptions = filterOptionsQuery.data

    const maxOrders = Math.max(...timeline.map(item => item.orders), 1)
    const maxPayments = Math.max(...timeline.map(item => item.payments), 1)
    const maxTopValue = Math.max(...(top?.doc_types.map(item => item.value) ?? [1]))

    return (
        <div className="space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold">Boshqaruv paneli</h1>
                    <p className="text-gray-500 text-sm">Buyurtmalar, to'lovlar va xodimlar faoliyati bo'yicha umumiy ko'rinish</p>
                </div>
            </header>

            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryCard title="Jami buyurtmalar" value={summary?.orders_total} loading={summaryQuery.isLoading} />
                <SummaryCard title="Jarayondagi buyurtmalar" value={summary?.orders_in_progress} loading={summaryQuery.isLoading} />
                <SummaryCard title="Yakunlangan buyurtmalar" value={summary?.orders_completed} loading={summaryQuery.isLoading} />
                <SummaryCard title="Muddatdan o'tgan" value={summary?.orders_overdue} loading={summaryQuery.isLoading} emphasis />
            </section>

            <section className="grid gap-4 md:grid-cols-2">
                <SummaryMetric
                    title="Davr uchun to'lovlar"
                    value={formatCurrency(summary?.payments_sum)}
                    loading={summaryQuery.isLoading}
                />
                <SummaryMetric
                    title="Jami qarzdorlik"
                    value={formatCurrency(summary?.payments_debt)}
                    loading={summaryQuery.isLoading}
                    emphasis
                />
            </section>

            <section className="bg-gray-50 border rounded-xl p-4">
                <h2 className="text-lg font-semibold mb-3">Filtrlar</h2>
                <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                    <div className="flex flex-col gap-1">
                        <label className="text-gray-500">Boshlanish sanasi</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="border rounded-lg px-3 py-2 bg-white"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-gray-500">Tugash sanasi</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="border rounded-lg px-3 py-2 bg-white"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-gray-500">Filial</label>
                        <select
                            value={branchId}
                            onChange={e => setBranchId(e.target.value)}
                            className="border rounded-lg px-3 py-2 bg-white"
                        >
                            <option value="">Barchasi</option>
                            {filterOptions?.branches.map(branch => (
                                <option key={branch.id} value={branch.id}>{branch.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-gray-500">Mas'ul xodim</label>
                        <select
                            value={managerId}
                            onChange={e => setManagerId(e.target.value)}
                            className="border rounded-lg px-3 py-2 bg-white"
                        >
                            <option value="">Barchasi</option>
                            {filterOptions?.managers.map(manager => (
                                <option key={manager.id} value={manager.id}>{manager.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-gray-500">Hizmat turi</label>
                        <select
                            value={customerType}
                            onChange={e => setCustomerType(e.target.value)}
                            className="border rounded-lg px-3 py-2 bg-white"
                        >
                            <option value="">Barchasi</option>
                            {filterOptions?.customer_types.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-gray-500">Hujjat turi</label>
                        <select
                            value={docType}
                            onChange={e => setDocType(e.target.value)}
                            className="border rounded-lg px-3 py-2 bg-white"
                        >
                            <option value="">Barchasi</option>
                            {filterOptions?.doc_types.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                    <span className="text-gray-500">Grafik bo'linishi:</span>
                    <button
                        onClick={() => setGroupBy('day')}
                        className={`px-3 py-1 rounded-full border transition ${groupBy === 'day' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'}`}
                    >
                        Kun
                    </button>
                    <button
                        onClick={() => setGroupBy('week')}
                        className={`px-3 py-1 rounded-full border transition ${groupBy === 'week' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'}`}
                    >
                        Hafta
                    </button>
                    <button
                        onClick={() => setGroupBy('month')}
                        className={`px-3 py-1 rounded-full border transition ${groupBy === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-100'}`}
                    >
                        Oy
                    </button>
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <div className="border rounded-xl p-4 bg-white shadow-sm">
                    <h2 className="font-semibold mb-3">Buyurtmalar va to'lovlar dinamikasi</h2>
                    {timelineQuery.isLoading ? (
                        <div className="text-sm text-gray-500">Yuklanmoqda...</div>
                    ) : timeline.length === 0 ? (
                        <div className="text-sm text-gray-500">Ma'lumot mavjud emas</div>
                    ) : (
                        <div className="space-y-2">
                            {timeline.map(item => (
                                <div key={item.bucket} className="space-y-1">
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>{item.bucket}</span>
                                        <span>{formatNumber(item.orders)} / {formatCurrency(item.payments)}</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded overflow-hidden flex">
                                        <div
                                            className="bg-blue-500"
                                            style={{ width: `${(item.orders / maxOrders) * 100}%` }}
                                            title={`Buyurtmalar: ${item.orders}`}
                                        />
                                        <div
                                            className="bg-emerald-400"
                                            style={{ width: `${(item.payments / maxPayments) * 100}%` }}
                                            title={`To'lovlar: ${formatCurrency(item.payments)}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border rounded-xl p-4 bg-white shadow-sm">
                    <h2 className="font-semibold mb-3">Eng talabgir hujjat turlari</h2>
                    {topQuery.isLoading ? (
                        <div className="text-sm text-gray-500">Yuklanmoqda...</div>
                    ) : top && top.doc_types.length > 0 ? (
                        <div className="space-y-3">
                            {top.doc_types.map(item => (
                                <div key={item.label}>
                                    <div className="flex justify-between text-xs text-gray-500">
                                        <span>{item.label}</span>
                                        <span>{item.value}</span>
                                    </div>
                                    <div className="h-2 bg-gray-200 rounded">
                                        <div
                                            className="h-full bg-purple-500 rounded"
                                            style={{ width: `${(item.value / maxTopValue) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-gray-500">Ma'lumot mavjud emas</div>
                    )}
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                <div className="border rounded-xl p-4 bg-white shadow-sm">
                    <h2 className="font-semibold mb-3">Faoliyat logi</h2>
                    {activityQuery.isLoading ? (
                        <div className="text-sm text-gray-500">Yuklanmoqda...</div>
                    ) : activity.length === 0 ? (
                        <div className="text-sm text-gray-500">So'ngi faoliyat topilmadi</div>
                    ) : (
                        <ul className="space-y-2 text-sm">
                            {activity.map(item => (
                                <li key={item.id} className="border-b pb-2 last:border-0">
                                    <div className="font-medium text-gray-700">{item.user_name || "Noma'lum foydalanuvchi"}</div>
                                    <div className="text-gray-600">{item.action}</div>
                                    {item.details && <div className="text-xs text-gray-500">{item.details}</div>}
                                    <div className="text-xs text-gray-400">{new Date(item.created_at).toLocaleString()}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="border rounded-xl p-4 bg-white shadow-sm">
                    <h2 className="font-semibold mb-3">Fayllar holati</h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border p-3 bg-white">
                            <div className="text-gray-500">Tekshiruvni kutmoqda</div>
                            <div className="text-2xl font-semibold">{formatNumber(summary?.files_pending)}</div>
                        </div>
                        <div className="rounded-lg border p-3 bg-white">
                            <div className="text-gray-500">Rad etilgan</div>
                            <div className="text-2xl font-semibold">{formatNumber(summary?.files_rejected)}</div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

function SummaryCard({ title, value, loading, emphasis }: { title: string; value?: number; loading?: boolean; emphasis?: boolean }) {
    return (
        <div className={`rounded-xl border p-4 ${emphasis ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
            <div className="text-xs uppercase tracking-wide text-gray-500">{title}</div>
            <div className={`text-3xl font-semibold mt-2 ${emphasis ? 'text-red-600' : 'text-gray-900'}`}>
                {loading ? '...' : formatNumber(value)}
            </div>
        </div>
    )
}

function SummaryMetric({ title, value, loading, emphasis }: { title: string; value: string; loading?: boolean; emphasis?: boolean }) {
    return (
        <div className={`rounded-xl border p-4 ${emphasis ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
            <div className="text-xs uppercase tracking-wide text-gray-500">{title}</div>
            <div className={`text-2xl font-semibold mt-2 ${emphasis ? 'text-yellow-700' : 'text-gray-900'}`}>
                {loading ? '...' : value}
            </div>
        </div>
    )
}

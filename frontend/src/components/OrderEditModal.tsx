import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api'

type Summary = {
    id: number
    client_name?: string
    payment_state?: string
    payment_method?: string
    total_amount?: number
    customer_type?: string
}

type FormState = {
    total_amount: string
    payment_state: string
    payment_method: string
    deadline: string
    doc_type: string
    customer_type: string
    country: string
    notes: string
}

const PAYMENT_STATE_OPTIONS = [
    { value: '', label: '— Tanlanmagan —' },
    { value: 'UNPAID', label: "To'lanmagan" },
    { value: 'PARTIAL', label: "Qisman to'langan" },
    { value: 'PAID', label: "To'liq to'langan" },
]

const CUSTOMER_OPTIONS = [
    { value: '', label: '— Tanlanmagan —' },
    { value: 'office', label: 'Office' },
    { value: 'sns', label: 'SNS' },
    { value: 'consulting', label: 'Consulting' },
]

const PAYMENT_METHODS = ['', 'naqd', 'terminal', "o`tkazma", 'payme', 'bank']

const createEmptyForm = (): FormState => ({
    total_amount: '',
    payment_state: '',
    payment_method: '',
    deadline: '',
    doc_type: '',
    customer_type: '',
    country: '',
    notes: '',
})

type Props = {
    orderId: number | null
    open: boolean
    onClose: () => void
    onSaved: () => void | Promise<void>
    summary?: Summary | null
}

export default function OrderEditModal({ orderId, open, onClose, onSaved, summary }: Props) {
    const [form, setForm] = useState<FormState>(() => createEmptyForm())
    const [initialForm, setInitialForm] = useState<FormState | null>(null)
    const [clientName, setClientName] = useState<string>('')
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const summaryName = summary?.client_name ?? ''

    const resetState = useCallback(() => {
        setForm(createEmptyForm())
        setInitialForm(null)
        setClientName('')
        setError(null)
        setLoading(false)
        setSaving(false)
    }, [])

    useEffect(() => {
        if (!open) {
            resetState()
            return
        }

        setClientName(summaryName)
        if (summary && !initialForm) {
            setForm(prev => ({
                ...prev,
                total_amount:
                    typeof summary.total_amount === 'number'
                        ? String(summary.total_amount)
                        : prev.total_amount,
                payment_state: summary.payment_state ?? prev.payment_state,
                payment_method: summary.payment_method ?? prev.payment_method,
                customer_type: summary.customer_type ?? prev.customer_type,
            }))
        }
    }, [open, summary, summaryName, initialForm, resetState])

    const loadOrder = useCallback(async () => {
        if (!open || !orderId) return
        setLoading(true)
        setError(null)
        try {
            const { data } = await api.get(`/orders/${orderId}`)
            const next: FormState = {
                total_amount:
                    typeof data.total_amount === 'number' && !Number.isNaN(data.total_amount)
                        ? String(data.total_amount)
                        : '',
                payment_state: data.payment_state ?? '',
                payment_method: data.payment_method ?? '',
                deadline: data.deadline ?? '',
                doc_type: data.doc_type ?? '',
                customer_type: data.customer_type ?? '',
                country: data.country ?? '',
                notes: data.notes ?? '',
            }
            setForm(next)
            setInitialForm(next)
            setClientName(data.client_name ?? summaryName)
        } catch (err: any) {
            const detail = err?.response?.data?.detail
            setError(typeof detail === 'string' ? detail : 'Buyurtma maʼlumotlarini yuklab boʻlmadi')
        } finally {
            setLoading(false)
        }
    }, [open, orderId, summaryName])

    useEffect(() => {
        if (open && orderId) {
            loadOrder()
        }
    }, [open, orderId, loadOrder])

    const updateField = useCallback(<K extends keyof FormState>(field: K, value: FormState[K]) => {
        setForm(prev => ({ ...prev, [field]: value }))
    }, [])

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!orderId || loading) return

        const payload: Record<string, any> = {}
        setError(null)
        setSaving(true)

        const base = initialForm || createEmptyForm()

        if (form.total_amount !== base.total_amount) {
            if (form.total_amount.trim() === '') {
                payload.total_amount = 0
            } else {
                const numeric = Number(form.total_amount)
                if (Number.isNaN(numeric)) {
                    setError('Umumiy summa noto‘g‘ri kiritildi')
                    setSaving(false)
                    return
                }
                payload.total_amount = numeric
            }
        }

        if (form.payment_state !== base.payment_state) {
            payload.payment_state = form.payment_state || null
        }

        if (form.payment_method !== base.payment_method) {
            payload.payment_method = form.payment_method || null
        }

        if (form.deadline !== base.deadline) {
            payload.deadline = form.deadline || null
        }

        if (form.doc_type !== base.doc_type) {
            payload.doc_type = form.doc_type.trim() || null
        }

        if (form.customer_type !== base.customer_type) {
            payload.customer_type = form.customer_type || null
        }

        if (form.country !== base.country) {
            payload.country = form.country.trim() || null
        }

        if (form.notes !== base.notes) {
            payload.notes = form.notes
        }

        if (Object.keys(payload).length === 0) {
            setSaving(false)
            onClose()
            return
        }

        try {
            await api.patch(`/orders/${orderId}`, payload)
            await Promise.resolve(onSaved())
            onClose()
        } catch (err: any) {
            const detail = err?.response?.data?.detail
            setError(typeof detail === 'string' ? detail : 'Maʼlumotlarni saqlab boʻlmadi')
        } finally {
            setSaving(false)
        }
    }

    const title = useMemo(() => {
        if (!orderId) return 'Buyurtma'
        return `Buyurtma #${orderId}`
    }, [orderId])

    if (!open || !orderId) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl">
                <div className="flex flex-col gap-1 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
                        <p className="text-sm text-gray-500">{clientName || '—'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="self-start rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
                    >
                        Yopish
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-5">
                    {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

                    {loading ? (
                        <div className="py-8 text-center text-sm text-gray-500">Maʼlumotlar yuklanmoqda...</div>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-1 text-sm">
                                    <span className="block font-medium text-gray-700">Umumiy summa</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.total_amount}
                                        onChange={e => updateField('total_amount', e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>

                                <label className="space-y-1 text-sm">
                                    <span className="block font-medium text-gray-700">To‘lov holati</span>
                                    <select
                                        value={form.payment_state}
                                        onChange={e => updateField('payment_state', e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {PAYMENT_STATE_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1 text-sm">
                                    <span className="block font-medium text-gray-700">To‘lov turi</span>
                                    <select
                                        value={form.payment_method}
                                        onChange={e => updateField('payment_method', e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {PAYMENT_METHODS.map(option => (
                                            <option key={option || 'none'} value={option}>
                                                {option ? option : '— Tanlanmagan —'}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1 text-sm">
                                    <span className="block font-medium text-gray-700">Deadline</span>
                                    <input
                                        type="date"
                                        value={form.deadline}
                                        onChange={e => updateField('deadline', e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </label>

                                <label className="space-y-1 text-sm md:col-span-2">
                                    <span className="block font-medium text-gray-700">Hujjat turi</span>
                                    <input
                                        value={form.doc_type}
                                        onChange={e => updateField('doc_type', e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Masalan: Diplom tarjimasi"
                                    />
                                </label>

                                <label className="space-y-1 text-sm">
                                    <span className="block font-medium text-gray-700">Mijoz turi</span>
                                    <select
                                        value={form.customer_type}
                                        onChange={e => updateField('customer_type', e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        {CUSTOMER_OPTIONS.map(option => (
                                            <option key={option.value || 'none'} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1 text-sm">
                                    <span className="block font-medium text-gray-700">Davlat</span>
                                    <input
                                        value={form.country}
                                        onChange={e => updateField('country', e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Masalan: AQSh"
                                    />
                                </label>
                            </div>

                            <label className="block space-y-1 text-sm">
                                <span className="block font-medium text-gray-700">Izoh</span>
                                <textarea
                                    value={form.notes}
                                    onChange={e => updateField('notes', e.target.value)}
                                    rows={4}
                                    className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Qoʻshimcha maʼlumot"
                                />
                            </label>
                        </>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                        >
                            Bekor qilish
                        </button>
                        <button
                            type="submit"
                            disabled={saving || loading}
                            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}


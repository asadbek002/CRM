// frontend/src/pages/NewOrder.tsx
import React, { useState, FormEvent } from 'react'
import api from '../api'
import { useNavigate, Link } from 'react-router-dom'

type Staff = { id: number; full_name: string }

// faqat shu ikki hodimni tanlash
const staffList: Staff[] = [
    { id: 2, full_name: 'Shukrullo' },
    { id: 3, full_name: 'Olimjon' },
]

type CustomerType = 'office' | 'sns' | 'consulting'
type PayMethod = 'naqd' | 'plastik' | 'payme' | 'terminal'

export default function NewOrder() {
    const nav = useNavigate()

    const [clientName, setClientName] = useState('')
    const [clientPhone, setClientPhone] = useState('')

    const [customerType, setCustomerType] = useState<CustomerType>('office')
    const [docType, setDocType] = useState('')
    const [country, setCountry] = useState('')
    const [branchId, setBranchId] = useState<number | ''>('') // 1=Namangan, 2=Toshkent
    const [deadline, setDeadline] = useState('')
    const [total, setTotal] = useState<number>(0)
    const [payMethod, setPayMethod] = useState<PayMethod>('naqd')

    // hodim tanlash
    const [staffId, setStaffId] = useState<number | ''>('')

    const [saving, setSaving] = useState(false)

    async function onSubmit(e: FormEvent) {
        e.preventDefault()
        if (saving) return

        if (!clientName.trim()) return alert('Mijoz ismini kiriting')
        if (!clientPhone.trim()) return alert('Telefon raqam kiriting')

        try {
            setSaving(true)

            // 1) Mijozni yaratish
            const c = await api.post('/clients', {
                full_name: clientName.trim(),
                phone: clientPhone.trim(),
            })
            const client_id = Number(c.data.id)

            // 2) Buyurtma yaratish (MUHIM: manager_id!)
            const payload = {
                client_id,
                customer_type: customerType,
                doc_type: docType || null,
                country: country || null,
                branch_id: branchId === '' ? null : Number(branchId),
                payment_method: payMethod,
                deadline: deadline || null,
                total_amount: Number(total) || 0,
                manager_id: staffId === '' ? null : Number(staffId), // ✅ backendga mos nom
            }

            const res = await api.post('/orders', payload)

            // 3) Yuklash sahifasiga o'tish
            nav(`/orders/${res.data.id}/upload`)
        } catch (err: any) {
            console.error(err)
            alert(
                err?.response?.data?.detail ||
                err?.response?.data?.message ||
                'Saqlashda xato yuz berdi'
            )
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="max-w-5xl mx-auto p-4">
            <h1 className="text-2xl font-semibold mb-4">Buyurtma kiritish</h1>

            <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Chap ustun */}
                    <div className="space-y-5">
                        <Field label="Mijoz ismi">
                            <input
                                className="inp"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="Masalan: Ali Valiyev"
                            />
                        </Field>

                        <Field label="Mijoz turi">
                            <select
                                className="inp"
                                value={customerType}
                                onChange={(e) => setCustomerType(e.target.value as CustomerType)}
                            >
                                <option value="office">Offisga keldi</option>
                                <option value="sns">SNS</option>
                                <option value="consulting">Consulting</option>
                            </select>
                        </Field>

                        <Field label="Hujjat turi">
                            <input
                                className="inp"
                                value={docType}
                                onChange={(e) => setDocType(e.target.value)}
                                placeholder="Hujjat turini kiriting"
                            />
                        </Field>

                        <Field label="Filial (Namangan/Toshkent)">
                            <select
                                className="inp"
                                value={branchId === '' ? '' : String(branchId)}
                                onChange={(e) =>
                                    e.target.value === ''
                                        ? setBranchId('')
                                        : setBranchId(Number(e.target.value))
                                }
                            >
                                <option value="">— tanlang —</option>
                                <option value="1">Namangan</option>
                                <option value="2">Toshkent</option>
                            </select>
                        </Field>

                        <Field label="Umumiy to‘lov">
                            <input
                                className="inp text-right"
                                type="number"
                                min={0}
                                value={Number.isNaN(total) ? 0 : total}
                                onChange={(e) => {
                                    const v = e.target.value
                                    setTotal(v === '' ? 0 : Number(v))
                                }}
                                placeholder="0"
                            />
                        </Field>
                    </div>

                    {/* O‘ng ustun */}
                    <div className="space-y-5">
                        <Field label="Telefon raqam">
                            <input
                                className="inp"
                                value={clientPhone}
                                onChange={(e) => setClientPhone(e.target.value)}
                                placeholder="+99890xxxxxxx"
                            />
                        </Field>

                        <Field label="Hodim">
                            <select
                                className="inp"
                                value={staffId === '' ? '' : String(staffId)}
                                onChange={(e) =>
                                    e.target.value === ''
                                        ? setStaffId('')
                                        : setStaffId(Number(e.target.value))
                                }
                            >
                                <option value="">— tanlang —</option>
                                {staffList.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.full_name}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Davlat">
                            <input
                                className="inp"
                                value={country}
                                onChange={(e) => setCountry(e.target.value)}
                                placeholder="Davlat nomini kiriting"
                            />
                        </Field>

                        <Field label="Deadline">
                            <input
                                className="inp"
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                            />
                        </Field>

                        <Field label="To‘lov turi">
                            <select
                                className="inp"
                                value={payMethod}
                                onChange={(e) => setPayMethod(e.target.value as PayMethod)}
                            >
                                <option value="naqd">naqd</option>
                                <option value="plastik">plastik</option>
                                <option value="payme">payme</option>
                                <option value="terminal">terminal</option>
                            </select>
                        </Field>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 mt-8">
                    <Link
                        to="/orders"
                        className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
                    >
                        Bekor qilish
                    </Link>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-60"
                    >
                        {saving ? 'Saqlanmoqda…' : 'Saqlash'}
                    </button>
                </div>
            </form>
        </div>
    )
}

function Field({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <label className="block">
            <div className="mb-1 text-sm text-gray-600">{label}</div>
            {children}
        </label>
    )
}

import { FormEvent, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
    createUser,
    deactivateUser,
    fetchDashboardFilters,
    inviteUser,
    listUsers,
    resetUserPassword,
    updateUser,
    type UserCreatePayload,
    type UserDto,
    type UserUpdatePayload,
} from '../api'

const ROLE_OPTIONS = ['admin', 'manager', 'staff', 'accountant', 'viewer']

const emptyForm: UserCreatePayload = {
    full_name: '',
    email: '',
    phone: '',
    role: 'manager',
    branch_id: undefined,
    password: '',
}

export default function Employees() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('')
    const [branchFilter, setBranchFilter] = useState('')
    const [includeInactive, setIncludeInactive] = useState(false)

    const [showForm, setShowForm] = useState(false)
    const [formState, setFormState] = useState<UserCreatePayload>({ ...emptyForm })
    const [editingUser, setEditingUser] = useState<UserDto | null>(null)
    const [saving, setSaving] = useState(false)

    const filters = useMemo(
        () => ({
            q: search || undefined,
            role: roleFilter || undefined,
            branch_id: branchFilter ? Number(branchFilter) : undefined,
            include_inactive: includeInactive || undefined,
        }),
        [search, roleFilter, branchFilter, includeInactive]
    )

    const usersQuery = useQuery({
        queryKey: ['users', filters],
        queryFn: () => listUsers(filters),
    })

    const filterOptionsQuery = useQuery({
        queryKey: ['dashboard-filters'],
        queryFn: fetchDashboardFilters,
    })

    const users = usersQuery.data ?? []
    const branches = filterOptionsQuery.data?.branches ?? []

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault()
        if (!formState.full_name.trim()) {
            alert("Ism familiya maydoni to'ldirilishi kerak")
            return
        }

        setSaving(true)
        try {
            if (editingUser) {
                const payload: UserUpdatePayload = {
                    full_name: formState.full_name,
                    email: formState.email,
                    phone: formState.phone,
                    role: formState.role,
                    branch_id: formState.branch_id,
                    password: formState.password || undefined,
                }
                await updateUser(editingUser.id, payload)
            } else {
                await createUser(formState)
            }
            await qc.invalidateQueries({ queryKey: ['users'] })
            setShowForm(false)
            setEditingUser(null)
            setFormState({ ...emptyForm })
        } catch (err: any) {
            alert(err?.response?.data?.detail || 'Saqlashda xatolik yuz berdi')
        } finally {
            setSaving(false)
        }
    }

    const onEdit = (user: UserDto) => {
        setEditingUser(user)
        setFormState({
            full_name: user.full_name,
            email: user.email || '',
            phone: user.phone || '',
            role: user.role,
            branch_id: user.branch_id ?? undefined,
            password: '',
        })
        setShowForm(true)
    }

    const onCreateNew = () => {
        setEditingUser(null)
        setFormState({ ...emptyForm })
        setShowForm(true)
    }

    const onDeactivate = async (user: UserDto) => {
        if (!confirm(`${user.full_name} ni faol foydalanuvchilar ro'yxatidan o'chirasizmi?`)) {
            return
        }
        try {
            await deactivateUser(user.id)
            await qc.invalidateQueries({ queryKey: ['users'] })
        } catch (err: any) {
            alert(err?.response?.data?.detail || "Amalni bajarib bo'lmadi")
        }
    }

    const onResetPassword = async (user: UserDto) => {
        const password = prompt(`${user.full_name} uchun yangi parol kiriting:`)
        if (!password) return
        try {
            await resetUserPassword(user.id, password)
            alert('Parol yangilandi')
        } catch (err: any) {
            alert(err?.response?.data?.detail || "Parolni yangilab bo'lmadi")
        }
    }

    const onInvite = async (user: UserDto) => {
        try {
            const res = await inviteUser(user.id)
            alert(`Taklif havolasi: ${res.invite_token}`)
        } catch (err: any) {
            alert(err?.response?.data?.detail || "Taklif yuborib bo'lmadi")
        }
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Xodimlarni boshqarish</h1>
                    <p className="text-sm text-gray-500">Foydalanuvchilarni yaratish, rol va filial bo'yicha boshqarish</p>
                </div>
                <button
                    onClick={onCreateNew}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                >
                    Yangi xodim
                </button>
            </header>

            <section className="bg-gray-50 border rounded-xl p-4 space-y-3 text-sm">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Qidiruv..."
                        className="border rounded-lg px-3 py-2 bg-white"
                    />
                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="border rounded-lg px-3 py-2 bg-white"
                    >
                        <option value="">Rol bo'yicha</option>
                        {ROLE_OPTIONS.map(role => (
                            <option key={role} value={role}>{role}</option>
                        ))}
                    </select>
                    <select
                        value={branchFilter}
                        onChange={e => setBranchFilter(e.target.value)}
                        className="border rounded-lg px-3 py-2 bg-white"
                    >
                        <option value="">Filial bo'yicha</option>
                        {branches.map(branch => (
                            <option key={branch.id} value={branch.id}>{branch.name}</option>
                        ))}
                    </select>
                    <label className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
                        <input
                            type="checkbox"
                            checked={includeInactive}
                            onChange={e => setIncludeInactive(e.target.checked)}
                        />
                        <span>Faol bo'lmaganlarni ko'rsatish</span>
                    </label>
                </div>
            </section>

            {showForm && (
                <section className="border rounded-xl p-4 bg-white">
                    <h2 className="font-semibold mb-3">{editingUser ? 'Xodimni tahrirlash' : 'Yangi xodim'}</h2>
                    <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="flex flex-col gap-1">
                            <label>Ism familiya</label>
                            <input
                                value={formState.full_name}
                                onChange={e => setFormState(prev => ({ ...prev, full_name: e.target.value }))}
                                className="border rounded-lg px-3 py-2"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label>Email</label>
                            <input
                                value={formState.email}
                                onChange={e => setFormState(prev => ({ ...prev, email: e.target.value }))}
                                className="border rounded-lg px-3 py-2"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label>Telefon</label>
                            <input
                                value={formState.phone}
                                onChange={e => setFormState(prev => ({ ...prev, phone: e.target.value }))}
                                className="border rounded-lg px-3 py-2"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label>Rol</label>
                            <select
                                value={formState.role}
                                onChange={e => setFormState(prev => ({ ...prev, role: e.target.value as UserCreatePayload['role'] }))}
                                className="border rounded-lg px-3 py-2"
                            >
                                {ROLE_OPTIONS.map(role => (
                                    <option key={role} value={role}>{role}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label>Filial</label>
                            <select
                                value={formState.branch_id ?? ''}
                                onChange={e => setFormState(prev => ({ ...prev, branch_id: e.target.value ? Number(e.target.value) : undefined }))}
                                className="border rounded-lg px-3 py-2"
                            >
                                <option value="">Aniqlanmagan</option>
                                {branches.map(branch => (
                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label>Parol</label>
                            <input
                                type="password"
                                value={formState.password}
                                onChange={e => setFormState(prev => ({ ...prev, password: e.target.value }))}
                                className="border rounded-lg px-3 py-2"
                                placeholder={editingUser ? "O'zgartirmaslik uchun bo'sh qoldiring" : 'Kamida 6 ta belgi'}
                            />
                        </div>
                        <div className="md:col-span-2 flex gap-3 mt-2">
                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg"
                                disabled={saving}
                            >
                                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowForm(false); setEditingUser(null); setFormState({ ...emptyForm }) }}
                                className="px-4 py-2 rounded-lg border"
                            >
                                Bekor qilish
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-left">
                        <tr>
                            <th className="px-4 py-2">F.I.Sh</th>
                            <th className="px-4 py-2">Rol</th>
                            <th className="px-4 py-2">Filial</th>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">Telefon</th>
                            <th className="px-4 py-2">Holat</th>
                            <th className="px-4 py-2">Amallar</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usersQuery.isLoading ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">Yuklanmoqda...</td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-6 text-center text-gray-500">Xodimlar topilmadi</td>
                            </tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} className="border-t">
                                    <td className="px-4 py-2">
                                        <div className="font-medium text-gray-800">{user.full_name}</div>
                                        <div className="text-xs text-gray-500">ID: {user.id}</div>
                                    </td>
                                    <td className="px-4 py-2 capitalize">{user.role}</td>
                                    <td className="px-4 py-2">{user.branch_name || '—'}</td>
                                    <td className="px-4 py-2">{user.email || '—'}</td>
                                    <td className="px-4 py-2">{user.phone || '—'}</td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-1 rounded-full text-xs ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                                            {user.is_active ? 'Faol' : 'Faol emas'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 space-x-2">
                                        <button onClick={() => onEdit(user)} className="text-blue-600">Tahrirlash</button>
                                        <button onClick={() => onResetPassword(user)} className="text-amber-600">Parol</button>
                                        <button onClick={() => onInvite(user)} className="text-purple-600">Taklif</button>
                                        {user.is_active && (
                                            <button onClick={() => onDeactivate(user)} className="text-red-600">Faolsizlantirish</button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </section>
        </div>
    )
}

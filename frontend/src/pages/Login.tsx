// src/pages/Login.tsx
import { FormEvent, useState } from 'react'
import api from '../api'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Login() {
    const [username, setUsername] = useState('admin@lt.uz')
    const [password, setPassword] = useState('admin')
    const [err, setErr] = useState<string | null>(null)
    const nav = useNavigate()
    const { login } = useAuth()

    async function onSubmit(e: FormEvent) {
        e.preventDefault()
        setErr(null)
        try {
            const res = await api.post('/auth/login', { username, password })
            login(res.data.access_token, res.data.user)
            nav('/orders')
        } catch (e: any) {
            setErr(e?.response?.data?.detail || 'Login xatosi')
        }
    }

    return (
        <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50">
            {/* Logo */}
            <div className="mb-6">
                <img src="/lingua-logo.png" alt="Lingua Translation Logo" className="max-w-[400px]" />
            </div>

            {/* Login form */}
            <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-3">
                <div className="text-4xl font-semibold text-center">Kirish</div>
                {err && <div className="text-red-600 text-sm">{err}</div>}
                <div>
                    <label className="text-sm">Email yoki telefon</label>
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="admin@lt.uz"
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
                <div>
                    <label className="text-sm">Parol</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="admin"
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                </div>
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-2 rounded-lg"
                >
                    Kirish
                </button>
            </form>
        </div>
    )
}

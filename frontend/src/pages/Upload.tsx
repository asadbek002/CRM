import { useParams, useNavigate } from 'react-router-dom'
import { useRef, useState, useEffect } from 'react'
import api /*, { API_BASE } */ from '../api' // API_BASE bo'lmasa ham ishlaydi

type Attachment = { id: number; display_name: string; size: number }

// API_BASE fallback: agar ../api dan export qilinmagan bo'lsa ham:
const BASE =
    // @ts-ignore - ixtiyoriy eksport bo'lishi mumkin
    (typeof API_BASE !== 'undefined' && (API_BASE as string)) ||
    (api.defaults?.baseURL as string) ||
    'http://127.0.0.1:8000'

export default function Upload() {
    const { id } = useParams<{ id: string }>()
    const nav = useNavigate()
    const fileRef = useRef<HTMLInputElement | null>(null)

    const [rows, setRows] = useState<Attachment[]>([])
    const [msg, setMsg] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = async () => {
        if (!id) return
        setLoading(true)
        setError(null)
        try {
            const r = await api.get(`/orders/${id}/attachments`)
            setRows(r.data || [])
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Fayllarni yuklab bo‘lmadi')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const onUpload = async () => {
        if (!id) return
        const file = fileRef.current?.files?.[0]
        if (!file) return alert('Fayl tanlang')
        const fd = new FormData()
        // backend param nomi: f
        fd.append('f', file)

        setMsg(null)
        setBusy(true)
        try {
            await api.post(`/orders/${id}/upload`, fd) // header bermaymiz
            setMsg('✅ Fayl yuklandi')
            if (fileRef.current) fileRef.current.value = ''
            await load()
        } catch (e: any) {
            const detail = e?.response?.data?.detail
            setMsg(typeof detail === 'string' ? detail : 'Yuklashda xato')
        } finally {
            setBusy(false)
        }
    }

    const delOne = async (attId: number) => {
        if (!confirm("O‘chirishni xohlaysizmi?")) return
        try {
            await api.delete(`/attachments/${attId}`)
            // tezkor UI uchun ixtiyoriy:
            // setRows(prev => prev.filter(x => x.id !== attId))
            await load()
        } catch (e: any) {
            alert(e?.response?.data?.detail || 'O‘chirishda xato')
        }
    }

    return (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
            <h2>Buyurtma #{id} — Fayl yuklash</h2>

            {msg && (
                <div
                    style={{
                        margin: '8px 0',
                        color: msg.startsWith('✅') ? '#16a34a' : '#dc2626',
                    }}
                >
                    {msg}
                </div>
            )}
            {error && <div style={{ color: '#dc2626', marginBottom: 8 }}>{error}</div>}

            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 12,
                    flexWrap: 'wrap',
                }}
            >
                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" />
                <button
                    onClick={onUpload}
                    disabled={busy || !id}
                    style={{
                        background: busy ? '#374151' : '#111827',
                        cursor: busy ? 'not-allowed' : 'pointer',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: 8,
                    }}
                >
                    {busy ? 'Yuklanmoqda…' : 'Yuklash'}
                </button>
                <button
                    onClick={() => nav('/orders')}
                    style={{
                        background: '#6b7280',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: 8,
                    }}
                >
                    Ortga
                </button>
            </div>

            <ul style={{ marginTop: 8, padding: 0, listStyle: 'none' }}>
                {loading && <li>Yuklanmoqda…</li>}
                {!loading && rows.length === 0 && (
                    <li style={{ color: '#6b7280' }}>Hali fayl yo‘q</li>
                )}

                {!loading &&
                    rows.map((a) => (
                        <li
                            key={a.id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '8px 0',
                                borderBottom: '1px solid #eee',
                                gap: 12,
                            }}
                        >
                            <a
                                href={`${BASE}/attachments/${a.id}/download`}
                                title="Yuklab olish"
                                style={{ textDecoration: 'none', color: '#2563eb', flex: 1 }}
                                draggable
                            >
                                📎 {a.display_name} ({(a.size / 1024).toFixed(1)} KB)
                            </a>
                            <button
                                onClick={() => delOne(a.id)}
                                title="O‘chirish"
                                style={{
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    borderRadius: 8,
                                    padding: '4px 10px',
                                    border: '1px solid #fecaca',
                                }}
                            >
                                🗑 O‘chirish
                            </button>
                        </li>
                    ))}
            </ul>
        </div>
    )
}

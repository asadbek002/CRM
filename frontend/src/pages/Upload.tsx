import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useRef, useState } from 'react'
import api /*, { API_BASE } */ from '../api'

type AttachmentKind = 'translation' | 'apostille' | 'notary'

type Attachment = {
    id: number
    display_name: string
    size: number
    kind?: AttachmentKind | string
}

const KIND_ORDER: AttachmentKind[] = ['translation', 'apostille', 'notary']

const ACCEPTED_EXTENSIONS = [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'csv',
    'jpg',
    'jpeg',
    'png',
    'webp',
    'zip',
    'rar',
    '7z',
]
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map(ext => `.${ext}`).join(',')
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024

const KIND_LABELS: Record<AttachmentKind, string> = {
    translation: 'Hujjatlar Tarjimasi',
    apostille: 'Apostillar',
    notary: 'Natarius hujjatlar',
}

const resolveMessageColor = (msg: string | null) => {
    if (!msg) return '#6b7280'
    if (msg.startsWith('✅')) return '#16a34a'
    if (msg.startsWith('🗑')) return '#2563eb'
    return '#dc2626'
}

// API_BASE fallback: agar ../api dan export qilinmagan bo'lsa ham:
const BASE =
    // @ts-ignore - ixtiyoriy eksport bo'lishi mumkin
    (typeof API_BASE !== 'undefined' && (API_BASE as string)) ||
    (api.defaults?.baseURL as string) ||
    'http://127.0.0.1:8000'

const makeRecord = <T,>(value: T | (() => T)): Record<AttachmentKind, T> => {
    const resolve = typeof value === 'function' ? (value as () => T) : () => value
    return {
        translation: resolve(),
        apostille: resolve(),
        notary: resolve(),
    }
}

export default function Upload() {
    const { id } = useParams<{ id: string }>()
    const nav = useNavigate()

    const [filesByKind, setFilesByKind] = useState<Record<AttachmentKind, Attachment[]>>(
        makeRecord<Attachment[]>(() => []),
    )
    const [selected, setSelected] = useState<Record<AttachmentKind, File | null>>(makeRecord<File | null>(null))
    const [messages, setMessages] = useState<Record<AttachmentKind, string | null>>(makeRecord<string | null>(null))
    const [busy, setBusy] = useState<Record<AttachmentKind, boolean>>(makeRecord(false))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fileRefs = useRef<Record<AttachmentKind, HTMLInputElement | null>>({
        translation: null,
        apostille: null,
        notary: null,
    })

    const normalizeKind = (value?: AttachmentKind | string | null): AttachmentKind => {
        if (value === 'apostille' || value === 'notary') return value
        return 'translation'
    }

    const load = async () => {
        if (!id) return
        setLoading(true)
        setError(null)
        try {
            const r = await api.get(`/orders/${id}/attachments`)
            const grouped = makeRecord<Attachment[]>(() => [])
            const list: Attachment[] = Array.isArray(r.data) ? r.data : []
            for (const item of list) {
                const kind = normalizeKind(item.kind)
                grouped[kind].push({ ...item, kind })
            }
            setFilesByKind(grouped)
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

    const isAllowedExtension = (name: string) => {
        const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
        return ACCEPTED_EXTENSIONS.includes(ext)
    }

    const handleFileChange = (kind: AttachmentKind, files: FileList | null) => {
        const file = files?.[0] || null
        if (file && !isAllowedExtension(file.name)) {
            setMessages(prev => ({ ...prev, [kind]: 'Fayl formati qo‘llab-quvvatlanmaydi' }))
            setSelected(prev => ({ ...prev, [kind]: null }))
            if (fileRefs.current[kind]) {
                fileRefs.current[kind]!.value = ''
            }
            return
        }
        setSelected(prev => ({ ...prev, [kind]: file }))
        setMessages(prev => ({ ...prev, [kind]: null }))
    }

    const uploadOne = async (kind: AttachmentKind) => {
        if (!id) return
        const file = selected[kind]
        if (!file) {
            setMessages(prev => ({ ...prev, [kind]: 'Fayl tanlang' }))
            return
        }
        if (!isAllowedExtension(file.name)) {
            setMessages(prev => ({ ...prev, [kind]: 'Fayl formati qo‘llab-quvvatlanmaydi' }))
            return
        }
        if (file.size > MAX_UPLOAD_SIZE) {
            setMessages(prev => ({ ...prev, [kind]: 'Fayl hajmi 50 MB dan oshmasin' }))
            return
        }
        const fd = new FormData()
        fd.append('f', file)
        fd.append('kind', kind)

        setBusy(prev => ({ ...prev, [kind]: true }))
        setMessages(prev => ({ ...prev, [kind]: null }))
        try {
            await api.post(`/orders/${id}/upload`, fd)
            setMessages(prev => ({ ...prev, [kind]: '✅ Fayl yuklandi' }))
            setSelected(prev => ({ ...prev, [kind]: null }))
            if (fileRefs.current[kind]) {
                fileRefs.current[kind]!.value = ''
            }
            await load()
        } catch (e: any) {
            const detail = e?.response?.data?.detail
            setMessages(prev => ({ ...prev, [kind]: typeof detail === 'string' ? detail : 'Yuklashda xato' }))
        } finally {
            setBusy(prev => ({ ...prev, [kind]: false }))
        }
    }

    const delOne = async (attId: number, kind: AttachmentKind) => {
        if (!confirm("O‘chirishni xohlaysizmi?")) return
        try {
            await api.delete(`/attachments/${attId}`)
            setMessages(prev => ({ ...prev, [kind]: '🗑 Fayl o‘chirildi' }))
            await load()
        } catch (e: any) {
            alert(e?.response?.data?.detail || 'O‘chirishda xato')
        }
    }

    const hasAnyFiles = useMemo(() => KIND_ORDER.some(k => (filesByKind[k] || []).length > 0), [filesByKind])

    return (
        <div style={{ background: '#fff', padding: 16, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
                <h2 style={{ fontSize: 20, fontWeight: 600 }}>Buyurtma #{id} — Fayl yuklash</h2>
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

            {error && <div style={{ color: '#dc2626', margin: '12px 0' }}>{error}</div>}

            <div
                style={{
                    display: 'grid',
                    gap: 16,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    marginTop: 16,
                }}
            >
                {KIND_ORDER.map(kind => (
                    <section
                        key={kind}
                        style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: 12,
                            padding: 16,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 12,
                        }}
                    >
                        <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 16, fontWeight: 600 }}>{KIND_LABELS[kind]}</span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>Har bir bo‘limga alohida fayl yuklang.</span>
                            {messages[kind] && (
                                <span
                                    style={{
                                        fontSize: 12,
                                        color: resolveMessageColor(messages[kind]),
                                    }}
                                >
                                    {messages[kind]}
                                </span>
                            )}
                        </header>


                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <input
                                ref={el => {
                                    fileRefs.current[kind] = el
                                }}
                                type="file"
                                accept={ACCEPT_ATTR}
                                onChange={e => handleFileChange(kind, e.target.files)}
                            />
                            <button
                                onClick={() => uploadOne(kind)}
                                disabled={busy[kind] || !selected[kind]}
                                style={{
                                    background: busy[kind] ? '#374151' : '#111827',
                                    cursor: busy[kind] ? 'not-allowed' : 'pointer',
                                    color: '#fff',
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                }}
                            >
                                {busy[kind] ? 'Yuklanmoqda…' : 'Yuklash'}
                            </button>
                        </div>

                        <div style={{ flex: 1 }}>
                            {loading ? (
                                <p style={{ color: '#6b7280' }}>Yuklanmoqda…</p>
                            ) : (filesByKind[kind] || []).length === 0 ? (
                                <p style={{ color: '#9ca3af' }}>Hali fayl yo‘q</p>
                            ) : (
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {(filesByKind[kind] || []).map(a => (
                                        <li
                                            key={a.id}
                                            style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: '6px 0',
                                                borderBottom: '1px solid #f3f4f6',
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
                                                onClick={() => delOne(a.id, kind)}
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
                            )}
                        </div>
                    </section>
                ))}
            </div>

            {!loading && !hasAnyFiles && (
                <p style={{ marginTop: 16, color: '#9ca3af', textAlign: 'center' }}>
                    Buyurtma uchun hali hech qanday fayl yuklanmagan
                </p>
            )}
        </div>
    )
}
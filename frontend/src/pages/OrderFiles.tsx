// frontend/src/pages/OrderFiles.tsx
import { useParams, Link as RLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api, { API_BASE } from '../api'   // ⬅️ API_BASE import

type FileRow = { id: number; display_name: string; size: number }

export default function OrderFiles() {
    const { id } = useParams<{ id: string }>()
    const [files, setFiles] = useState<FileRow[]>([])
    const [dragging, setDragging] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = async () => {
        setLoading(true); setError(null)
        try {
            const r = await api.get(`/orders/${id}/attachments`)
            setFiles(r.data || [])
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Fayllarni yuklab bo‘lmadi')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [id])

    const uploadOne = async (file: File) => {
        const fd = new FormData()
        fd.append('file', file)
        await api.post(`/orders/${id}/upload`, fd)
         
    }

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setDragging(false)
        if (!e.dataTransfer.files?.length) return
        try {
            for (const f of Array.from(e.dataTransfer.files)) await uploadOne(f)
            await load()
        } catch (e: any) {
            alert(e?.response?.data?.detail || 'Yuklashda xato')
        }
    }

    const pickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return
        try {
            for (const f of Array.from(e.target.files)) await uploadOne(f)
            e.target.value = ''
            await load()
        } catch (e: any) {
            alert(e?.response?.data?.detail || 'Yuklashda xato')
        }
    }

    const del = async (fid: number) => {
        if (!confirm('O‘chirishni xohlaysizmi?')) return
        try {
            await api.delete(`/attachments/${fid}`)
            await load()
        } catch (e: any) {
            alert(e?.response?.data?.detail || 'O‘chirishda xato')
        }
    }

    return (
        <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Order #{id} fayllari</h2>
                <RLink to="/orders" className="underline">← Buyurtmalar</RLink>
            </div>

            <div
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center ${dragging ? 'bg-blue-50 border-blue-400' : 'border-gray-300'}`}
            >
                Faylni shu joyga tortib tashlang yoki
                <label className="ml-2 text-blue-600 underline cursor-pointer">
                    tanlang
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={pickFiles}
                    // ixtiyoriy: serverdagi ruxsatga moslab cheklash (masalan pdf/png/jpg)
                    // accept=".pdf,.png,.jpg,.jpeg"
                    />
                </label>
            </div>

            {error && <div className="text-red-600 text-sm">{error}</div>}

            {loading ? (
                <div>Yuklanmoqda…</div>
            ) : (
                <ul className="divide-y">
                    {files.length === 0 && <li className="py-3 text-gray-500">Hali fayl yo‘q</li>}
                        {files.map(f => (
                            <li key={f.id} className="flex justify-between items-center py-2">
                                <a
                                    href={`${API_BASE}/attachments/${f.id}/download`}
                                    className="text-blue-600 hover:underline"
                                    draggable
                                    title="Yuklab olish"
                                >
                                    📎 {f.display_name} ({(f.size / 1024).toFixed(1)} KB)
                                </a>

                                {/* O‘chirish tugmasi */}
                                <button
                                    onClick={() => del(f.id)}
                                    className="px-3 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100"
                                    title="O‘chirish"
                                >
                                    🗑 O‘chirish
                                </button>
                            </li>
                        ))}


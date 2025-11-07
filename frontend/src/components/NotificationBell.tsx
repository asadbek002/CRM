import { useEffect, useRef, useState } from 'react'

import { useNotifications } from '../notifications'

function formatDate(value?: string | null) {
    if (!value) return ''
    try {
        const dt = new Date(value)
        if (Number.isNaN(dt.getTime())) return ''
        return dt.toLocaleString()
    } catch {
        return ''
    }
}

export default function NotificationBell() {
    const { notifications, unreadCount, isLoading, markAllRead } = useNotifications()
    const [open, setOpen] = useState(false)
    const wrapperRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!open) return
        const onClick = (event: MouseEvent) => {
            if (
                wrapperRef.current &&
                event.target instanceof Node &&
                !wrapperRef.current.contains(event.target)
            ) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [open])

    const onToggle = () => setOpen((prev) => !prev)

    const handleMarkAll = async () => {
        await markAllRead()
    }

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                onClick={onToggle}
                className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-xl shadow-sm"
                title="Bildirishnomalar"
            >
                <span aria-hidden>🔔</span>
                {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
                        <span className="text-sm font-semibold text-slate-800">
                            Bildirishnomalar
                        </span>
                        <button
                            type="button"
                            onClick={handleMarkAll}
                            disabled={unreadCount === 0}
                            className="text-xs font-medium text-blue-600 disabled:text-slate-300"
                        >
                            Hammasini o'qilgan deb belgilash
                        </button>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                        {isLoading ? (
                            <div className="px-4 py-6 text-center text-sm text-slate-500">
                                Yuklanmoqda...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-slate-500">
                                Bildirishnomalar yo'q.
                            </div>
                        ) : (
                            notifications.map((item) => (
                                <div
                                    key={item.id}
                                    className={`border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 ${
                                        item.is_read ? 'bg-white' : 'bg-blue-50'
                                    }`}
                                >
                                    <div className="font-medium text-slate-800">
                                        {item.title}
                                    </div>
                                    {item.message && (
                                        <div className="mt-1 text-xs text-slate-600">
                                            {item.message}
                                        </div>
                                    )}
                                    <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                                        {formatDate(item.created_at)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}


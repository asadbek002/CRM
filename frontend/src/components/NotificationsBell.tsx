import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useNotifications } from '../notifications'

function BellIcon({ hasUnread }: { hasUnread: boolean }) {
    return (
        <svg
            className={`w-6 h-6 ${hasUnread ? 'text-amber-500' : 'text-gray-600'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
        >
            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
            <path d="M7 15a3 3 0 006 0H7z" />
        </svg>
    )
}

export default function NotificationsBell() {
    const { notifications, unreadCount, markAllRead } = useNotifications()
    const [open, setOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!open) return
        const onClick = (event: MouseEvent) => {
            if (!dropdownRef.current) return
            if (!dropdownRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }
        window.addEventListener('mousedown', onClick)
        return () => {
            window.removeEventListener('mousedown', onClick)
        }
    }, [open])

    const formatted = useMemo(
        () =>
            notifications
                .slice(0, 10)
                .map((item) => ({
                    ...item,
                    createdLabel: new Date(item.created_at).toLocaleString(),
                })),
        [notifications]
    )

    const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString()

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100"
                onClick={() => setOpen((v) => !v)}
                aria-label="Notifications"
            >
                <BellIcon hasUnread={unreadCount > 0} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-semibold rounded-full px-1">
                        {displayCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded shadow-lg z-40">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                        <span className="font-semibold text-sm">Notifications</span>
                        <button
                            className="text-xs text-blue-600 hover:underline disabled:text-gray-400"
                            onClick={markAllRead}
                            disabled={unreadCount === 0}
                        >
                            Mark all read
                        </button>
                    </div>
                    <ul className="max-h-80 overflow-y-auto">
                        {formatted.length === 0 ? (
                            <li className="px-4 py-6 text-sm text-gray-500 text-center">
                                No notifications yet
                            </li>
                        ) : (
                            formatted.map((item) => (
                                <li
                                    key={item.id}
                                    className={`px-4 py-3 text-sm border-b border-gray-100 last:border-b-0 ${
                                        item.is_read ? 'bg-white' : 'bg-amber-50'
                                    }`}
                                >
                                    <div className="font-medium text-gray-800">{item.message}</div>
                                    <div className="text-xs text-gray-500 mt-1">{item.createdLabel}</div>
                                    {item.order_id && (
                                        <div className="text-xs text-blue-600 mt-1">
                                            <Link to="/orders">Go to orders</Link>
                                        </div>
                                    )}
                                </li>
                            ))
                        )}
                    </ul>
                </div>
            )}
        </div>
    )
}

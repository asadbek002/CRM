import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { baseURL, fetchNotifications, markNotificationsRead, NotificationItem } from './api'
import { useAuth } from './auth'

interface NotificationsContextValue {
    notifications: NotificationItem[]
    unreadCount: number
    markAllRead: () => Promise<void>
}

const NotificationsCtx = createContext<NotificationsContextValue>({
    notifications: [],
    unreadCount: 0,
    markAllRead: async () => {},
})

type ToastEntry = {
    id: number
    notification: NotificationItem
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { token } = useAuth()
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [toasts, setToasts] = useState<ToastEntry[]>([])
    const retryRef = useRef<number | null>(null)
    const sourceRef = useRef<EventSource | null>(null)
    const mountedRef = useRef(true)

    useEffect(() => {
        return () => {
            mountedRef.current = false
        }
    }, [])

    useEffect(() => {
        setNotifications([])
        setToasts([])
        if (!token) {
            if (sourceRef.current) {
                sourceRef.current.close()
                sourceRef.current = null
            }
            if (retryRef.current) {
                window.clearTimeout(retryRef.current)
                retryRef.current = null
            }
            return
        }

        let cancelled = false
        fetchNotifications().then((items) => {
            if (cancelled) return
            setNotifications(items)
        }).catch((err) => {
            console.error('Failed to load notifications', err)
        })

        return () => {
            cancelled = true
        }
    }, [token])

    const pushToast = useCallback((notification: NotificationItem) => {
        if (!mountedRef.current) return
        const entry: ToastEntry = {
            id: Date.now() + Math.random(),
            notification,
        }
        setToasts((prev) => [...prev, entry])
        window.setTimeout(() => {
            if (!mountedRef.current) return
            setToasts((prev) => prev.filter((item) => item.id !== entry.id))
        }, 6000)
    }, [])

    useEffect(() => {
        if (!token) {
            return
        }

        let stopped = false

        const connect = () => {
            if (stopped || !token) return

            const url = new URL('/api/notifications/stream', baseURL)
            url.searchParams.set('token', token)

            const es = new EventSource(url.toString(), { withCredentials: true })
            sourceRef.current = es

            const handleNotification = (event: Event) => {
                const message = event as MessageEvent<string>
                try {
                    const parsed = JSON.parse(message.data) as NotificationItem
                    setNotifications((prev) => {
                        const filtered = prev.filter((item) => item.id !== parsed.id)
                        return [parsed, ...filtered].slice(0, 100)
                    })
                    pushToast(parsed)
                } catch (error) {
                    console.error('Failed to parse notification event', error)
                }
            }

            const handlePing = () => {}

            const handleError = () => {
                es.close()
                if (stopped) return
                if (retryRef.current) {
                    window.clearTimeout(retryRef.current)
                }
                retryRef.current = window.setTimeout(connect, 3000)
            }

            es.addEventListener('notification', handleNotification)
            es.addEventListener('error', handleError)
            es.addEventListener('ping', handlePing)

            return () => {
                es.removeEventListener('notification', handleNotification)
                es.removeEventListener('error', handleError)
                es.removeEventListener('ping', handlePing)
                es.close()
            }
        }

        const cleanup = connect()

        return () => {
            stopped = true
            cleanup?.()
            if (retryRef.current) {
                window.clearTimeout(retryRef.current)
                retryRef.current = null
            }
            if (sourceRef.current) {
                sourceRef.current.close()
                sourceRef.current = null
            }
        }
    }, [pushToast, token])

    const markAllRead = useCallback(async () => {
        if (!token) return
        try {
            const { updated } = await markNotificationsRead()
            if (updated > 0) {
                const nowIso = new Date().toISOString()
                setNotifications((prev) =>
                    prev.map((item) =>
                        item.is_read
                            ? item
                            : { ...item, is_read: true, read_at: nowIso }
                    )
                )
            }
        } catch (error) {
            console.error('Failed to mark notifications read', error)
        }
    }, [token])

    const unreadCount = useMemo(
        () => notifications.filter((item) => !item.is_read).length,
        [notifications]
    )

    return (
        <NotificationsCtx.Provider value={{ notifications, unreadCount, markAllRead }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map(({ id, notification }) => (
                    <div
                        key={id}
                        className="bg-gray-900 text-white px-4 py-3 rounded shadow-lg max-w-xs w-72"
                    >
                        <div className="text-xs uppercase tracking-wide opacity-70 mb-1">
                            {notification.kind.replace(/_/g, ' ')}
                        </div>
                        <div className="text-sm leading-snug">{notification.message}</div>
                    </div>
                ))}
            </div>
        </NotificationsCtx.Provider>
    )
}

export function useNotifications() {
    return useContext(NotificationsCtx)
}

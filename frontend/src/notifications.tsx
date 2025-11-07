import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'

import {
    baseURL,
    fetchNotifications,
    markAllNotificationsRead,
    NotificationItem,
} from './api'
import { useAuth } from './auth'

type ToastItem = {
    key: string
    title: string
    message?: string | null
}

type NotificationsContextValue = {
    notifications: NotificationItem[]
    unreadCount: number
    isLoading: boolean
    markAllRead: () => Promise<void>
}

const NotificationsCtx = createContext<NotificationsContextValue>({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    markAllRead: async () => {},
})

export function NotificationsProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const { token } = useAuth()
    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [toasts, setToasts] = useState<ToastItem[]>([])
    const eventSourceRef = useRef<EventSource | null>(null)

    const resetState = useCallback(() => {
        setNotifications([])
        setUnreadCount(0)
        setToasts([])
    }, [])

    const dismissToast = useCallback((key: string) => {
        setToasts((prev) => prev.filter((toast) => toast.key !== key))
    }, [])

    useEffect(() => {
        if (!token) {
            resetState()
            if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
            }
            return
        }

        setIsLoading(true)
        fetchNotifications()
            .then((data) => {
                setNotifications(data.items)
                setUnreadCount(data.unread)
            })
            .catch((err) => {
                console.error('Failed to load notifications', err)
            })
            .finally(() => setIsLoading(false))
    }, [token, resetState])

    useEffect(() => {
        if (!token) {
            return
        }

        const source = new EventSource(`${baseURL}/api/notifications/stream`, {
            withCredentials: true,
        })
        eventSourceRef.current = source

        const onNotification = (event: MessageEvent) => {
            try {
                const payload = JSON.parse(event.data) as NotificationItem

                setNotifications((prev) => {
                    const withoutDup = prev.filter((item) => item.id !== payload.id)
                    const updated = [payload, ...withoutDup].slice(0, 50)
                    setUnreadCount(updated.filter((item) => !item.is_read).length)
                    return updated
                })

                const toastKey = `${payload.id}-${Date.now()}`
                setToasts((prev) => [
                    ...prev,
                    { key: toastKey, title: payload.title, message: payload.message },
                ])
                window.setTimeout(() => dismissToast(toastKey), 6000)
            } catch (e) {
                console.error('Invalid notification payload', e)
            }
        }

        const onError = (event: Event) => {
            console.warn('Notification stream error', event)
        }

        source.addEventListener('notification', onNotification as EventListener)
        source.addEventListener('heartbeat', () => {})
        source.onerror = onError

        return () => {
            source.removeEventListener('notification', onNotification as EventListener)
            source.close()
            eventSourceRef.current = null
        }
    }, [token, dismissToast])

    const markAllRead = useCallback(async () => {
        try {
            await markAllNotificationsRead()
            setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))
            setUnreadCount(0)
        } catch (err) {
            console.error('Failed to mark notifications as read', err)
        }
    }, [])

    const value = useMemo(
        () => ({ notifications, unreadCount, isLoading, markAllRead }),
        [notifications, unreadCount, isLoading, markAllRead]
    )

    return (
        <NotificationsCtx.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        </NotificationsCtx.Provider>
    )
}

export function useNotifications() {
    return useContext(NotificationsCtx)
}

function ToastContainer({
    toasts,
    onDismiss,
}: {
    toasts: ToastItem[]
    onDismiss: (key: string) => void
}) {
    if (!toasts.length) return null

    return (
        <div className="fixed right-4 top-4 z-50 flex w-full max-w-xs flex-col gap-3">
            {toasts.map((toast) => (
                <div
                    key={toast.key}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg"
                    onClick={() => onDismiss(toast.key)}
                    role="status"
                >
                    <div className="text-sm font-semibold text-slate-800">
                        {toast.title}
                    </div>
                    {toast.message && (
                        <div className="mt-1 text-xs text-slate-600">{toast.message}</div>
                    )}
                </div>
            ))}
        </div>
    )
}


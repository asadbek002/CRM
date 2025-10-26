// src/api.ts
import axios from 'axios'

/** Базовый URL API (берётся из VITE_API_URL, иначе localhost) */
export const baseURL =
    import.meta.env.VITE_API_URL || 'http://localhost:8000'

/** Единый Axios-клиент */
const api = axios.create({
    baseURL,
    timeout: 15000,
})

/** Request interceptor: токен + заголовки */
api.interceptors.request.use((config) => {
    // JWT токен
    const token = localStorage.getItem('token')
    if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
    }

    // По умолчанию — JSON (кроме FormData)
    const isFormData =
        typeof FormData !== 'undefined' && config.data instanceof FormData

    if (!isFormData) {
        config.headers = config.headers || {}
        if (!config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json'
        }
        if (!config.headers['Accept']) {
            config.headers['Accept'] = 'application/json'
        }
    }

    return config
})

/** Response interceptor: обработка ошибок/401 */
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err?.response?.status
        const msg =
            err?.response?.data?.detail ||
            err?.response?.data?.message ||
            err?.message

        if (status === 401) {
            try {
                localStorage.removeItem('token')
            } catch { }
            if (
                typeof window !== 'undefined' &&
                window.location.pathname !== '/login'
            ) {
                window.location.assign('/login')
            }
        }

        console.error('API error:', {
            url: err.config?.url,
            method: err.config?.method,
            status,
            detail: msg,
        })
        return Promise.reject(err)
    }
)

export default api

// ===================== COMMENTS API =====================

export interface CommentOut {
    id: number
    order_id: number
    text: string
    author?: string | null
    created_at: string
}

export interface CommentCreate {
    text: string
    author?: string
}

/** Получить комментарии заказа */
export async function fetchComments(orderId: number) {
    const { data } = await api.get<CommentOut[]>(
        `/orders/${orderId}/comments`
    )
    return data
}

/** Добавить комментарий (через объект) */
export async function addComment(
    orderId: number,
    payload: CommentCreate
) {
    const { data } = await api.post<CommentOut>(
        `/orders/${orderId}/comments`,
        payload
    )
    return data
}

/** Удобный враппер: addCommentText(orderId, text, author?) */
export async function addCommentText(
    orderId: number,
    text: string,
    author?: string
) {
    return addComment(orderId, { text, author })
}

/** Удалить комментарий */
export async function deleteComment(
    orderId: number,
    commentId: number
) {
    await api.delete(`/orders/${orderId}/comments/${commentId}`)
}

// ===================== ATTACHMENTS API =====================

export type AttachmentKind = 'translation' | 'apostille' | 'notary'

export interface AttachmentOut {
    id: number
    original_name: string
    size: number
    kind?: AttachmentKind | string
}

/** Список файлов заказа (все виды) */
export async function fetchOrderAttachments(orderId: number) {
    const { data } = await api.get<AttachmentOut[]>(
        `/orders/${orderId}/attachments`
    )
    return Array.isArray(data) ? data : []
}

/** Помощник для прямой ссылки на скачивание файла */
export const buildAttachmentDownloadUrl = (id: number) =>
    `${baseURL}/attachments/${id}/download`

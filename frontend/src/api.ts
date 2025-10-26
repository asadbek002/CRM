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

// ===================== DASHBOARD API =====================

export interface DashboardFiltersState {
    date_from?: string
    date_to?: string
    branch_id?: number
    manager_id?: number
    customer_type?: string
    doc_type?: string
}

export interface DashboardSummary {
    orders_total: number
    orders_in_progress: number
    orders_completed: number
    orders_overdue: number
    payments_sum: number
    payments_debt: number
    files_pending: number
    files_rejected: number
}

export interface DashboardTimelinePoint {
    bucket: string
    orders: number
    payments: number
}

export interface DashboardTopResponse {
    doc_types: { label: string; value: number }[]
    customer_types: { label: string; value: number }[]
}

export interface DashboardFiltersResponse {
    branches: { id: number; name: string }[]
    managers: { id: number; name: string; role: string; branch_id: number | null }[]
    doc_types: string[]
    customer_types: string[]
}

export interface AuditLogItem {
    id: number
    action: string
    entity_type: string
    entity_id?: number | null
    details?: string | null
    created_at: string
    user_name?: string | null
}

export async function fetchDashboardSummary(params: DashboardFiltersState) {
    const { data } = await api.get<DashboardSummary>('/dashboard/summary', { params })
    return data
}

export async function fetchDashboardTimeline(
    params: DashboardFiltersState & { group_by: 'day' | 'week' | 'month' }
) {
    const { data } = await api.get<DashboardTimelinePoint[]>(
        '/dashboard/timeline',
        { params }
    )
    return data
}

export async function fetchDashboardTop(params: DashboardFiltersState) {
    const { data } = await api.get<DashboardTopResponse>('/dashboard/top', { params })
    return data
}

export async function fetchDashboardActivity() {
    const { data } = await api.get<AuditLogItem[]>('/dashboard/activity')
    return data
}

export async function fetchDashboardFilters() {
    const { data } = await api.get<DashboardFiltersResponse>('/dashboard/filters')
    return data
}

// ===================== USERS API =====================

export interface UserDto {
    id: number
    full_name: string
    email?: string | null
    phone?: string | null
    role: string
    branch_id?: number | null
    branch_name?: string | null
    is_active: boolean
    invited_at?: string | null
    last_login_at?: string | null
    created_at?: string | null
}

export interface UserFilterParams {
    q?: string
    role?: string
    branch_id?: number
    include_inactive?: boolean
}

export async function listUsers(params: UserFilterParams = {}) {
    const { data } = await api.get<UserDto[]>('/users', { params })
    return data
}

export interface UserCreatePayload {
    full_name: string
    email?: string
    phone?: string
    role: string
    branch_id?: number
    password?: string
}

export async function createUser(payload: UserCreatePayload) {
    const { data } = await api.post<UserDto>('/users', payload)
    return data
}

export type UserUpdatePayload = Partial<UserCreatePayload> & { is_active?: boolean }

export async function updateUser(userId: number, payload: UserUpdatePayload) {
    const { data } = await api.put<UserDto>(`/users/${userId}`, payload)
    return data
}

export async function deactivateUser(userId: number) {
    await api.delete(`/users/${userId}`)
}

export async function resetUserPassword(userId: number, password: string) {
    await api.post(`/users/${userId}/reset-password`, { password })
}

export async function inviteUser(userId: number) {
    const { data } = await api.post<{ invite_token: string }>(
        `/users/${userId}/invite`
    )
    return data
}

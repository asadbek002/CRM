// src/api.ts
import axios from 'axios'

export const baseURL =
    import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
    baseURL,
    timeout: 15000, // tarmoqqa bog‘liq muammolarda tezroq xulosa
})

// Request interceptor
api.interceptors.request.use((config) => {
    // Token qo‘shish
    const token = localStorage.getItem('token')
    if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
    }

    // Content-Type: agar FormData bo‘lmasa, JSON sifatida yuboramiz
    const isFormData =
        typeof FormData !== 'undefined' && config.data instanceof FormData
    if (!isFormData) {
        config.headers = config.headers || {}
        if (!config.headers['Content-Type']) {
            config.headers['Content-Type'] = 'application/json'
        }
        // Accept ni ham qo‘shib qo‘yamiz
        if (!config.headers['Accept']) {
            config.headers['Accept'] = 'application/json'
        }
    }
    return config
})

// Response interceptor (xatolar)
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err?.response?.status
        const msg =
            err?.response?.data?.detail ||
            err?.response?.data?.message ||
            err?.message

        // 401: token muddati tugagan yoki noto‘g‘ri — avtomatik logout
        if (status === 401) {
            try {
                localStorage.removeItem('token')
            } catch { }
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.assign('/login')
            }
        }

        // Konsolda tushunarli log
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

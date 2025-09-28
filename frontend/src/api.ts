// src/api.ts
import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
    baseURL,
    timeout: 15000,              // tarmoqqa bogliq muammolarda tezroq xulosa
    // headers removed to allow FormData/JSON to auto-set
    // headers: { 'Content-Type': 'application/json' },
    // withCredentials: true,    // cookie ishlatsangiz yoqing
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// xatoni konsolda tushunarli chiqarish
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const msg =
            err?.response?.data?.detail ||
            err?.response?.data?.message ||
            err.message
        console.error('API error:', {
            url: err.config?.url,
            method: err.config?.method,
            status: err.response?.status,
            detail: msg,
        })
        return Promise.reject(err)
    }
)

export default api

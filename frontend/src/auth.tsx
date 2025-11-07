// src/auth.tsx
import { createContext, useContext, useEffect, useState } from 'react'

type User = { id: number; name: string; role: string; branch_id?: number | null } | null
type Ctx = {
  user: User
  token: string | null
  login: (t: string, u: User) => void
  logout: () => void
}
const AuthCtx = createContext<Ctx>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [user, setUser] = useState<User>(
    localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
  )

  const login = (t: string, u: User) => {
    setToken(t)
    setUser(u)
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
  }
  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  // token yo'q bo'lsa userni ham tozalash
  useEffect(() => {
    if (!localStorage.getItem('token')) {
      setUser(null)
    }
  }, [])

  return (
    <AuthCtx.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)

// himoya: token bo'lmasa login sahifaga yo'naltiradi
import { Navigate } from 'react-router-dom'
export function RequireAuth({ children }: { children: JSX.Element }) {
  const { token } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  return children
}

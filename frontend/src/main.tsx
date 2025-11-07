// frontend/src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate,
    Link,
    useNavigate,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider, RequireAuth, useAuth } from './auth'
import Login from './pages/Login'
import Orders from './pages/Orders'
import NewOrder from './pages/NewOrder'
import Upload from './pages/Upload'
import './index.css'
import VerifyCreate from './pages/VerifyCreate'
import VerifyView from './pages/VerifyView'
import OrderVerify from './pages/OrderVerify'
import Stats from './pages/Stats'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import NotificationBell from './components/NotificationBell'
import { NotificationsProvider } from './notifications'

const qc = new QueryClient()

function Header() {
    const { user, logout, token } = useAuth()
    const navigate = useNavigate()

    const onLogout = () => {
        logout()
        navigate('/login', { replace: true })
    }

    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
                <span className="text-3xl font-semibold">Lingua Translation CRM system</span>

                {token && (
                    <>
                        {/* Dashboard — скрыт для staff */}
                        {user?.role !== 'staff' && <Link to="/dashboard">Dashboard</Link>}

                        <Link to="/orders">Buyurtmalar</Link>
                        <Link to="/orders/new">Yangi buyurtma</Link>
                        <Link to="/stats">Hisobot</Link>

                        {/* только для admin */}
                        {user?.role === 'admin' && <Link to="/employees">Xodimlar</Link>}
                    </>
                )}
            </div>

            <div className="flex items-center gap-3">
                {!token ? (
                    <Link
                        to="/login"
                        className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded text-white"
                    >
                        Login
                    </Link>
                ) : (
                    <>
                        <NotificationBell />
                        <span className="text-sm text-gray-600">
                            {user?.name} ({user?.role})
                        </span>
                        <button onClick={onLogout}>Chiqish</button>
                    </>
                )}
            </div>
        </div>
    )
}

function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <Header />
            <div className="card">{children}</div>
        </div>
    )
}

/* Ограничитель по ролям: если нет доступа — уводим на домашний роут,
   чтобы не было белого экрана/циклов */
function RequireRole({ roles, children }: { roles: string[]; children: JSX.Element }) {
    const { user } = useAuth()
    if (!user || !roles.includes(user.role)) {
        return <Navigate to="/" replace />
    }
    return children
}

/* Запрет только для staff (удобно для /dashboard) */
function RequireNotStaff({ children }: { children: JSX.Element }) {
    const { user } = useAuth()
    if (user?.role === 'staff') return <Navigate to="/orders" replace />
    return children
}

/* Домашний редирект: staff → /orders, остальные → /dashboard */
function HomeRedirect() {
    const { user } = useAuth()
    if (!user) return <Navigate to="/login" replace />
    return <Navigate to={user.role === 'staff' ? '/orders' : '/dashboard'} replace />
}

function App() {
    return (
        <Routes>
            {/* Login — без защиты */}
            <Route
                path="/login"
                element={
                    <Layout>
                        <Login />
                    </Layout>
                }
            />

            {/* Verify — публичные */}
            <Route
                path="/verify/create"
                element={
                    <Layout>
                        <VerifyCreate />
                    </Layout>
                }
            />
            <Route
                path="/verify/:public_id"
                element={
                    <Layout>
                        <VerifyView />
                    </Layout>
                }
            />

            {/* Защищённые страницы */}
            <Route
                path="/orders"
                element={
                    <RequireAuth>
                        <Layout>
                            <Orders />
                        </Layout>
                    </RequireAuth>
                }
            />
            <Route
                path="/orders/new"
                element={
                    <RequireAuth>
                        <Layout>
                            <NewOrder />
                        </Layout>
                    </RequireAuth>
                }
            />
            <Route
                path="/orders/:id/verify"
                element={
                    <RequireAuth>
                        <Layout>
                            <OrderVerify />
                        </Layout>
                    </RequireAuth>
                }
            />
            <Route
                path="/orders/:id/upload"
                element={
                    <RequireAuth>
                        <Layout>
                            <Upload />
                        </Layout>
                    </RequireAuth>
                }
            />

            <Route
                path="/stats"
                element={
                    <RequireAuth>
                        <Layout>
                            <Stats />
                        </Layout>
                    </RequireAuth>
                }
            />

            <Route
                path="/dashboard"
                element={
                    <RequireAuth>
                        <RequireNotStaff>
                            <Layout>
                                <Dashboard />
                            </Layout>
                        </RequireNotStaff>
                    </RequireAuth>
                }
            />

            <Route
                path="/employees"
                element=
                {
                    <RequireAuth>
                        <RequireRole roles={['admin']}>
                            <Layout>
                                <Employees />
                            </Layout>
                        </RequireRole>
                    </RequireAuth>
                }
            />

            {/* Домашний и дефолтные редиректы */}
            <Route
                path="/"
                element={
                    <RequireAuth>
                        <HomeRedirect />
                    </RequireAuth>
                }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={qc}>
            <AuthProvider>
                <NotificationsProvider>
                    <BrowserRouter>
                        <App />
                    </BrowserRouter>
                </NotificationsProvider>
            </AuthProvider>
        </QueryClientProvider>
    </StrictMode>
)

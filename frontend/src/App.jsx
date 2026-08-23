import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import ComingSoon from '@/pages/ComingSoon'
import Customers from '@/pages/Customers'
import Dashboard from '@/pages/Dashboard'
import KOTScreen from '@/pages/KOTScreen'
import Login from '@/pages/Login'
import MenuManagement from '@/pages/MenuManagement'
import NotFound from '@/pages/NotFound'
import OrderHistory from '@/pages/OrderHistory'
import POS from '@/pages/POS'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import Tables from '@/pages/Tables'
import Coupons from '@/pages/Coupons'
import Feedback from '@/pages/Feedback'
import WhatsApp from '@/pages/WhatsApp'
import { hasPermission } from '@/utils/roles'

// Rebill Application Root - CI/CD & Docker Pipeline Test
export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/feedback/:token" element={<Feedback />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                {/* Each route guards itself or the Layout hides it if permission is missing, but ProtectedRoute can also check */}
                <Route index element={<ProtectedRoute permission="view_dashboard"><Dashboard /></ProtectedRoute>} />
                <Route path="kot" element={<ProtectedRoute permission="view_kot"><KOTScreen /></ProtectedRoute>} />
                <Route path="menu" element={<ProtectedRoute permission="view_menu"><MenuManagement /></ProtectedRoute>} />
                <Route path="pos" element={<ProtectedRoute permission="view_pos"><POS /></ProtectedRoute>} />
                <Route path="tables" element={<ProtectedRoute permission="view_floor_map"><Tables /></ProtectedRoute>} />
                <Route path="customers" element={<ProtectedRoute permission="view_customers"><Customers /></ProtectedRoute>} />
                <Route path="orders" element={<ProtectedRoute permission="view_orders"><OrderHistory /></ProtectedRoute>} />
                <Route path="whatsapp" element={<ProtectedRoute permission="view_whatsapp"><WhatsApp /></ProtectedRoute>} />
                <Route path="coupons" element={<ProtectedRoute permission="view_coupons"><Coupons /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute permission="view_reports"><Reports /></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute permission="view_settings"><Settings /></ProtectedRoute>} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

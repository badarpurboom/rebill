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
import { ROLES } from '@/utils/roles'

const { OWNER, CASHIER } = ROLES

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/feedback/:token" element={<Feedback />} />

            {/* Any signed-in staff member */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="kot" element={<KOTScreen />} />
              </Route>
            </Route>

            {/* Owner + Cashier — the billing floor */}
            <Route element={<ProtectedRoute allow={[OWNER, CASHIER]} />}>
              <Route element={<Layout />}>
                <Route path="menu" element={<MenuManagement />} />
                <Route path="pos" element={<POS />} />
                <Route path="tables" element={<Tables />} />
                <Route path="customers" element={<Customers />} />
                <Route path="orders" element={<OrderHistory />} />
              </Route>
            </Route>

            {/* Owner only */}
            <Route element={<ProtectedRoute allow={[OWNER]} />}>
              <Route element={<Layout />}>
                <Route path="whatsapp" element={<WhatsApp />} />
                <Route path="coupons" element={<Coupons />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}

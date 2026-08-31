import { Route, Routes } from 'react-router-dom'
import { RequireAdmin } from './auth/RequireAdmin.tsx'
import { AdminBoard } from './pages/AdminBoard.tsx'
import { AdminLogin } from './pages/AdminLogin.tsx'
import { PublicBoard } from './pages/PublicBoard.tsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicBoard />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminBoard />
          </RequireAdmin>
        }
      />
    </Routes>
  )
}

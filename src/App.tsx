import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAdmin } from './auth/RequireAdmin.tsx'
import { RequireAuth } from './auth/RequireAuth.tsx'
import { CookieConsent } from './components/CookieConsent.tsx'
import { SignedInHeader } from './components/SignedInHeader.tsx'
import { useAuth } from './hooks/useAuth.ts'
import { AdminBoard } from './pages/AdminBoard.tsx'
import { AdminContact } from './pages/AdminContact.tsx'
import { AdminLogin } from './pages/AdminLogin.tsx'
import { AdminNetwork } from './pages/AdminNetwork.tsx'
import { AdminAffiliates } from './pages/AdminAffiliates.tsx'
import { LegalPage } from './pages/LegalPage.tsx'
import { Login } from './pages/Login.tsx'
import { Me } from './pages/Me.tsx'
import { AccountSettings } from './pages/AccountSettings.tsx'
import { NetworkHome } from './pages/NetworkHome.tsx'
import { PublicBoard } from './pages/PublicBoard.tsx'
import { SiteContentPage } from './pages/SiteContentPage.tsx'
import { UserBoardPage } from './pages/UserBoard.tsx'
import { UserProfile } from './pages/UserProfile.tsx'

export default function App() {
  const location = useLocation()
  const auth = useAuth()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const showAccountBar = Boolean(auth.session) && !isAdminRoute

  useEffect(() => {
    document.title = 'typology network'
    document.body.classList.toggle('is-network', location.pathname.startsWith('/network'))
    document.body.classList.toggle('has-account-bar', showAccountBar)
    return () => {
      document.body.classList.remove('is-network')
      document.body.classList.remove('has-account-bar')
    }
  }, [location.pathname, showAccountBar])

  return (
    <>
      {showAccountBar ? <SignedInHeader /> : null}
      <Routes>
        <Route path="/" element={<PublicBoard />} />
        <Route path="/login" element={<Login />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="/network/terms" element={<Navigate to="/terms" replace />} />
        <Route path="/network/privacy" element={<Navigate to="/privacy" replace />} />
        <Route
          path="/me"
          element={
            <RequireAuth>
              <Me />
            </RequireAuth>
          }
        />
        <Route
          path="/me/settings"
          element={
            <RequireAuth>
              <AccountSettings />
            </RequireAuth>
          }
        />
        <Route path="/u/:username" element={<UserProfile />} />
        <Route path="/u/:username/:slug" element={<UserBoardPage />} />
        <Route path="/s/:token" element={<UserBoardPage />} />
        <Route path="/network" element={<NetworkHome />} />
        <Route path="/network/about" element={<SiteContentPage slug="about" />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminBoard />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/network"
          element={
            <RequireAdmin>
              <AdminNetwork />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/contact"
          element={
            <RequireAdmin>
              <AdminContact />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/affiliates"
          element={
            <RequireAdmin>
              <AdminAffiliates />
            </RequireAdmin>
          }
        />
      </Routes>
      <CookieConsent />
    </>
  )
}

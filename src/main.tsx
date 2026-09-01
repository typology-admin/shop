import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { SiteSettingsProvider } from './hooks/useSiteSettings.ts'
import App from './App.tsx'
import './styles/global.css'
import './styles/network.css'
import './styles/affiliates.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SiteSettingsProvider>
          <App />
        </SiteSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

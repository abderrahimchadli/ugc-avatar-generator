import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { ThemeProvider } from './context/theme'
import { AuthProvider, useAuth } from './context/auth'
import { PackageProvider } from './context/packageStore'
import { StoreProvider } from './store'
import { silentRefreshHFToken } from './utils/higgsfieldAuth'
import Nav from './components/Nav'
import Home from './pages/Home'
import Login from './pages/Login'
import WaitingApproval from './pages/WaitingApproval'
import Packages from './pages/Packages'
import PromptBuilder from './pages/PromptBuilder'
import Library from './pages/Library'
import Settings from './pages/Settings'
import AuthCallback from './pages/AuthCallback'
import ExtensionImport from './pages/ExtensionImport'
import AdminUsers from './pages/AdminUsers'
import ExtensionSetup from './pages/ExtensionSetup'
import { loginPathForReturn } from './utils/navigation'

const Landing = lazy(() => import('./pages/Landing'))
const Influencers = lazy(() => import('./pages/Influencers'))
const Inspiration = lazy(() => import('./pages/Inspiration'))
const BrandDeals = lazy(() => import('./pages/BrandDeals'))
const Create = lazy(() => import('./pages/Create'))
const WeeklyJobs = lazy(() => import('./pages/WeeklyJobs'))

function PageFallback() {
  return <main className="page-shell"><section className="panel"><h1>Loading…</h1></section></main>
}

function RequireApproved({ children }) {
  const { loading, profile, isApproved } = useAuth()
  const location = useLocation()
  if (loading) return <PageFallback />
  if (!profile) return <Navigate to={loginPathForReturn(location.pathname, location.search)} replace />
  if (!isApproved) return <Navigate to="/waiting-approval" replace />
  return children
}

function RequireApprovedLazy({ children }) {
  return (
    <RequireApproved>
      <Suspense fallback={<PageFallback />}>
        {children}
      </Suspense>
    </RequireApproved>
  )
}

function AppRoutes() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<RequireApproved><Home /></RequireApproved>} />
        <Route path="/login" element={<Login />} />
        <Route path="/waiting-approval" element={<WaitingApproval />} />
        <Route path="/avatars" element={<RequireApproved><Packages type="avatar" /></RequireApproved>} />
        <Route path="/products" element={<RequireApproved><Packages type="product" /></RequireApproved>} />
        <Route path="/prompt-builder" element={<RequireApproved><PromptBuilder /></RequireApproved>} />
        <Route path="/library" element={<RequireApproved><Library /></RequireApproved>} />
        <Route path="/extension" element={<RequireApproved><ExtensionSetup /></RequireApproved>} />
        <Route path="/users" element={<RequireApproved><AdminUsers /></RequireApproved>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/extension-import" element={<RequireApproved><ExtensionImport /></RequireApproved>} />
        <Route path="/weekly-jobs" element={<RequireApprovedLazy><WeeklyJobs /></RequireApprovedLazy>} />
        <Route path="/studio" element={<RequireApprovedLazy><Landing /></RequireApprovedLazy>} />
        <Route path="/influencers" element={<RequireApprovedLazy><Influencers /></RequireApprovedLazy>} />
        <Route path="/inspiration" element={<RequireApprovedLazy><Inspiration /></RequireApprovedLazy>} />
        <Route path="/brand-deals" element={<RequireApprovedLazy><BrandDeals /></RequireApprovedLazy>} />
        <Route path="/create" element={<RequireApprovedLazy><Create /></RequireApprovedLazy>} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
    </>
  )
}

export default function App() {
  useEffect(() => {
    silentRefreshHFToken()
    function onVisible() {
      if (document.visibilityState === 'visible') silentRefreshHFToken()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <PackageProvider>
          <StoreProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </StoreProvider>
        </PackageProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

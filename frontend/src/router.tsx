import {
  createRoute,
  createRootRoute,
  createRouter,
  Outlet,
  Link,
} from '@tanstack/react-router'
import React, { Suspense, lazy, useState } from 'react'
import { useAuth } from './context/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AssistantWidget } from './components/AssistantWidget'
import { SkeletonCard } from './components/Skeleton'
import { Home, UploadCloud, Activity, User, Settings, FileText, Menu, X, Lock } from 'lucide-react'
import { AccessibilityPopover } from './components/AccessibilityPopover'
import { NavDrawer } from './components/NavDrawer'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from './components/LanguageSwitcher'


// Lazy-loaded pages — each becomes its own JS chunk
const LandingPage   = lazy(() => import('./pages/Landing/index').then(m => ({ default: m.LandingPage })))
const AuthPage      = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })))
const ConsentPage   = lazy(() => import('./pages/ConsentPage').then(m => ({ default: m.ConsentPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const UploadPage    = lazy(() => import('./pages/UploadPage').then(m => ({ default: m.UploadPage })))
const ProcessingPage = lazy(() => import('./pages/ProcessingPage').then(m => ({ default: m.ProcessingPage })))
const ResultsPage   = lazy(() => import('./pages/Results/index').then(m => ({ default: m.ResultsPage })))
const ProfilePage   = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })))
const NotFoundPage  = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))
const TrendsPage    = lazy(() => import('./pages/TrendsPage').then(m => ({ default: m.TrendsPage })))
const SharedResultPage = lazy(() => import('./pages/SharedResultPage').then(m => ({ default: m.SharedResultPage })))

/** Generic page-level loading skeleton */
const PageSkeleton = () => (
  <div className="py-8 px-4 max-w-7xl mx-auto space-y-6 animate-pulse" aria-label="Loading page..." aria-busy="true">
    <div className="h-10 w-64 bg-slate-200 dark:bg-slate-800 rounded-full" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  </div>
)

/** Wrap a lazy page with Suspense + ErrorBoundary */
const Page = ({ children }: { children: React.ReactNode }) => (
  <ErrorBoundary>
    <Suspense fallback={<PageSkeleton />}>
      {children}
    </Suspense>
  </ErrorBoundary>
)


const RootLayout = () => {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [isAccessPopoverOpen, setIsAccessPopoverOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isAuthRoute = ['/dashboard', '/upload', '/trends', '/profile', '/results', '/processing'].some(
    path => window.location.pathname.startsWith(path)
  )

  // If user is authenticated and on an auth page, show sidebar shell
  if (user && isAuthRoute) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground transition-colors duration-200">
        {/* Mobile Header */}
        <header className="md:hidden border-b border-border bg-card/90 backdrop-blur px-6 py-4.5 flex justify-between items-center z-40 sticky top-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary flex items-center justify-center text-white shrink-0 shadow-sm">
              <FileText className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black font-serif text-foreground tracking-tight">MedDecode</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-foreground focus:outline-none hover:bg-muted rounded-full cursor-pointer transition-all"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        <NavDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

        {/* Desktop Left Sidebar */}
        <aside className="hidden md:flex md:w-64 flex-col bg-card border-r border-border min-h-screen sticky top-0 self-start z-30 justify-between shrink-0">
          <div className="p-6 space-y-8">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shrink-0 shadow-sm">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xl font-black font-serif tracking-tight text-foreground">MedDecode</span>
            </div>

            {/* Nav List */}
            <nav className="flex flex-col space-y-2">
              <Link
                to="/dashboard"
                className="flex items-center gap-3.5 px-4 py-3 rounded-xl font-extrabold text-xs text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] transition-all"
                activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-black" }}
              >
                <Home className="w-4 h-4" />
                <span>{t('nav.dashboard')}</span>
              </Link>
              <Link
                to="/upload"
                className="flex items-center gap-3.5 px-4 py-3 rounded-xl font-extrabold text-xs text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] transition-all"
                activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-black" }}
              >
                <UploadCloud className="w-4 h-4" />
                <span>{t('nav.newAnalysis')}</span>
              </Link>
              <Link
                to="/trends"
                className="flex items-center gap-3.5 px-4 py-3 rounded-xl font-extrabold text-xs text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] transition-all"
                activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-black" }}
              >
                <Activity className="w-4 h-4" />
                <span>{t('nav.healthTrends')}</span>
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-3.5 px-4 py-3 rounded-xl font-extrabold text-xs text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98] transition-all"
                activeProps={{ className: "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-black" }}
              >
                <User className="w-4 h-4" />
                <span>{t('nav.settings')}</span>
              </Link>
            </nav>
          </div>

          {/* Accessibility entry at bottom */}
          <div className="p-6 border-t border-border relative">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Settings</span>
              <div className="flex items-center gap-2">
                <LanguageSwitcher />
                <button
                  onClick={() => setIsAccessPopoverOpen(!isAccessPopoverOpen)}
                  className="w-8 h-8 rounded-full bg-secondary hover:bg-muted border border-border flex items-center justify-center text-foreground cursor-pointer transition-all shadow-sm"
                  aria-label="Open Reading Preferences"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Consolidated Popover */}
            <AccessibilityPopover
              isOpen={isAccessPopoverOpen}
              onClose={() => setIsAccessPopoverOpen(false)}
            />
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 w-full p-6 md:p-8 overflow-y-auto" role="main" id="main-content">
          <Outlet />
        </main>

        <AssistantWidget />
      </div>
    )
  }


  // ----------------------------------------------------
  // PUBLIC LAYOUT (LandingPage, AuthPage, ConsentPage, etc.)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40" role="banner">
        <div className="max-w-6xl mx-auto px-6 py-5.5 flex justify-between items-center">
          <Link to="/" className="hover:opacity-90 flex items-center gap-3.5 text-left" aria-label="MedDecode AI — Home">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-serif font-black text-lg shrink-0 shadow-sm">
              M
            </div>
            <span className="text-2xl font-serif font-black text-foreground leading-tight tracking-tight">MedDecode</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <LanguageSwitcher />

            <Link
              to="/auth"
              className="bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-black hover:opacity-95 transition-all shadow-sm"
            >
              {t('nav.getStarted')}
            </Link>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 text-foreground focus:outline-none hover:bg-muted rounded-full cursor-pointer transition-all"
              aria-label="Open Menu"
            >
              <Menu className="w-7 h-7" />
            </button>
          </div>
        </div>
      </header>
      <NavDrawer isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Main */}
      <main className="flex-1 w-full" role="main" id="main-content">
        <Outlet />
      </main>


      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border py-10 md:py-12 px-6 w-full mt-auto" role="contentinfo">

        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-4 gap-10 text-left">
          {/* Logo & Brand Column */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black font-serif text-base shadow-sm">
                M
              </span>
              <span className="font-serif font-black text-lg text-foreground tracking-tight">
                MedDecode
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Translating clinical shorthand, prescriptions, and lab panels into plain, patient-friendly English instantly.
            </p>
          </div>

          {/* Links Column 1 */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground font-mono">Product</h4>
            <ul className="space-y-2 text-xs font-semibold text-muted-foreground list-none pl-0">
              <li>
                <Link to="/upload" className="hover:text-primary transition-all">Upload Document</Link>
              </li>
              <li>
                <Link to="/trends" className="hover:text-primary transition-all">Health Trends</Link>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-default">Free Tier (10 Scans/Day)</span>
              </li>
            </ul>
          </div>

          {/* Links Column 2 */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground font-mono">Resources</h4>
            <ul className="space-y-2 text-xs font-semibold text-muted-foreground list-none pl-0">
              <li>
                <a href="#faq" className="hover:text-primary transition-all">Common Questions</a>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-default">Secure Sandbox</span>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-default">OCR Engine 3</span>
              </li>
            </ul>
          </div>

          {/* Links Column 3 */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-foreground font-mono">Legal &amp; Compliance</h4>
            <ul className="space-y-2 text-xs font-semibold text-muted-foreground list-none pl-0">
              <li>
                <span className="text-muted-foreground/60 cursor-default">GDPR Right to be Forgotten</span>
              </li>
              <li>
                <Link to="/profile" className="hover:text-primary transition-all">DPDP Data Rights</Link>
              </li>
              <li>
                <span className="text-muted-foreground/60 cursor-default">Patient Disclaimers</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="max-w-6xl mx-auto w-full border-t border-border mt-12 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold text-muted-foreground">
          <div>
            © {new Date().getFullYear()} MedDecode. Built for patient transparency &amp; health education.
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-primary animate-pulse" />
            <span>Secure Sandboxed Environment</span>
          </div>
        </div>
      </footer>
      <AssistantWidget />
    </div>
  )
}


const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <Page><LandingPage /></Page>,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: () => <Page><AuthPage /></Page>,
})

const consentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/consent',
  component: () => <Page><ConsentPage /></Page>,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: () => <Page><DashboardPage /></Page>,
})

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upload',
  component: () => <Page><UploadPage /></Page>,
})

const processingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/processing',
  component: () => <Page><ProcessingPage /></Page>,
})

const resultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/results',
  component: () => <Page><ResultsPage /></Page>,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => <Page><ProfilePage /></Page>,
})

const trendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/trends',
  component: () => <Page><TrendsPage /></Page>,
})

const sharedResultRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/share/$token',
  component: () => <Page><SharedResultPage /></Page>,
})

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: () => <Page><NotFoundPage /></Page>,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  consentRoute,
  dashboardRoute,
  uploadRoute,
  processingRoute,
  resultsRoute,
  profileRoute,
  trendsRoute,
  sharedResultRoute,
  notFoundRoute,
])


export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

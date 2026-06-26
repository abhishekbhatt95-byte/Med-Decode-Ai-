import {
  createRoute,
  createRootRoute,
  createRouter,
  Outlet,
  Link,
  useNavigate,
} from '@tanstack/react-router'
import { useAuth } from './context/AuthContext'
import { useAccessibility } from './context/AccessibilityContext'
import { LandingPage } from './pages/LandingPage'
import { AuthPage } from './pages/AuthPage'
import { ConsentPage } from './pages/ConsentPage'
import { DashboardPage } from './pages/DashboardPage'
import { UploadPage } from './pages/UploadPage'
import { ProcessingPage } from './pages/ProcessingPage'
import { ResultsPage } from './pages/ResultsPage'
import { ProfilePage } from './pages/ProfilePage'
import { NotFoundPage } from './pages/NotFoundPage'

// Global Root Layout Component
const RootLayout = () => {
  const { user, signOut } = useAuth()
  const { largeText, highContrast, darkMode, setLargeText, setHighContrast, setDarkMode } = useAccessibility()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
      {/* Accessibility Floating Control Bar */}
      <div className="bg-muted border-b border-border px-4 py-2 text-xs md:text-sm flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-muted-foreground">Accessibility Controls:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setLargeText(!largeText)}
            className={`px-3 py-1 rounded border border-border font-medium cursor-pointer transition-all ${
              largeText ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            }`}
            aria-label="Toggle Large Text Mode"
          >
            A+ Large Text: {largeText ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setHighContrast(!highContrast)}
            className={`px-3 py-1 rounded border border-border font-medium cursor-pointer transition-all ${
              highContrast ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            }`}
            aria-label="Toggle High Contrast Mode"
          >
            Contrast: {highContrast ? 'HIGH' : 'NORMAL'}
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`px-3 py-1 rounded border border-border font-medium cursor-pointer transition-all ${
              darkMode ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'
            }`}
            aria-label="Toggle Dark Mode"
          >
            Theme: {darkMode ? 'DARK' : 'LIGHT'}
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold text-foreground hover:opacity-90 flex items-center gap-2">
            <span className="text-primary text-3xl">⚕️</span> MedDecode AI
          </Link>
          
          <nav className="flex items-center gap-6">
            {user ? (
              <>
                <Link to="/dashboard" className="font-medium text-muted-foreground hover:text-foreground transition-all">
                  Dashboard
                </Link>
                <Link to="/upload" className="font-medium text-muted-foreground hover:text-foreground transition-all">
                  Upload
                </Link>
                <Link to="/profile" className="font-medium text-muted-foreground hover:text-foreground transition-all">
                  Profile
                </Link>
                <button
                  onClick={async () => {
                    await signOut()
                    navigate({ to: '/' })
                  }}
                  className="bg-secondary text-secondary-foreground border border-border px-4 py-2 rounded-lg hover:bg-muted font-semibold transition-all cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/upload" className="font-medium text-muted-foreground hover:text-foreground transition-all">
                  Upload
                </Link>
                <Link
                  to="/auth"
                  className="bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold hover:opacity-95 transition-all"
                >
                  Sign In / Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Trust & Transparency Footer */}
      <footer className="border-t border-border bg-card/30 py-12 px-4 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
          <div className="max-w-md">
            <h3 className="text-lg font-bold mb-2">MedDecode AI</h3>
            <p className="text-sm text-muted-foreground">
              An educational platform explaining complex medical documents in plain language. Strictly non-diagnostic and does not replace professional medical advice.
            </p>
          </div>
          <div className="flex flex-col gap-3 items-center md:items-end">
            <div className="flex flex-wrap justify-center gap-4 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-full">
                🔒 Encrypted & Secure
              </span>
              <span className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-full">
                🗑️ Delete Anytime
              </span>
              <span className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-full">
                📚 Educational AI Assistant
              </span>
              <span className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-full">
                📖 Verified Medical Sources
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} MedDecode AI. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Route Configurations
const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
})

const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth',
  component: AuthPage,
})

const consentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/consent',
  component: ConsentPage,
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
})

const uploadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/upload',
  component: UploadPage,
})

const processingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/processing',
  component: ProcessingPage,
})

const resultsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/results',
  component: ResultsPage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfilePage,
})

// Catch-all route for 404
const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '*',
  component: NotFoundPage,
})

// Build the Route Tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  authRoute,
  consentRoute,
  dashboardRoute,
  uploadRoute,
  processingRoute,
  resultsRoute,
  profileRoute,
  notFoundRoute,
])

// Create and export the Router instance
export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

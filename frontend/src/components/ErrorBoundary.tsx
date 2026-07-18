import React, { Component, type ReactNode, type ErrorInfo } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
  resetKey?: unknown  // change this value to reset the boundary
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
    this.props.onError?.(error, info)
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center"
        >
          <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
          <h2 className="text-lg font-extrabold text-slate-800 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-slate-500 font-medium mb-6 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            className="bg-primary hover:bg-primary/90 text-white font-extrabold px-5 py-2.5 rounded-full text-sm cursor-pointer transition-all shadow-sm"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/** Wrap any page/section to catch rendering errors without crashing the whole app. */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const displayName = Component.displayName || Component.name || 'Component'
  const Wrapped = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )
  Wrapped.displayName = `WithErrorBoundary(${displayName})`
  return Wrapped
}

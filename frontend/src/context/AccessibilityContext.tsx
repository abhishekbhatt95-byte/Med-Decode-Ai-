import React, { createContext, useContext, useState, useEffect } from 'react'

interface AccessibilityContextType {
  largeText: boolean
  highContrast: boolean
  darkMode: boolean
  setLargeText: (enabled: boolean) => void
  setHighContrast: (enabled: boolean) => void
  setDarkMode: (enabled: boolean) => void
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined)

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [largeText, setLargeTextState] = useState<boolean>(() => {
    return localStorage.getItem('accessibility-large-text') === 'true'
  })
  const [highContrast, setHighContrastState] = useState<boolean>(() => {
    return localStorage.getItem('accessibility-high-contrast') === 'true'
  })
  const [darkMode, setDarkModeState] = useState<boolean>(() => {
    return localStorage.getItem('accessibility-dark-mode') === 'true'
  })

  const setLargeText = (enabled: boolean) => {
    setLargeTextState(enabled)
    localStorage.setItem('accessibility-large-text', String(enabled))
  }

  const setHighContrast = (enabled: boolean) => {
    setHighContrastState(enabled)
    localStorage.setItem('accessibility-high-contrast', String(enabled))
  }

  const setDarkMode = (enabled: boolean) => {
    setDarkModeState(enabled)
    localStorage.setItem('accessibility-dark-mode', String(enabled))
  }

  useEffect(() => {
    const root = document.documentElement
    
    // Large Text class
    if (largeText) {
      root.classList.add('accessibility-large-text')
    } else {
      root.classList.remove('accessibility-large-text')
    }

    // High Contrast class
    if (highContrast) {
      root.classList.add('accessibility-high-contrast')
    } else {
      root.classList.remove('accessibility-high-contrast')
    }

    // Dark Mode class
    if (darkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [largeText, highContrast, darkMode])

  return (
    <AccessibilityContext.Provider
      value={{
        largeText,
        highContrast,
        darkMode,
        setLargeText,
        setHighContrast,
        setDarkMode,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  )
}

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider')
  }
  return context
}

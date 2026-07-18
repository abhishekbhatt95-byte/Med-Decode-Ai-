import React from 'react'
import { useTranslation } from 'react-i18next'

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation()
  const currentLang = i18n.language || 'en'

  const toggleLanguage = () => {
    const newLang = currentLang === 'en' ? 'hi' : 'en'
    i18n.changeLanguage(newLang)
    localStorage.setItem('meddecode_language', newLang)
  }

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center bg-secondary hover:bg-muted border border-border px-4.5 py-2 rounded-full text-sm font-black select-none cursor-pointer transition-all active:scale-[0.98] shrink-0"
      aria-label="Toggle Language / भाषा बदलें"
    >
      <span className={currentLang === 'en' ? 'text-primary font-black' : 'text-muted-foreground/75'}>EN</span>
      <span className="text-border/60 mx-2 text-[10px]">|</span>
      <span className={currentLang === 'hi' ? 'text-primary font-black' : 'text-muted-foreground/75'}>हिं</span>
    </button>
  )

}

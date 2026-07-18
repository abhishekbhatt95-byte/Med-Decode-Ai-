import React from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const CTASection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="bg-foreground text-background py-12 md:py-14 px-6 w-full border-t border-border relative overflow-hidden">
      {/* Subtle glowing radial background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto w-full text-center space-y-8 relative z-10">
        <h2 className="text-3xl md:text-5xl font-black text-background tracking-tight leading-none font-serif">
          {t('landing.ctaTitle')}
        </h2>
        <p className="text-slate-400 font-medium max-w-lg mx-auto text-sm md:text-base">
          {t('landing.ctaSub')}
        </p>

        <div className="pt-4 flex flex-wrap justify-center gap-4">
          <Link
            to="/upload"
            className="bg-primary hover:opacity-90 text-primary-foreground font-extrabold px-8 py-4 rounded-full text-center shadow-lg transition-all text-sm md:text-base cursor-pointer"
          >
            {t('landing.ctaUpload')}
          </Link>
          <Link
            to="/auth"
            className="bg-transparent border-2 border-slate-600 hover:border-slate-500 text-background font-extrabold px-8 py-3.5 rounded-full text-center transition-all text-sm md:text-base cursor-pointer"
          >
            {t('landing.ctaAuth')}
          </Link>
        </div>
      </div>
    </section>
  );
};

import React from "react";
import { Link } from "@tanstack/react-router";
import {
  FileText,
  Sparkles,
  CheckCircle2,
  Lock,
  ChevronRight,
  Languages,
  Info,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export const FeaturesGrid: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      {/* 2. How It Works Section */}
      <section className="bg-card py-12 md:py-14 px-6 w-full border-b border-border">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl md:text-4xl font-black text-foreground">
              {t('landing.workflowTitle')}
            </h2>
            <p className="text-muted-foreground font-medium text-sm md:text-base">
              {t('landing.workflowSub')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-background border border-border rounded-3xl p-8 flex flex-col items-start hover:border-primary/40 transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg mb-6 font-bold group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-xl mb-3 text-foreground">
                {t('landing.stage1Title')}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                {t('landing.stage1Text')}
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-background border border-border rounded-3xl p-8 flex flex-col items-start hover:border-primary/40 transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg mb-6 font-bold group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-xl mb-3 text-foreground">
                {t('landing.stage2Title')}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                {t('landing.stage2Text')}
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-background border border-border rounded-3xl p-8 flex flex-col items-start hover:border-primary/40 transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg mb-6 font-bold group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-xl mb-3 text-foreground">
                {t('landing.stage3Title')}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                {t('landing.stage3Text')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Medical History Showcase (Dashboard Preview) */}
      <section className="bg-card py-12 md:py-14 px-6 w-full border-b border-border">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left - Visual mock showing dashboard features */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-background border border-border rounded-3xl p-6 shadow-lg max-w-md mx-auto space-y-5 relative overflow-hidden group">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <div>
                  <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">SECURE VAULT</h4>
                  <h3 className="font-black text-foreground mt-0.5">{t('dashboard.title')}</h3>
                </div>
                <div className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[9px] font-bold flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                  <span>SECURE</span>
                </div>
              </div>

              {/* Search Bar Mock */}
              <div className="relative">
                <div className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-slate-400 flex items-center gap-2 select-none shadow-sm">
                  <span>🔍</span>
                  <span>{t('dashboard.searchPlaceholder')}</span>
                </div>
              </div>

              {/* Category Pills Mock */}
              <div className="flex gap-2">
                {[t('dashboard.filterAll'), t('dashboard.filterPrescriptions'), t('dashboard.filterBlood')].map((pill, idx) => (
                  <span
                    key={idx}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold border ${
                      idx === 0
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {pill}
                  </span>
                ))}
              </div>

              {/* Sample Library Items */}
              <div className="space-y-2">
                <div className="bg-card border border-border rounded-xl p-3 flex justify-between items-center text-xs shadow-sm">
                  <div className="flex items-center gap-2">
                    <span>📄</span>
                    <div>
                      <span className="font-bold text-foreground">lipids_metro_labs.pdf</span>
                      <span className="text-[9px] text-slate-400 block">Uploaded 2 hours ago</span>
                    </div>
                  </div>
                  <span className="bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0">
                    Ready
                  </span>
                </div>
                <div className="bg-card border border-border rounded-xl p-3 flex justify-between items-center text-xs shadow-sm">
                  <div className="flex items-center gap-2">
                    <span>📄</span>
                    <div>
                      <span className="font-bold text-foreground">amoxicillin_st_jude.jpg</span>
                      <span className="text-[9px] text-slate-400 block">Uploaded yesterday</span>
                    </div>
                  </div>
                  <span className="bg-green-500/10 text-green-600 border border-green-500/20 px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0">
                    Ready
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Value Proposition & Link */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              <span>{t('landing.privateBadge')}</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-foreground leading-tight tracking-tight font-serif">
              {t('landing.vaultTitle')}
            </h2>

            <p className="text-muted-foreground font-medium leading-relaxed">
              {t('landing.vaultText')}
            </p>

            <div className="pt-2">
              <Link
                to="/dashboard"
                className="bg-primary hover:opacity-90 active:scale-[0.98] text-primary-foreground font-extrabold px-6 py-3.5 rounded-full text-center shadow-md transition-all text-sm md:text-base cursor-pointer inline-flex items-center gap-2 group"
              >
                <span>{t('landing.dashboardBtn')}</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. English Optimization Info Section */}
      <section className="bg-background py-12 md:py-14 px-6 w-full border-b border-border">
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column - Details */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
              <Languages className="w-3.5 h-3.5" />
              <span>{t('landing.standardsBadge')}</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-black text-foreground leading-tight tracking-tight font-serif">
              {t('landing.standardsTitle')}
            </h2>

            <p className="text-muted-foreground font-medium leading-relaxed">
              {t('landing.standardsText')}
            </p>

            <div className="flex items-start gap-3 bg-card border border-border p-4 rounded-2xl">
              <Info className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t('landing.standardsTip')}
              </p>
            </div>
          </div>

          {/* Right Column - Languages Visual Card */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-[340px] aspect-[4/3] bg-card border border-border rounded-3xl p-8 shadow-md hover:shadow-xl hover:border-primary/30 transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col justify-between group cursor-default select-none">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                  {t('landing.ocrLabel')}
                </span>
                <h3 className="text-6xl font-black text-primary mt-4 font-serif group-hover:scale-105 transition-transform origin-left">
                  {t('landing.ocrLang')}
                </h3>
              </div>
              <div className="border-t border-border/80 pt-4 flex justify-between items-center text-xs font-bold text-slate-400">
                <span className="font-mono">ENG / US</span>
                <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[10px]">
                  {t('landing.ocrActive')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

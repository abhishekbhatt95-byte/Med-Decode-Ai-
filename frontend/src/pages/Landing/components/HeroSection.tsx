import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Sparkles,
  CheckCircle2,
  Activity,
  Shield,
  Check,
  Pill,
  Beaker,
  Receipt,
  ClipboardList,
  Tag,
  Info,
} from "lucide-react";
import { SAMPLE_DOCUMENTS, type SampleDocument } from "../../../utils/sampleData";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

export const HeroSection: React.FC = () => {
  const { t } = useTranslation();

  // Interactive sample document state
  const [selectedSampleId, setSelectedSampleId] = useState<string>(SAMPLE_DOCUMENTS[0].id);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodedResult, setDecodedResult] = useState<SampleDocument | null>(null);

  const activeSample = SAMPLE_DOCUMENTS.find((s) => s.id === selectedSampleId) || SAMPLE_DOCUMENTS[0];

  const handleDecodeSample = () => {
    setIsDecoding(true);
    setDecodedResult(null);
    setTimeout(() => {
      setIsDecoding(false);
      setDecodedResult(activeSample);
    }, 1200);
  };

  const handleSampleTabChange = (id: string) => {
    setSelectedSampleId(id);
    setDecodedResult(null);
    setIsDecoding(false);
  };

  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'en';

  const setLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('meddecode_language', lang);
  };

  const supportingTags = ["CARE", "SECURE", "MEDICAL", "HELP", "DOCUMENTS"];

  const prescriptionItems = [
    { name: "LISINOPRIL 20mg daily", verified: true },
    { name: "SIMVASTATIN 40mg nightly", verified: true },
    { name: "VITAMIN D3 2000IU daily", verified: true },
    { name: "LISINOPRIL 20mg daily", verified: true },
    { name: "VITAMIN D3 20mg daily", verified: true },
  ];

  const supportedDocumentTypes = [
    {
      title: "Prescriptions",
      description: "Medication names, dosage instructions, and schedules.",
      badge: "Core Support",
      icon: Pill,
    },
    {
      title: "Blood Reports",
      description: "Lab values, reference ranges, and tested panels.",
      badge: "Core Support",
      icon: Beaker,
    },
    {
      title: "Hospital Bills",
      description: "Charges, invoice items, and insurance-related details.",
      badge: "Core Support",
      icon: Receipt,
    },
    {
      title: "Discharge Summaries",
      description: "Diagnoses documented in the record, treatments, and discharge instructions.",
      badge: "Core Support",
      icon: ClipboardList,
    },
    {
      title: "Medicine Labels",
      description: "Medicine instructions, warnings, and intake guidance.",
      badge: "Core Support",
      icon: Tag,
    },
  ];

  return (
    <>
      {/* 1. Simple Static Hero Section */}
      <section className="relative bg-background border-b border-border pt-6 sm:pt-8 md:pt-10 pb-12 sm:pb-16 md:pb-20 w-full overflow-hidden">
        {/* Subtle decorative background gradient */}
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-primary/5 via-primary/2 to-transparent pointer-events-none" />

        <div className="w-[92%] max-w-[1560px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_350px] xl:grid-cols-[1fr_360px] gap-8 lg:gap-12 xl:gap-16 items-start relative z-10">
          {/* Main Hero Content (Left-aligned, perfectly flush with navbar logo vertical line) */}
          <div className="space-y-6 sm:space-y-7 text-left flex flex-col items-start w-full">
            {/* Small trust label */}
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              <span>PRIVATE &amp; SECURE</span>
            </div>

            {/* Main headline: Editorial serif, 64-76px on large desktop, wraps into 2 lines on wide screens */}
            <h1 className="text-[2.5rem] sm:text-[3.25rem] md:text-[3.75rem] lg:text-[clamp(3.75rem,4.2vw,4.75rem)] font-black text-foreground font-serif tracking-tight leading-[1.0] text-left">
              Understand your medical documents,<br className="hidden lg:inline" /> without the confusion.
            </h1>

            {/* Supporting text: 19-21px desktop readability with comfortable gap */}
            <p className="text-base sm:text-lg md:text-[1.2rem] text-muted-foreground leading-relaxed max-w-2xl font-medium pt-1">
              Upload prescriptions, blood reports, hospital bills, discharge summaries, and medicine labels. Get clear, simple explanations of complex medical information.
            </p>

            {/* CTA Buttons: prominent GET STARTED & secondary LEARN MORE */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4 pt-2 w-full sm:w-auto">
              <Link
                to="/upload"
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black px-8 py-4 rounded-full text-center shadow-md hover:shadow-lg transition-all duration-200 text-sm sm:text-base cursor-pointer tracking-wider uppercase inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-[0.99]"
              >
                GET STARTED
              </Link>

              <a
                href="#supported-docs"
                onClick={(e) => {
                  const el = document.getElementById("supported-docs");
                  if (el) {
                    e.preventDefault();
                    el.scrollIntoView({ behavior: "smooth" });
                  }
                }}
                className="w-full sm:w-auto bg-card hover:bg-muted/70 text-foreground border border-border font-black px-8 py-4 rounded-full text-center shadow-sm hover:shadow transition-all duration-200 text-sm sm:text-base cursor-pointer tracking-wider uppercase inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 active:scale-[0.99]"
              >
                LEARN MORE
              </a>
            </div>

            {/* Small supporting tags */}
            <div className="pt-2 flex flex-wrap items-center justify-start gap-2 text-xs">
              {supportingTags.map((tag, idx) => (
                <React.Fragment key={tag}>
                  <span className="font-mono font-bold tracking-widest text-muted-foreground text-[11px] sm:text-xs">
                    {tag}
                  </span>
                  {idx < supportingTags.length - 1 && (
                    <span className="text-border text-xs select-none">|</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Recreated lightweight HTML/CSS Prescription Card (Secondary to headline, right side on desktop) */}
          <div className="flex justify-start lg:justify-end w-full pt-4 lg:pt-1">
            <div className="w-full max-w-[340px] sm:max-w-[360px] bg-card rounded-2xl border border-border shadow-lg overflow-hidden flex flex-col transition-all duration-200 hover:shadow-xl">
              {/* Card Header Banner */}
              <div className="bg-[#0F6E56] text-white px-5 py-3.5 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-widest font-mono">
                  PRESCRIPTION SUMMARY
                </span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                  Rx Decoded
                </span>
              </div>

              {/* Patient Info */}
              <div className="p-5 space-y-4">
                <div className="border-b border-border/80 pb-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    PATIENT NAME
                  </div>
                  <div className="text-base sm:text-lg font-serif font-black text-foreground mt-0.5">
                    EVELYN REED
                  </div>
                </div>

                {/* Prescription List items */}
                <div className="space-y-2.5">
                  {prescriptionItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-secondary/40 border border-border/50 text-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded border border-primary/40 bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="font-medium tracking-tight font-mono text-[11px] sm:text-xs">
                          {item.name}
                        </span>
                      </div>
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1.5" />
                    </div>
                  ))}
                </div>

                {/* Card Footer Stamp */}
                <div className="pt-3 border-t border-border flex items-center justify-center gap-2 text-[11px] font-bold font-mono tracking-wider text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>VERIFIED &amp; SECURE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. What can MedDecode help you understand? - Supported Document Types Section */}
      <section id="supported-docs" className="bg-background py-16 md:py-20 w-full border-b border-border scroll-mt-6">
        <div className="w-[92%] max-w-[1560px] mx-auto space-y-12">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto space-y-3.5">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
              <span>SUPPORTED DOCUMENTS</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground font-serif tracking-tight leading-tight">
              What can MedDecode help you understand?
            </h2>
            <p className="text-muted-foreground font-medium text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
              Our secure OCR and translation engine is purpose-built to break down clinical jargon across the five most common healthcare documents.
            </p>
          </div>

          {/* 5-Card Responsive Grid: 3 columns desktop, 2 columns tablet, 1 column mobile */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
            {supportedDocumentTypes.map((doc, idx) => {
              const Icon = doc.icon;
              return (
                <div
                  key={idx}
                  tabIndex={0}
                  className="group bg-card border border-border hover:border-primary/50 focus:border-primary rounded-3xl p-7 flex flex-col justify-between shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all duration-200"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-13 h-13 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground group-focus:bg-primary group-focus:text-primary-foreground flex items-center justify-center transition-colors duration-200 shadow-sm">
                        <Icon className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <span className="text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border">
                        {doc.badge}
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black font-serif text-foreground group-hover:text-primary transition-colors duration-200">
                      {doc.title}
                    </h3>

                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed font-medium">
                      {doc.description}
                    </p>
                  </div>

                  <div className="pt-6 mt-4 border-t border-border/70 flex items-center justify-between text-xs font-mono font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                    <span>Decodes &amp; explains</span>
                    <span className="text-primary font-bold">✓ Ready</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Clear Medical Disclaimer */}
          <div className="max-w-4xl mx-auto bg-primary/5 border border-primary/20 rounded-2xl p-5 sm:p-6 flex items-start gap-4 text-left shadow-sm">
            <Info className="w-6 h-6 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-primary font-mono">
                Important Medical Notice &amp; Disclaimer
              </h4>
              <p className="text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                MedDecode AI is designed solely for educational reference and health literacy support to explain medical paperwork in plain language. <strong>It does not provide medical diagnoses, treatment instructions, or replace the clinical judgment and advice of a qualified healthcare professional.</strong> Always consult your physician or specialist for medical decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Language Selection Section */}
      <section className="relative bg-background border-b border-border py-14 px-6 w-full flex flex-col items-center justify-center overflow-hidden">
        <div className="max-w-4xl mx-auto w-full text-center space-y-8 relative z-10">
          {/* Header */}
          <div className="space-y-3 max-w-xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-black text-foreground font-serif tracking-tight leading-tight">
              {currentLang === 'hi' ? 'अपनी पसंदीदा भाषा का चयन करें' : 'Select Your Preferred Language'}
            </h3>
            <p className="text-sm text-muted-foreground font-medium">
              {currentLang === 'hi' 
                ? 'मेडिकल रिपोर्ट, डॉक्टर के पर्चे और अस्पताल के बिलों का अपनी पसंद की भाषा में अनुवाद करने के लिए नीचे दिए गए विकल्पों में से चुनें।' 
                : 'Translate doctor prescriptions, lab panel reports, and hospital bills into clear, simple language in English or Hindi.'}
            </p>
          </div>

          {/* Premium Language Cards */}
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-lg mx-auto w-full">
            <button
              onClick={() => setLanguage('en')}
              className={`w-full py-4 px-6 rounded-2xl border text-sm font-black transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                currentLang === 'en'
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                  : 'bg-card text-foreground border-border hover:bg-muted/70 hover:border-border/80'
              }`}
            >
              <div className="flex flex-col items-start text-left gap-0.5">
                <span className="font-extrabold text-base leading-none">English</span>
                <span className={`text-[10px] font-medium leading-none ${currentLang === 'en' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>Translate to English</span>
              </div>
              <span className="text-2xl">🇬🇧</span>
            </button>

            <button
              onClick={() => setLanguage('hi')}
              className={`w-full py-4 px-6 rounded-2xl border text-sm font-black transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                currentLang === 'hi'
                  ? 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/10 scale-[1.02]'
                  : 'bg-card text-foreground border-border hover:bg-muted/70 hover:border-border/80'
              }`}
            >
              <div className="flex flex-col items-start text-left gap-0.5">
                <span className="font-extrabold text-base leading-none">हिन्दी (Hindi)</span>
                <span className={`text-[10px] font-medium leading-none ${currentLang === 'hi' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>हिन्दी में अनुवाद करें</span>
              </div>
              <span className="text-2xl">🇮🇳</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Interactive Sample Documents Section */}
      <section id="interactive-demo" className="bg-background py-12 md:py-14 px-6 w-full border-b border-border scroll-mt-6">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center max-w-xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
              <Play className="w-3 h-3 fill-current" />
              <span>{t('landing.demoBadge')}</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-foreground font-serif">
              {t('landing.demoTitle')}
            </h2>

            <p className="text-muted-foreground font-medium text-sm md:text-base">
              {t('landing.demoSub')}
            </p>
          </div>

          {/* Consolidated Interactive Console Widget */}
          <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex flex-col max-w-6xl mx-auto w-full animate-fade-in">
            {/* Widget Header with Tabs */}
            <div className="bg-muted/40 border-b border-border px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <span className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-widest">
                {t('landing.consoleTitle')}
              </span>
              
              {/* Tabs Inside Header */}
              <div className="flex flex-wrap justify-center gap-2">
                {SAMPLE_DOCUMENTS.map((sample) => (
                  <button
                    key={sample.id}
                    onClick={() => handleSampleTabChange(sample.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selectedSampleId === sample.id
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border hover:bg-muted text-foreground"
                    }`}
                  >
                    {sample.category === "blood_report" && "🔬 "}
                    {sample.category === "prescription" && "💊 "}
                    {sample.category === "hospital_bill" && "💵 "}
                    {sample.name.split(" — ")[1]}
                  </button>
                ))}
              </div>
            </div>

            {/* Widget Body split into two columns */}
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* Left Column: Raw Input (5 columns) */}
              <div className="lg:col-span-5 p-6 md:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold font-mono text-muted-foreground">{t('landing.rawScannedText')}</span>
                    <span className="px-2.5 py-1 bg-secondary text-foreground text-[9px] font-black uppercase tracking-wider rounded-md">
                      {activeSample.category.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium italic">
                    {activeSample.description}
                  </p>
                  <div className="bg-background border border-border/80 rounded-2xl p-5 font-mono text-xs text-foreground/90 whitespace-pre-line leading-relaxed h-[260px] overflow-y-auto shadow-inner">
                    {activeSample.rawText}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleDecodeSample}
                    disabled={isDecoding}
                    className="w-full bg-primary hover:opacity-95 text-primary-foreground font-extrabold px-6 py-3.5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 transition-all text-sm"
                  >
                    {isDecoding ? (
                      <>
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        <span>{t('landing.decodingText')}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{t('landing.runBtn')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Decoded Output (7 columns) */}
              <div className="lg:col-span-7 p-6 md:p-8 flex flex-col justify-center min-h-[400px] relative overflow-hidden bg-card/50">
                <AnimatePresence mode="wait">
                  {isDecoding ? (
                    <motion.div
                      key="decoding"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="flex flex-col items-center justify-center text-center space-y-4"
                    >
                      <div className="w-16 h-16 bg-primary/10 border-2 border-primary/20 rounded-3xl flex items-center justify-center text-primary text-2xl relative shadow-sm">
                        <Sparkles className="w-7 h-7 animate-pulse" />
                        <div className="absolute inset-0 rounded-3xl border-2 border-primary border-t-transparent animate-spin" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg">{t('landing.processingReport')}</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                          {t('landing.processingSub')}
                        </p>
                      </div>
                    </motion.div>
                  ) : decodedResult ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: "spring", damping: 20 }}
                      className="space-y-6 text-left h-full flex flex-col justify-between"
                    >
                      <div className="flex justify-between items-center border-b border-border pb-4">
                        <div>
                          <h3 className="font-extrabold text-lg md:text-xl text-primary flex items-center gap-1.5">
                            <CheckCircle2 className="w-5 h-5" />
                            <span>{t('landing.decodedTranslation')}</span>
                          </h3>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                            {t('landing.generatedNotice')}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-5 h-[320px] overflow-y-auto pr-2">
                        <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                          <h4 className="text-xs font-black text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5" />
                            <span>{t('landing.patientSummary')}</span>
                          </h4>
                          <p className="text-sm text-foreground leading-relaxed font-semibold">
                            {decodedResult.decodedResult.summary}
                          </p>
                        </div>

                        {decodedResult.decodedResult.sections.map((sec, idx) => (
                          <div key={idx} className="space-y-1">
                            <h4 className="text-xs font-extrabold text-foreground uppercase tracking-wide">
                              {sec.title}
                            </h4>
                            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                              {sec.content}
                            </p>
                          </div>
                        ))}

                        {decodedResult.decodedResult.medicines.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                              {t('landing.prescribedMedications')}
                            </h4>
                            <div className="space-y-3">
                              {decodedResult.decodedResult.medicines.map((med, idx) => (
                                <div key={idx} className="bg-secondary/40 border border-border rounded-xl p-4 space-y-2 text-xs">
                                  <div className="flex justify-between items-start flex-wrap gap-1">
                                    <span className="font-extrabold text-foreground text-sm">{med.brandName}</span>
                                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[9px] font-bold">
                                      {med.category}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground font-medium">
                                    <strong>{t('landing.medGeneric')}</strong> {med.genericName}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground leading-normal">
                                    <strong>{t('landing.medHowItWorks')}</strong> {med.howItWorks}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground leading-normal">
                                    <strong>{t('landing.medWarnings')}</strong> {med.precautions}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {decodedResult.decodedResult.abnormalValues.length > 0 && (
                          <div className="space-y-3 pt-2">
                            <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                              {t('landing.labParametersBreakdown')}
                            </h4>
                            <div className="space-y-2">
                              {decodedResult.decodedResult.abnormalValues.map((val, idx) => (
                                <div
                                  key={idx}
                                  className="border border-border bg-card rounded-xl p-3 flex justify-between items-center gap-4 text-xs"
                                >
                                  <div className="space-y-1">
                                    <span className="font-extrabold text-foreground">{val.parameter}</span>
                                    <p className="text-[10px] text-muted-foreground leading-normal font-medium max-w-sm">
                                      {val.explanation}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-xs font-mono font-extrabold text-rose-600 block bg-rose-50 px-2 py-0.5 rounded">
                                      {val.value}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">
                                      {t('landing.labRange')} {val.referenceRange}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {decodedResult.decodedResult.doctorQuestions.length > 0 && (
                          <div className="space-y-2.5 pt-2">
                            <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                              {t('landing.questionsForClinician')}
                            </h4>
                            <ul className="space-y-1.5 text-xs text-muted-foreground list-none font-medium pl-0">
                              {decodedResult.decodedResult.doctorQuestions.map((q, idx) => (
                                <li key={idx} className="flex items-start gap-2 leading-relaxed">
                                  <span className="text-primary mt-0.5 font-bold">?</span>
                                  <span>{q}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center text-center space-y-4 py-8"
                    >
                      <div className="w-14 h-14 bg-secondary rounded-full flex items-center justify-center text-2xl shadow-inner">
                        📋
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-foreground">{t('landing.awaitingTitle')}</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                          {t('landing.awaitingText')}
                        </p>
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

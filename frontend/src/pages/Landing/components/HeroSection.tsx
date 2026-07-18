import React, { useState, useRef, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from "framer-motion";
import {
  Shield,
  ArrowRight,
  Play,
  Sparkles,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { SAMPLE_DOCUMENTS, type SampleDocument } from "../../../utils/sampleData";
import { useTranslation } from "react-i18next";

export const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const heroRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1.0, 1.05]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Mouse position trackers for 3D tilt animation
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // Map mouse coordinate offset to rotation angles (limit rotation to ±6 degrees max)
  const rotateX = useTransform(mouseY, [-200, 200], [6, -6]);
  const rotateY = useTransform(mouseX, [-200, 200], [-6, 6]);

  const springConfig = { damping: 20, stiffness: 150 };
  const rX = useSpring(rotateX, springConfig);
  const rY = useSpring(rotateY, springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile || prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const currentX = e.clientX - rect.left - width / 2;
    const currentY = e.clientY - rect.top - height / 2;
    mouseX.set(currentX);
    mouseY.set(currentY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    motionQuery.addEventListener("change", handleMotionChange);

    const mobileQuery = window.matchMedia("(max-width: 767px)");
    setIsMobile(mobileQuery.matches);
    const handleMobileChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    mobileQuery.addEventListener("change", handleMobileChange);

    return () => {
      motionQuery.removeEventListener("change", handleMotionChange);
      mobileQuery.removeEventListener("change", handleMobileChange);
    };
  }, []);

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

  return (
    <>
      {/* 1. Hero Layout */}
      <section
        ref={heroRef}
        className="relative w-full bg-gradient-to-br from-background via-background to-primary/10 py-10 md:py-16 px-6 md:px-12 lg:px-16 overflow-hidden flex items-center justify-center mb-8"
      >
        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">

          {/* Left Column: Copy & CTAs */}
          <div className="lg:col-span-7 space-y-4 text-center lg:text-left flex flex-col items-center lg:items-start animate-fade-in">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              <span>{t('landing.privateBadge')}</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black text-foreground tracking-tight leading-[1.1] font-serif">
              {t('landing.headline')}
            </h1>

            {/* Subcopy */}
            <p className="text-sm md:text-lg text-muted-foreground leading-relaxed max-w-xl font-medium">
              {t('landing.subcopy')}
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-1">
              <Link
                to="/upload"
                className="bg-primary hover:opacity-90 active:scale-[0.98] text-primary-foreground font-black px-8 py-3.5 rounded-full text-center shadow-lg transition-all text-sm md:text-base cursor-pointer flex items-center gap-2 group"
              >
                <span>{t('landing.decodeBtn')}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <a
                href="#interactive-demo"
                className="bg-card text-foreground border border-border hover:bg-muted font-black px-8 py-3.5 rounded-full text-center transition-all text-sm md:text-base cursor-pointer shadow-sm"
              >
                {t('landing.demoBtn')}
              </a>
            </div>

            {/* General Trust Text */}
            <p className="text-xs text-muted-foreground/80 mt-1 cursor-default font-medium">
              {t('landing.trustText')}
            </p>

            {/* Abbreviation Pills */}
            <div className="pt-4 space-y-3.5 w-full">
              <span className="text-sm font-black text-muted-foreground uppercase tracking-widest block leading-none">
                {t('landing.shorthandLabel')}
              </span>
              <div className="flex flex-wrap justify-center lg:justify-start gap-2.5">
                {["pill1", "pill2", "pill3", "pill4", "pill5"].map((key, idx) => (
                  <span
                    key={idx}
                    className="px-5 py-2.5 bg-card border border-border text-foreground rounded-full text-xs font-mono tracking-tight font-black shadow-sm select-none hover:border-primary/30 transition-all cursor-default"
                  >
                    {t(`landing.${key}`)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Code-Built Animated Document Card */}
          <div className="lg:col-span-5 flex justify-center relative">
            <div className="absolute inset-0 bg-primary/20 blur-[100px] w-72 h-72 rounded-full -top-6 -left-6 pointer-events-none animate-pulse" />

            <motion.div
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                rotateX: prefersReducedMotion ? 0 : rX,
                rotateY: prefersReducedMotion ? 0 : rY,
                transformStyle: "preserve-3d" as const,
                perspective: 1000,
                scale,
                y,
              }}
              className={`w-full max-w-[300px] md:max-w-[340px] aspect-[3/4] bg-card rounded-2xl border border-border shadow-xl relative z-10 flex flex-col p-5 justify-between select-none ${
                prefersReducedMotion ? "" : "animate-float"
              }`}
            >
              <div className="h-2 w-full bg-primary rounded-t-2xl absolute top-0 left-0" />

              <div className="space-y-4 pt-1">
                <div className="flex justify-between items-center">
                  <span className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-mono tracking-widest uppercase font-black px-2 py-1 rounded">
                    {t('landing.cardAiDecoded')}
                  </span>
                  <span className="text-muted-foreground text-[10px] uppercase font-black tracking-wider">
                    💊 {t('landing.cardPharmacyRx')}
                  </span>
                </div>

                <div>
                  <h4 className="font-serif font-black text-foreground text-xl leading-tight">
                    {t('landing.cardPrescriptionSummary')}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono uppercase tracking-wider">
                    {t('landing.cardPatientName')}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 my-4 flex-1 flex flex-col justify-center">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground font-semibold leading-relaxed">
                    <span className="font-extrabold text-foreground">{t('landing.cardLine1Bold')}</span>
                    <span className="text-muted-foreground block text-[10px] font-medium leading-none mt-0.5">{t('landing.cardLine1Text')}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground font-semibold leading-relaxed">
                    <span className="font-extrabold text-foreground">{t('landing.cardLine2Bold')}</span>
                    <span className="text-muted-foreground block text-[10px] font-medium leading-none mt-0.5">{t('landing.cardLine2Text')}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground font-semibold leading-relaxed">
                    <span className="font-extrabold text-foreground">{t('landing.cardLine3Bold')}</span>
                    <span className="text-muted-foreground block text-[10px] font-medium leading-none mt-0.5">{t('landing.cardLine3Text')}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground font-semibold leading-relaxed">
                    <span className="font-extrabold text-foreground">{t('landing.cardLine4Bold')}</span>
                    <span className="text-muted-foreground block text-[10px] font-medium leading-none mt-0.5">{t('landing.cardLine4Text')}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4 flex justify-between items-end relative overflow-hidden">
                <div className="absolute right-0 bottom-0 text-primary opacity-[0.04] pointer-events-none transform translate-x-2 translate-y-2">
                  <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 10.5h-5.5V5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v5.5H5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h5.5V19c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-5.5H19c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5z" />
                  </svg>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-foreground">Robert Chen</div>
                  <div className="text-[8px] text-muted-foreground font-mono">ID: 8D72A9</div>
                </div>

                <div className="text-right z-10">
                  <div className="text-[8px] font-bold text-primary font-mono tracking-widest uppercase">
                    {t('landing.cardVerified')}
                  </div>
                </div>
              </div>
            </motion.div>
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

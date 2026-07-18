import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

export const FAQAccordion: React.FC = () => {
  const { t } = useTranslation();
  const [expandedFaqIdx, setExpandedFaqIdx] = useState<number | null>(null);

  const faqs = [
    {
      q: t('faq.q1', "Is my medical data secure and private?"),
      a: t('faq.a1', "Yes. All uploaded documents are stored in private, secure Supabase storage buckets. We implement strict Row-Level Security (RLS) policies, meaning only you can access your records. In compliance with data privacy standards, you can permanently delete any document or your entire account at any time."),
    },
    {
      q: t('faq.q2', "Can MedDecode AI replace my doctor?"),
      a: t('faq.a2', "No. MedDecode AI is strictly an educational tool designed to help you understand complex medical terminology, clinical shorthand, and billing codes. It does not diagnose conditions, prescribe medications, or recommend treatments. Always consult a qualified healthcare provider for clinical decisions."),
    },
    {
      q: t('faq.q3', "What kinds of medical documents are supported?"),
      a: t('faq.a3', "We support a wide variety of documents including doctor prescriptions, pharmacy labels, blood tests, metabolic panels, hospital bills, insurance Explanation of Benefits (EOB) statements, and discharge summaries."),
    },
    {
      q: t('faq.q4', "How does the explanation translation process work?"),
      a: t('faq.a4', "When you upload a file, the platform performs optical character recognition (OCR) securely. It then parses clinical abbreviations (like QD or TDS) into their full names and runs the text through advanced generative AI models (Gemini API) to produce structured, patient-friendly summaries."),
    },
  ];

  return (
    <section className="bg-card py-12 md:py-14 px-6 w-full border-b border-border">
      <div className="max-w-4xl mx-auto w-full">
        <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{t('landing.faqBadge')}</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-foreground font-serif">
            {t('landing.faqTitle')}
          </h2>
          <p className="text-muted-foreground font-medium text-sm md:text-base">
            {t('landing.faqSub')}
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = expandedFaqIdx === idx;
            return (
              <div
                key={idx}
                className="bg-background border border-border rounded-2xl overflow-hidden shadow-sm transition-all"
              >
                <button
                  onClick={() => setExpandedFaqIdx(isOpen ? null : idx)}
                  className="w-full px-6 py-5 flex justify-between items-center text-left font-extrabold text-foreground hover:text-primary transition-colors cursor-pointer text-sm md:text-base gap-4"
                >
                  <span>{faq.q}</span>
                  <span className="text-primary font-bold text-xl leading-none">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      transition={{ type: "spring", damping: 25, stiffness: 200 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 text-xs md:text-sm text-muted-foreground leading-relaxed font-medium border-t border-border/50 pt-4">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

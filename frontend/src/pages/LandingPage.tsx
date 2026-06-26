import React from 'react'
import { Link } from '@tanstack/react-router'

export const LandingPage: React.FC = () => {

  return (
    <div className="flex flex-col space-y-0">
      {/* 1. Hero Split Section */}
      <section className="max-w-6xl mx-auto w-full px-4 py-16 md:py-24 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Left Column */}
        <div className="space-y-8 text-left">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white leading-[1.15] tracking-tight">
            Confused By Your Medical Report? We'll Explain It Simply.
          </h1>
          
          <p className="text-base md:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            Upload prescriptions, reports, and hospital bills to receive simple explanations in seconds. We help you take control of your health with clarity and confidence.
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
            <Link
              to="/upload"
              className="bg-[#004bb3] hover:bg-[#003d99] text-white font-extrabold px-6 py-3.5 rounded-full text-center shadow-md transition-all text-sm md:text-base cursor-pointer"
            >
              Upload Prescription or Report
            </Link>
            
            <button
              onClick={() => alert("We support Prescriptions, Blood Tests, Lab Reports, Hospital Bills, and Pharmacy Labels.")}
              className="bg-transparent text-[#004bb3] border-2 border-[#004bb3] hover:bg-slate-50 font-extrabold px-6 py-3 rounded-full text-center transition-all text-sm md:text-base cursor-pointer"
            >
              See Supported Documents
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider pt-4">
            <span>🛡️</span>
            <span>HIPAA COMPLIANT & SECURE</span>
          </div>
        </div>

        {/* Right Column: Visual Mockup Placeholder Card */}
        <div className="flex justify-center items-center w-full">
          <div className="w-full max-w-[450px] aspect-[4/5] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[32px] shadow-2xl relative overflow-hidden p-8 flex flex-col justify-between animate-float">
            {/* Design accents to mimic a mock report illustration */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="w-1/3 h-4 bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="w-1/4 h-6 bg-[#004bb3]/10 dark:bg-[#004bb3]/20 rounded-full"></div>
              </div>
              <div className="space-y-2">
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="w-5/6 h-3 bg-slate-100 dark:bg-slate-800 rounded"></div>
                <div className="w-4/5 h-3 bg-slate-100 dark:bg-slate-800 rounded"></div>
              </div>
            </div>
            
            <div className="bg-[#004bb3]/5 dark:bg-[#004bb3]/10 border border-[#004bb3]/10 p-4 rounded-2xl text-center">
              <span className="text-2xl block mb-1">📄</span>
              <span className="text-xs font-bold text-slate-400">Scan Prescriptions or Lab Summaries</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How It Works Section (Full Width Dark Background) */}
      <section className="bg-[#1e2025] text-white py-20 px-4 w-full">
        <div className="max-w-6xl mx-auto w-full">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">How It Works</h2>
            <p className="text-slate-400 font-medium">Three simple steps to clarity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-[#2a2d34] border border-slate-700/30 rounded-3xl p-8 flex flex-col items-center text-center shadow-md">
              <div className="w-16 h-16 rounded-full bg-[#004bb3]/20 text-[#004bb3] flex items-center justify-center text-2xl mb-6 font-bold">
                📄
              </div>
              <h3 className="font-extrabold text-xl mb-3 text-white">1. Upload</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                Securely upload a photo or PDF of your prescription or report.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#2a2d34] border border-slate-700/30 rounded-3xl p-8 flex flex-col items-center text-center shadow-md">
              <div className="w-16 h-16 rounded-full bg-[#004bb3]/20 text-[#004bb3] flex items-center justify-center text-2xl mb-6 font-bold">
                🌱
              </div>
              <h3 className="font-extrabold text-xl mb-3 text-white">2. Analyze</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                Our AI carefully reads and translates complex medical jargon.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#2a2d34] border border-slate-700/30 rounded-3xl p-8 flex flex-col items-center text-center shadow-md">
              <div className="w-16 h-16 rounded-full bg-[#004bb3]/20 text-[#004bb3] flex items-center justify-center text-2xl mb-6 font-bold">
                💡
              </div>
              <h3 className="font-extrabold text-xl mb-3 text-white">3. Understand</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                Read a clear, simple explanation tailored for you.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

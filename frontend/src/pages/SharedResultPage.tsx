import React, { useEffect, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";

interface Medicine {
  id: string;
  brand_name: string;
  generic_name: string | null;
  category: string | null;
  common_uses: string | null;
}

interface AbnormalValue {
  parameter: string;
  value: string;
  referenceRange: string;
  explanation: string;
}

interface AnalysisSection {
  title: string;
  content: string;
}

interface SharedData {
  doc: {
    name: string;
    document_type: string;
  };
  analysis: {
    summary: string;
    structured_output: {
      sections: AnalysisSection[];
      abnormalValues: AbnormalValue[];
    };
    doctor_questions: string[];
  };
  medicines: Medicine[];
}

export const SharedResultPage: React.FC = () => {
  const { token } = useParams({ from: "/share/$token" });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<SharedData | null>(null);

  useEffect(() => {
    const fetchSharedData = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/shared-result?token=${token}`,
          {
            headers: { apikey: supabaseAnonKey },
          }
        );

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "This link is invalid or has expired.");
        }

        const sharedPayload = await res.json();
        setData(sharedPayload);
      } catch (err: any) {
        setErrorMsg(err.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchSharedData();
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground">Loading shared medical summary...</p>
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="py-16 px-4 max-w-xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-red-500 text-4xl mx-auto">
          ⚠️
        </div>
        <h2 className="text-2xl font-bold">Access Link Expired</h2>
        <p className="text-slate-500 font-semibold text-sm max-w-md mx-auto">
          {errorMsg || "This medical document link is no longer active or could not be found."}
        </p>
        <Link
          to="/"
          className="inline-block bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-xl shadow-md"
        >
          Go to Homepage
        </Link>
      </div>
    );
  }

  const { doc, analysis, medicines } = data;
  const { sections = [], abnormalValues = [] } = analysis.structured_output;

  return (
    <div className="py-8 px-4 max-w-5xl mx-auto space-y-8 text-left">
      <div className="bg-[#004bb3]/5 border border-[#004bb3]/20 rounded-3xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="bg-[#004bb3] text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            Shared Document View
          </span>
          <h2 className="font-extrabold text-slate-800 dark:text-white mt-3 text-lg">
            {doc.name}
          </h2>
          <p className="text-slate-500 font-semibold text-xs mt-1">
            This read-only report was created and shared via MedDecode AI.
          </p>
        </div>
        <Link
          to="/"
          className="bg-[#004bb3] hover:bg-[#003d99] text-white font-extrabold px-6 py-3 rounded-full text-xs cursor-pointer shadow-sm text-center"
        >
          Try MedDecode AI Free
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl space-y-6 shadow-sm">
        <div>
          <h3 className="text-xl font-extrabold text-[#004bb3]">Document Summary</h3>
          <p className="text-slate-600 dark:text-slate-300 font-medium text-sm leading-relaxed mt-3">
            {analysis.summary}
          </p>
        </div>
      </div>

      {abnormalValues.length > 0 && (
        <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/50 p-8 rounded-3xl space-y-6 shadow-sm">
          <div>
            <h3 className="text-xl font-extrabold text-red-600 dark:text-red-400">
              Key Alert Findings
            </h3>
            <p className="text-slate-500 text-xs font-semibold mt-1">
              Parameters outside normal reference ranges that require attention.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {abnormalValues.map((av, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 border border-red-50 dark:border-red-950/50 p-5 rounded-2xl flex flex-col justify-between"
              >
                <div>
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                    {av.parameter}
                  </h4>
                  <div className="flex gap-4 mt-2">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Value</span>
                      <p className="text-red-500 font-black text-base mt-0.5">{av.value}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Reference</span>
                      <p className="text-slate-600 dark:text-slate-300 font-bold text-xs mt-1">
                        {av.referenceRange}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-slate-500 font-semibold text-xs leading-relaxed mt-4 pt-3 border-t border-slate-50 dark:border-slate-800">
                  {av.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {medicines.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl space-y-6 shadow-sm">
          <div>
            <h3 className="text-xl font-extrabold text-[#004bb3]">Prescribed Medications</h3>
            <p className="text-slate-400 text-xs font-semibold mt-1">
              Key indications and use summaries for prescribed treatments.
            </p>
          </div>
          <div className="space-y-4">
            {medicines.map((m) => (
              <div
                key={m.id}
                className="border border-slate-100 dark:border-slate-800 p-5 rounded-2xl"
              >
                <div className="flex flex-wrap gap-2 items-baseline justify-between">
                  <h4 className="text-base font-extrabold text-[#004bb3]">{m.brand_name}</h4>
                  {m.generic_name && (
                    <span className="text-xs font-semibold text-slate-400">
                      ({m.generic_name})
                    </span>
                  )}
                </div>
                {m.category && (
                  <p className="text-xs font-bold text-slate-500 mt-1">{m.category}</p>
                )}
                {m.common_uses && (
                  <p className="text-slate-600 dark:text-slate-300 text-xs font-semibold leading-relaxed mt-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-100/50 dark:border-slate-800">
                    ℹ️ <strong className="text-slate-700 dark:text-slate-200">Common Uses:</strong>{" "}
                    {m.common_uses}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {sections.map((sec, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl space-y-4 shadow-sm"
        >
          <h3 className="text-xl font-extrabold text-[#004bb3]">{sec.title}</h3>
          <p className="text-slate-600 dark:text-slate-300 font-medium text-sm leading-relaxed whitespace-pre-line">
            {sec.content}
          </p>
        </div>
      ))}

      {analysis.doctor_questions && analysis.doctor_questions.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl space-y-6 shadow-sm">
          <div>
            <h3 className="text-xl font-extrabold text-[#004bb3]">Questions for Your Doctor</h3>
            <p className="text-slate-400 text-xs font-semibold mt-1">
              Suggestions of specific items to bring up during your next clinic appointment.
            </p>
          </div>
          <ul className="space-y-3">
            {analysis.doctor_questions.map((q, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300 font-semibold leading-relaxed"
              >
                <span className="text-[#004bb3] text-lg select-none">💬</span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-center pt-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-md mx-auto leading-relaxed">
          Disclaimer: MedDecode AI is strictly educational and non-diagnostic. Always verify medical information and treatment decisions with a professional doctor.
        </p>
      </div>
    </div>
  );
};

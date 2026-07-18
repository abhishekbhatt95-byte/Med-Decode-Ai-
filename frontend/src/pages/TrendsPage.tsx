import React, { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Activity, Pill, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface RecentDoc {
  id: string;
  name: string;
  created_at: string;
  document_type: string;
}

interface MedicationCount {
  name: string;
  genericName?: string;
  count: number;
}

export const TrendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  
  // State variables
  const [totalScans, setTotalScans] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(true);
  const [docTypes, setDocTypes] = useState<{ type: string; count: number; percentage: number }[]>([]);
  const [topMedications, setTopMedications] = useState<MedicationCount[]>([]);
  const [recentHistory, setRecentHistory] = useState<RecentDoc[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/upload" });
      return;
    }

    const fetchTrendsData = async () => {
      try {
        // 1. Fetch completed documents for stats
        const { data: docs, error: docsErr } = await supabase
          .from("documents")
          .select("id, name, created_at, document_type")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false });

        if (docsErr) throw docsErr;

        const allDocs = docs || [];
        setTotalScans(allDocs.length);

        // Map recent history (up to 4 recent documents)
        setRecentHistory(allDocs.slice(0, 4).map(d => ({
          id: d.id,
          name: d.name,
          created_at: d.created_at,
          document_type: d.document_type
        })));

        // Compute document types distribution
        const typeCounts: Record<string, number> = {};
        allDocs.forEach(d => {
          const t = d.document_type || 'other';
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        const computedTypes = Object.entries(typeCounts).map(([type, count]) => ({
          type: type === 'blood_report' ? 'Blood Report' : type === 'prescription' ? 'Prescription' : type === 'hospital_bill' ? 'Hospital Bill' : 'Other',
          count,
          percentage: allDocs.length > 0 ? Math.round((count / allDocs.length) * 100) : 0
        })).sort((a, b) => b.count - a.count);
        setDocTypes(computedTypes);

        // 2. Fetch medications from analyses
        const docIds = allDocs.map(d => d.id);
        if (docIds.length > 0) {
          const { data: analysesData } = await supabase
            .from("analyses")
            .select("id")
            .in("document_id", docIds);
          
          const analysisIds = analysesData?.map(a => a.id) || [];
          if (analysisIds.length > 0) {
            const { data: medicinesData } = await supabase
              .from("medicines")
              .select("brand_name, generic_name")
              .in("analysis_id", analysisIds);
            
            if (medicinesData && medicinesData.length > 0) {
              const medCounts: Record<string, { count: number; generic: string }> = {};
              medicinesData.forEach(m => {
                const name = String(m.brand_name || "").trim();
                const gen = String(m.generic_name || "").trim();
                if (name) {
                  if (!medCounts[name]) {
                    medCounts[name] = { count: 0, generic: gen };
                  }
                  medCounts[name].count += 1;
                }
              });

              const sortedMeds = Object.entries(medCounts)
                .map(([name, val]) => ({
                  name,
                  genericName: val.generic,
                  count: val.count
                }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 3); // top 3

              setTopMedications(sortedMeds);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching health trends data:", err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchTrendsData();
  }, [user, authLoading, navigate]);

  if (authLoading || loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground">
          {t('landing.workflowTitle').includes('प्रक्रिया') ? 'स्वास्थ्य प्रवृत्तियों का विश्लेषण किया जा रहा है...' : 'Analyzing health patterns...'}
        </p>
      </div>
    );
  }

  return (
    <div className="py-8 px-6 max-w-6xl mx-auto space-y-8 text-left animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black text-foreground font-serif tracking-tight">
          {t('landing.workflowTitle').includes('प्रक्रिया') ? 'आपके स्वास्थ्य के रुझान' : 'Your Health Trends'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t('landing.workflowTitle').includes('प्रक्रिया') 
            ? 'आपके अनुवादित चिकित्सा इतिहास का एक समग्र दृष्टिकोण।' 
            : 'An aggregate view of your translated medical history.'}
        </p>
      </div>

      {/* Row 1 Grid: Total Documents & Document Types */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* Total Documents Card (1/3 width) */}
        <div className="md:col-span-4 bg-[#F2F1EC] dark:bg-[#1B2A33]/30 border border-border rounded-2xl p-8 flex flex-col items-center justify-center text-center shadow-sm min-h-[220px]">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-4xl font-black text-foreground font-serif leading-none mb-2">
            {totalScans}
          </h3>
          <p className="text-sm font-semibold text-muted-foreground">
            {t('landing.workflowTitle').includes('प्रक्रिया') ? 'कुल दस्तावेज़' : 'Total Documents'}
          </p>
        </div>

        {/* Document Types Card (2/3 width) */}
        <div className="md:col-span-8 bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col justify-between min-h-[220px]">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold font-serif text-foreground leading-none">
              {t('landing.workflowTitle').includes('प्रक्रिया') ? 'दस्तावेज़ के प्रकार' : 'Document Types'}
            </h2>
          </div>

          <div className="flex-1 flex flex-col justify-center mt-4">
            {totalScans === 0 ? (
              // Empty space matching screenshot
              <div className="h-16" />
            ) : (
              <div className="space-y-3">
                {docTypes.map((dt) => (
                  <div key={dt.type} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-foreground">
                        {t('landing.workflowTitle').includes('प्रक्रिया') 
                          ? (dt.type === 'Blood Report' ? 'रक्त रिपोर्ट' : dt.type === 'Prescription' ? 'पर्चे' : dt.type === 'Hospital Bill' ? 'अस्पताल के बिल' : 'अन्य') 
                          : dt.type}
                      </span>
                      <span className="text-muted-foreground">{dt.count} ({dt.percentage}%)</span>
                    </div>
                    <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full transition-all duration-500" 
                        style={{ width: `${dt.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 Grid: Frequently Extracted Medications & Recent History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Frequently Extracted Medications */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col justify-between min-h-[260px]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold font-serif text-foreground leading-none">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'अक्सर निकाली गई दवाएं' : 'Frequently Extracted Medications'}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground font-semibold">
              {t('landing.workflowTitle').includes('प्रक्रिया') 
                ? 'दवाएं जो आपके दस्तावेजों में सबसे अधिक बार दिखाई देती हैं।' 
                : 'Medicines that appear most often in your documents.'}
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center mt-4">
            {topMedications.length === 0 ? (
              <div className="border border-dashed border-border rounded-2xl p-8 flex items-center justify-center text-center bg-card select-none">
                <span className="text-xs font-semibold text-muted-foreground/80">
                  {t('landing.workflowTitle').includes('प्रक्रिया') ? 'अभी तक कोई दवा नहीं मिली।' : 'No medications found yet.'}
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {topMedications.map((med) => (
                  <div key={med.name} className="flex justify-between items-center p-3.5 bg-secondary/35 border border-border/80 rounded-xl text-xs font-semibold">
                    <div className="space-y-0.5">
                      <span className="text-foreground font-bold">{med.name}</span>
                      {med.genericName && (
                        <span className="text-[10px] text-muted-foreground block font-medium">
                          {t('landing.medGeneric')} {med.genericName}
                        </span>
                      )}
                    </div>
                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[10px] font-bold">
                      {t('landing.workflowTitle').includes('प्रक्रिया') ? `${med.count} बार` : `${med.count} ${med.count === 1 ? 'time' : 'times'}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent History */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm flex flex-col justify-between min-h-[260px]">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold font-serif text-foreground leading-none">
              {t('landing.workflowTitle').includes('प्रक्रिया') ? 'हाल का इतिहास' : 'Recent History'}
            </h2>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {recentHistory.length === 0 ? (
              <div className="flex items-center justify-center text-center select-none py-8">
                <span className="text-xs font-semibold text-muted-foreground/80">
                  {t('landing.workflowTitle').includes('प्रक्रिया') ? 'इतिहास में कोई दस्तावेज़ नहीं है।' : 'No documents in history.'}
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {recentHistory.map((doc) => (
                  <div key={doc.id} className="flex justify-between items-center p-3 bg-secondary/25 hover:bg-secondary/40 border border-border rounded-xl text-xs transition-all">
                    <div className="space-y-0.5">
                      <span className="font-bold text-foreground block max-w-[200px] truncate">{doc.name}</span>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">
                        {t('landing.workflowTitle').includes('प्रक्रिया') 
                          ? (doc.document_type === 'blood_report' ? 'रक्त रिपोर्ट' : doc.document_type === 'prescription' ? 'पर्चे' : doc.document_type === 'hospital_bill' ? 'अस्पताल के बिल' : 'अन्य') 
                          : doc.document_type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                      {new Date(doc.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

import React, { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "@tanstack/react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendPoint {
  date: string;
  rawDate: string;
  value: number;
  ref: string;
}

export const TrendsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAnonymous, loading: authLoading } = useAuth();
  const [dataPoints, setDataPoints] = useState<Record<string, TrendPoint[]>>({});
  const [allParams, setAllParams] = useState<string[]>([]);
  const [selectedParams, setSelectedParams] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user || isAnonymous) {
      navigate({ to: "/upload" });
      return;
    }

    const fetchTrends = async () => {
      try {
        const { data: docs, error } = await supabase
          .from("documents")
          .select("id, created_at, analyses(structured_output)")
          .eq("user_id", user.id)
          .eq("document_type", "blood_report")
          .eq("status", "completed")
          .order("created_at", { ascending: true });

        if (error) throw error;

        const grouped: Record<string, TrendPoint[]> = {};

        for (const doc of docs || []) {
          const analysis = (doc.analyses as any)?.[0];
          const abnormals = analysis?.structured_output?.abnormalValues || [];
          const dateLabel = new Date(doc.created_at).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });

          for (const av of abnormals) {
            const param = av.parameter;
            const numVal = parseFloat(String(av.value).replace(/[^0-9.\-]/g, ""));
            if (isNaN(numVal)) continue;

            if (!grouped[param]) {
              grouped[param] = [];
            }
            grouped[param].push({
              date: dateLabel,
              rawDate: doc.created_at,
              value: numVal,
              ref: av.referenceRange || "",
            });
          }
        }

        const params = Object.keys(grouped);
        setDataPoints(grouped);
        setAllParams(params);
        setSelectedParams(params.slice(0, 3));
      } catch (err) {
        console.error("Error fetching health trends:", err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchTrends();
  }, [user, isAnonymous, authLoading, navigate]);

  const handleToggleParam = (param: string) => {
    if (selectedParams.includes(param)) {
      setSelectedParams(selectedParams.filter((p) => p !== param));
    } else {
      setSelectedParams([...selectedParams, param]);
    }
  };

  const getCombinedChartData = () => {
    const datesMap: Record<string, any> = {};

    selectedParams.forEach((param) => {
      const points = dataPoints[param] || [];
      points.forEach((pt) => {
        if (!datesMap[pt.date]) {
          datesMap[pt.date] = { date: pt.date, rawDate: pt.rawDate };
        }
        datesMap[pt.date][param] = pt.value;
      });
    });

    return Object.values(datesMap).sort(
      (a: any, b: any) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime()
    );
  };

  const colors = ["#004bb3", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  if (authLoading || loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground">Analyzing health patterns...</p>
      </div>
    );
  }

  if (allParams.length === 0) {
    return (
      <div className="py-12 px-4 max-w-2xl mx-auto text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-[#004bb3] text-4xl mx-auto">
          📈
        </div>
        <h2 className="text-2xl font-bold text-slate-900">No Blood Test Trends Found</h2>
        <p className="text-slate-500 font-medium max-w-md mx-auto text-sm">
          We generate trends automatically by compiling hemoglobin, cholesterol, glucose, and other blood markers from your past completed blood panels.
        </p>
        <Link
          to="/upload"
          className="inline-block bg-[#004bb3] hover:bg-[#003d99] text-white font-extrabold px-6 py-3 rounded-full text-sm shadow-md transition-all cursor-pointer"
        >
          ➕ Upload Your First Blood Report
        </Link>
      </div>
    );
  }

  const chartData = getCombinedChartData();

  return (
    <div className="py-6 px-4 max-w-6xl mx-auto space-y-8 text-left">
      <div>
        <h1 className="text-3xl font-extrabold text-[#004bb3] tracking-tight">Health Trends 📈</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor your key blood parameters and lab levels mapped across past medical checkups.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl space-y-6 shadow-sm">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">Select Parameters</h3>
            <p className="text-slate-400 text-xs mt-0.5">Toggle parameters to map them on the chart.</p>
          </div>

          <div className="flex flex-col gap-2.5 max-h-[400px] overflow-y-auto pr-1">
            {allParams.map((param, index) => {
              const isChecked = selectedParams.includes(param);
              const color = colors[index % colors.length];
              return (
                <button
                  key={param}
                  onClick={() => handleToggleParam(param)}
                  className={`flex items-center justify-between p-3 rounded-2xl border text-left text-xs font-semibold cursor-pointer transition-all ${
                    isChecked
                      ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950"
                      : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-950/50"
                  }`}
                >
                  <span className="flex items-center gap-2 pr-2">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: isChecked ? color : "#cbd5e1" }}
                    ></span>
                    <span className="text-slate-700 dark:text-slate-300 break-all leading-tight">
                      {param}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    className="rounded border-slate-300 text-[#004bb3] focus:ring-[#004bb3] pointer-events-none"
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-3xl shadow-sm flex flex-col justify-between min-h-[480px]">
          <div>
            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 mb-6">Longitudinal Timeline</h3>
          </div>

          {selectedParams.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center text-slate-400 font-semibold text-sm">
              Please select at least one parameter to view trends.
            </div>
          ) : (
            <div className="flex-1 w-full h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    fontWeight={600}
                    tickLine={false}
                    axisLine={false}
                    dx={-10}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      borderRadius: "16px",
                      border: "none",
                      color: "#fff",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "11px", fontWeight: 700 }}
                  />
                  {selectedParams.map((param, index) => (
                    <Line
                      key={param}
                      type="monotone"
                      dataKey={param}
                      stroke={colors[index % colors.length]}
                      strokeWidth={3}
                      dot={{ r: 5, strokeWidth: 2 }}
                      activeDot={{ r: 7 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

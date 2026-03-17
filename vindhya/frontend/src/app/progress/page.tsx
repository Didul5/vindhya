"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, CartesianGrid
} from "recharts";
import { TrendingUp, Zap, DollarSign, Clock } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { getProgress, getCostComparison } from "@/lib/api";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import type { ProgressStats } from "@/types";

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressStats | null>(null);
  const [comparison, setComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProgress(), getCostComparison()])
      .then(([p, c]) => { setProgress(p); setComparison(c.comparison || []); })
      .finally(() => setLoading(false));
  }, []);

  const statCards = progress
    ? [
        { label: "Total Questions", value: progress.stats.total_queries, icon: TrendingUp, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
        { label: "Tokens Saved", value: progress.stats.total_tokens_saved.toLocaleString(), icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
        { label: "Cost Saved (USD)", value: `$${progress.stats.total_cost_saved_usd.toFixed(4)}`, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
        { label: "Avg Latency", value: `${progress.stats.avg_latency_ms}ms`, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
      ]
    : [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-strong p-3 text-xs">
        <p className="text-white font-medium mb-1 truncate max-w-32">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      <Header title="Learning Progress" subtitle="Track your study activity and AI efficiency gains" />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map(({ label, value, icon: Icon, color, bg }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={`glass p-5 border ${bg}`}
              >
                <Icon className={`w-5 h-5 ${color} mb-3`} />
                <p className="text-xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-400 mt-1">{label}</p>
              </motion.div>
            ))}
          </div>

          {/* Context pruning comparison chart */}
          {comparison.length > 0 && (
            <div className="glass p-5 mb-6">
              <h2 className="text-sm font-semibold text-white mb-1">Baseline vs Pruned Tokens</h2>
              <p className="text-xs text-slate-500 mb-4">Context pruning reduces token usage by 60-70%</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={comparison.slice(0, 10)} barGap={4}>
                  <XAxis dataKey="query" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => v.slice(0, 15) + "..."} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                  <Bar name="Baseline Tokens" dataKey="baseline_tokens" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar name="Pruned Tokens" dataKey="pruned_tokens" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Cost comparison */}
          {comparison.length > 0 && (
            <div className="glass p-5 mb-6">
              <h2 className="text-sm font-semibold text-white mb-1">Cost per Query (USD)</h2>
              <p className="text-xs text-slate-500 mb-4">Pruned queries cost significantly less</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={comparison.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="query" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => v.slice(0, 12) + "..."} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(5)}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
                  <Line name="Baseline Cost" type="monotone" dataKey="cost_baseline" stroke="#4f46e5" strokeWidth={2} dot={false} />
                  <Line name="Pruned Cost" type="monotone" dataKey="cost_pruned" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per-textbook progress */}
          {progress?.textbook_progress && progress.textbook_progress.length > 0 && (
            <div className="glass p-5 mb-6">
              <h2 className="text-sm font-semibold text-white mb-4">Per-Textbook Progress</h2>
              <div className="space-y-3">
                {progress.textbook_progress.map((tp) => (
                  <div key={tp.textbook_id} className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{tp.textbook_title}</p>
                      <p className="text-xs text-slate-500">{tp.questions_asked} questions · {tp.summaries_generated} summaries</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{tp.avg_score}%</p>
                      <p className="text-xs text-slate-500">{tp.quizzes_taken} quizzes</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent queries */}
          {progress?.recent_queries && (
            <div className="glass p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Recent Queries</h2>
              <div className="space-y-2">
                {progress.recent_queries.map((q) => (
                  <div key={q.id} className="flex items-center gap-4 py-2.5 border-b border-white/5 last:border-0">
                    <p className="text-sm text-slate-300 flex-1 truncate">{q.query}</p>
                    <div className="flex items-center gap-3 text-xs flex-shrink-0">
                      <span className="text-emerald-400">-{q.tokens_saved} tok</span>
                      <span className="text-slate-500">{q.latency_ms}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}

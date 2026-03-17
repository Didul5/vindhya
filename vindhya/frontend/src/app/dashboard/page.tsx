"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  MessageSquare, BookOpen, FileText, TrendingUp, Upload, Mic,
  Star, Zap, Flame, Trophy, ArrowRight, Brain
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { getProgress, getGamificationStats } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { ProgressStats, GamificationStats } from "@/types";
import { CardSkeleton } from "@/components/LoadingSkeleton";

const QUICK_ACTIONS = [
  { label: "Ask a Question", href: "/ask", icon: MessageSquare, color: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/20", icon_color: "text-indigo-400" },
  { label: "Take a Quiz", href: "/quiz", icon: BookOpen, color: "from-violet-500/20 to-violet-600/10 border-violet-500/20", icon_color: "text-violet-400" },
  { label: "Get Summary", href: "/summaries", icon: FileText, color: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/20", icon_color: "text-cyan-400" },
  { label: "Upload PDF", href: "/upload", icon: Upload, color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20", icon_color: "text-emerald-400" },
  { label: "Voice Mode", href: "/voice", icon: Mic, color: "from-pink-500/20 to-pink-600/10 border-pink-500/20", icon_color: "text-pink-400" },
  { label: "Evaluate Answer", href: "/evaluate", icon: Star, color: "from-amber-500/20 to-amber-600/10 border-amber-500/20", icon_color: "text-amber-400" },
];

export default function Dashboard() {
  const [progress, setProgress] = useState<ProgressStats | null>(null);
  const [gamification, setGamification] = useState<GamificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    Promise.all([getProgress(), getGamificationStats()])
      .then(([p, g]) => { setProgress(p); setGamification(g); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = [
    { label: "Questions Asked", value: progress?.stats.total_queries ?? 0, icon: Brain, color: "text-indigo-400" },
    { label: "Tokens Saved", value: (progress?.stats.total_tokens_saved ?? 0).toLocaleString(), icon: Zap, color: "text-cyan-400" },
    { label: "Cost Saved", value: `$${(progress?.stats.total_cost_saved_usd ?? 0).toFixed(4)}`, icon: TrendingUp, color: "text-emerald-400" },
    { label: "Study Streak", value: `${gamification?.streak_days ?? 0}d`, icon: Flame, color: "text-orange-400" },
  ];

  return (
    <AppLayout>
      <Header title={`Good day, ${user?.name?.split(" ")[0] || "Student"} 👋`} subtitle="Here's your learning overview" />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {loading
          ? Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)
          : stats.map(({ label, value, icon: Icon, color }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass p-5"
            >
              <div className={`${color} mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400 mt-1">{label}</p>
            </motion.div>
          ))}
      </div>

      {/* XP Progress */}
      {gamification && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass p-5 mb-8"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span className="text-white font-semibold">{gamification.level}</span>
              <span className="text-xs text-slate-500">→ next: {gamification.next_level_at} XP</span>
            </div>
            <span className="text-amber-400 font-bold">{gamification.xp} XP</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${gamification.level_progress_pct}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            />
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {gamification.badges.slice(0, 4).map((b) => (
              <span key={b.name} className="stat-badge bg-amber-500/10 text-amber-400 border border-amber-500/20">
                🏅 {b.name}
              </span>
            ))}
            {gamification.badges.length > 4 && (
              <Link href="/profile" className="text-xs text-slate-500 hover:text-slate-300">+{gamification.badges.length - 4} more</Link>
            )}
          </div>
        </motion.div>
      )}

      {/* Quick actions */}
      <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon, color, icon_color }, i) => (
          <motion.div
            key={href}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + i * 0.06 }}
          >
            <Link href={href}>
              <div className={`glass bg-gradient-to-br ${color} border p-5 rounded-2xl hover:scale-[1.02] transition-transform duration-200 cursor-pointer group`}>
                <Icon className={`w-6 h-6 ${icon_color} mb-3`} />
                <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{label}</p>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 mt-2 transition-colors" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Recent queries */}
      {progress?.recent_queries && progress.recent_queries.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Questions</h2>
          <div className="space-y-2">
            {progress.recent_queries.slice(0, 5).map((q) => (
              <div key={q.id} className="glass px-4 py-3 flex items-center justify-between gap-4">
                <p className="text-sm text-slate-300 truncate flex-1">{q.query}</p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-emerald-400">-{q.tokens_saved} tok</span>
                  <span className="text-xs text-slate-500">{q.latency_ms}ms</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </AppLayout>
  );
}

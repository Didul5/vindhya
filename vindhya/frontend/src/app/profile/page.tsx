"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Zap, Star, Medal } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { getGamificationStats } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import type { GamificationStats } from "@/types";

const BADGE_ICONS: Record<string, string> = {
  "First Step": "👣",
  "Curious Mind": "🧠",
  "Knowledge Seeker": "🔍",
  "Quiz Rookie": "📝",
  "Quiz Champion": "🏆",
  "XP Hunter": "⚡",
  "Scholar": "🎓",
  "Perfect Score": "💯",
  "Quiz Master": "🎯",
};

export default function ProfilePage() {
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    getGamificationStats().then(setStats).finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout>
      <Header title="Profile" subtitle="Your learning identity and achievements" />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array(4).fill(0).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile card */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass p-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-500/20">
                {user?.name?.[0]?.toUpperCase() || "S"}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{user?.name}</h2>
                <p className="text-slate-400 text-sm">{user?.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="stat-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {stats?.level || "Beginner"}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "XP Points", value: stats?.xp ?? 0, icon: Zap, color: "text-indigo-400" },
              { label: "Streak", value: `${stats?.streak_days ?? 0}d`, icon: Flame, color: "text-orange-400" },
              { label: "Quizzes", value: stats?.total_quizzes ?? 0, icon: Star, color: "text-amber-400" },
            ].map(({ label, value, icon: Icon, color }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="glass p-5 text-center"
              >
                <Icon className={`w-6 h-6 ${color} mx-auto mb-2`} />
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </motion.div>
            ))}
          </div>

          {/* XP progress */}
          {stats && (
            <div className="glass p-5">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-slate-300">Level Progress</span>
                <span className="text-sm text-indigo-400">{stats.xp} / {stats.next_level_at} XP</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-3">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.level_progress_pct}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-3 rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500"
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2">
                <span>{stats.level}</span>
                <span>{stats.level_progress_pct}%</span>
              </div>
            </div>
          )}

          {/* Badges */}
          <div className="glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <Medal className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Badges ({stats?.badges.length || 0})</h2>
            </div>
            {stats?.badges.length === 0 ? (
              <p className="text-slate-500 text-sm">No badges yet. Start asking questions!</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {stats?.badges.map((badge, i) => (
                  <motion.div
                    key={badge.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.06 }}
                    className="glass-strong p-4 text-center"
                  >
                    <div className="text-3xl mb-2">{BADGE_ICONS[badge.name] || "🏅"}</div>
                    <p className="text-sm font-medium text-white">{badge.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{badge.description}</p>
                    <p className="text-xs text-indigo-400 mt-1">
                      {badge.earned_at ? new Date(badge.earned_at).toLocaleDateString() : ""}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Unearned badges (locked) */}
          <div className="glass p-5">
            <h2 className="text-sm font-semibold text-slate-400 mb-4">Locked Badges</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { name: "Night Owl", desc: "Study after midnight" },
                { name: "Speedrunner", desc: "Complete 3 quizzes in one session" },
                { name: "Bookworm", desc: "Upload 5 textbooks" },
              ].map((b) => (
                <div key={b.name} className="glass p-4 text-center opacity-40">
                  <div className="text-3xl mb-2 grayscale">🔒</div>
                  <p className="text-sm font-medium text-slate-400">{b.name}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

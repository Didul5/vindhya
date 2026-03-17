"use client";
import { useEffect, useState, useCallback } from "react";
import { Flame, Zap, Sun, Moon } from "lucide-react";
import { getMe } from "@/lib/api";

interface Props {
  title: string;
  subtitle?: string;
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    setDark(isDark);
    localStorage.setItem("vindhya_theme", isDark ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
      style={{ background: "var(--surface2)", border: "1.5px solid var(--border)" }}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark
        ? <Sun className="w-4 h-4 text-amber-400" />
        : <Moon className="w-4 h-4" style={{ color: "var(--text2)" }} />
      }
    </button>
  );
}

export default function Header({ title, subtitle }: Props) {
  const [stats, setStats] = useState<{ xp_points: number; streak_days: number } | null>(null);

  // Always fetch live data from API so XP/streak are always current
  useEffect(() => {
    getMe()
      .then((data) => setStats({ xp_points: data.xp_points, streak_days: data.streak_days }))
      .catch(() => {});
  }, []);

  return (
    <header className="flex items-center justify-between mb-8 gap-4">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: "var(--text3)" }}>{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {stats && (
          <>
            {/* Streak */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{ background: "rgba(251,146,60,0.12)", border: "1.5px solid rgba(251,146,60,0.25)", color: "#f97316" }}
            >
              <Flame className="w-4 h-4" />
              {stats.streak_days}d streak
            </div>
            {/* XP */}
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{ background: "rgba(99,102,241,0.12)", border: "1.5px solid rgba(99,102,241,0.25)", color: "#6366f1" }}
            >
              <Zap className="w-4 h-4" />
              {stats.xp_points} XP
            </div>
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

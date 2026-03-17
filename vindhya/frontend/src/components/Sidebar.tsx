"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, MessageSquare, BookOpen, FileText, TrendingUp,
  User, Star, Upload, Mic, Settings, LogOut, Zap,
} from "lucide-react";
import { clearAuth, getUser } from "@/lib/auth";

const NAV = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard, color: "#6366f1" },
  { label: "Ask AI",     href: "/ask",         icon: MessageSquare,   color: "#8b5cf6" },
  { label: "Quiz",       href: "/quiz",         icon: BookOpen,        color: "#a855f7" },
  { label: "Summaries",  href: "/summaries",   icon: FileText,        color: "#06b6d4" },
  { label: "Progress",   href: "/progress",    icon: TrendingUp,      color: "#10b981" },
  { label: "Evaluate",   href: "/evaluate",    icon: Star,            color: "#f59e0b" },
  { label: "Upload",     href: "/upload",      icon: Upload,          color: "#ec4899" },
  { label: "Voice",      href: "/voice",       icon: Mic,             color: "#ef4444" },
  { label: "Profile",    href: "/profile",     icon: User,            color: "#6366f1" },
  { label: "Settings",   href: "/settings",    icon: Settings,        color: "#64748b" },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const user = getUser();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  return (
    <aside
      className="w-64 min-h-screen flex flex-col fixed left-0 top-0 z-40"
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--border)",
        boxShadow: "4px 0 24px rgba(99,102,241,0.06)",
      }}
    >
      {/* Logo */}
      <div className="px-5 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none" style={{ color: "var(--text)" }}>Vindhya</h1>
            <p className="text-xs mt-0.5 font-semibold" style={{ color: "#8b5cf6" }}>AI Tutor</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ label, href, icon: Icon, color }) => {
          const active = path === href;
          return (
            <Link key={href} href={href}>
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative cursor-pointer"
                style={{
                  background: active ? `${color}14` : "transparent",
                  color: active ? color : "var(--text2)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {active && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                    style={{ background: color }}
                  />
                )}
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                  style={{ background: active ? `${color}1a` : "var(--surface2)" }}
                >
                  <Icon className="w-4 h-4" style={{ color: active ? color : "var(--text3)" }} />
                </div>
                {label}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl"
          style={{ background: "var(--surface2)" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
          >
            {user?.name?.[0]?.toUpperCase() || "S"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>{user?.name || "Student"}</p>
            <p className="text-xs truncate" style={{ color: "var(--text3)" }}>{user?.email || ""}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150"
          style={{ color: "var(--text3)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
            (e.currentTarget as HTMLElement).style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--text3)";
          }}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

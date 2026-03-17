"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { login } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) return toast.error("Fill all fields");
    setLoading(true);
    try {
      const data = await login(form);
      saveAuth(data.token, data.user);
      toast.success(`Welcome back, ${data.user.name}!`);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      {/* Decorative orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(99,102,241,0.12)" }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(168,85,247,0.10)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl" style={{ background: "rgba(6,182,212,0.07)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-xl"
               style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 32px rgba(99,102,241,0.35)" }}>
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>Vindhya</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Voice-enabled Intelligent AI Tutor</p>
        </div>

        <div className="glass-strong p-8">
          <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--text)" }}>Sign in to continue</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text2)" }}>Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text3)" }} />
                <input
                  type="email"
                  className="input-dark pl-10"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text2)" }}>Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text3)" }} />
                <input
                  type={showPwd ? "text" : "password"}
                  className="input-dark pl-10 pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "var(--text3)" }}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><span>Sign in</span><ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text3)" }}>
            No account?{" "}
            <Link href="/signup" className="font-semibold hover:underline" style={{ color: "#6366f1" }}>
              Sign up free
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

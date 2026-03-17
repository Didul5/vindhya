"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Mail, Lock, User, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { signup } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return toast.error("Fill all fields");
    if (form.password.length < 6) return toast.error("Password must be 6+ characters");
    setLoading(true);
    try {
      const data = await signup(form);
      saveAuth(data.token, data.user);
      toast.success("Account created! Welcome to Vindhya 🎉");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(168,85,247,0.12)" }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl" style={{ background: "rgba(6,182,212,0.10)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 8px 32px rgba(99,102,241,0.35)" }}>
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--text)" }}>Join Vindhya</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text3)" }}>Your AI-powered learning companion</p>
        </div>

        <div className="glass-strong p-8">
          <h2 className="text-xl font-semibold mb-6" style={{ color: "var(--text)" }}>Create your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Full Name", type: "text", key: "name", icon: User, placeholder: "Arjun Sharma" },
              { label: "Email", type: "email", key: "email", icon: Mail, placeholder: "you@example.com" },
              { label: "Password", type: "password", key: "password", icon: Lock, placeholder: "Min 6 characters" },
            ].map(({ label, type, key, icon: Icon, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: "var(--text2)" }}>{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text3)" }} />
                  <input
                    type={type}
                    className="input-dark pl-10"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              </div>
            ))}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><span>Create Account</span><ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text3)" }}>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: "#6366f1" }}>
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Wifi, WifiOff, Zap, User, Save } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { getMe } from "@/lib/api";
import api from "@/lib/api";
import { getUser, saveAuth, getToken } from "@/lib/auth";
import type { User } from "@/types";

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState("");
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (u) { setUser(u); setName(u.name); setLowBandwidth(u.low_bandwidth_mode); }
    getMe().then((data) => {
      setUser(data);
      setName(data.name);
      setLowBandwidth(data.low_bandwidth_mode);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch("/api/auth/me", { name, low_bandwidth_mode: lowBandwidth });
      const updated = { ...user!, name, low_bandwidth_mode: lowBandwidth };
      saveAuth(getToken()!, updated);
      setUser(updated);
      toast.success("Settings saved!");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <Header title="Settings" subtitle="Customize your Vindhya experience" />

      <div className="max-w-lg space-y-6">
        {/* Profile settings */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Profile</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Display Name</label>
              <input className="input-dark" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Email</label>
              <input className="input-dark opacity-50 cursor-not-allowed" value={user?.email || ""} disabled />
            </div>
          </div>
        </motion.div>

        {/* Learning preferences */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Learning Preferences</h2>
          </div>

          {/* Low bandwidth toggle */}
          <div className="flex items-center justify-between py-3 border-b border-white/5">
            <div className="flex items-center gap-3">
              {lowBandwidth ? <WifiOff className="w-4 h-4 text-amber-400" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
              <div>
                <p className="text-sm text-slate-200">Low Bandwidth Mode</p>
                <p className="text-xs text-slate-500">Shorter responses, compressed prompts — ideal for 2G/3G</p>
              </div>
            </div>
            <button
              onClick={() => setLowBandwidth(!lowBandwidth)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${lowBandwidth ? "bg-amber-500" : "bg-white/10"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${lowBandwidth ? "translate-x-5.5 left-0.5" : "left-0.5"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-indigo-400" />
              <div>
                <p className="text-sm text-slate-200">Context Pruning</p>
                <p className="text-xs text-slate-500">Always on — reduces tokens by 60-70%</p>
              </div>
            </div>
            <span className="stat-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Always ON</span>
          </div>
        </motion.div>

        {/* API info */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass p-5">
          <h2 className="text-sm font-semibold text-white mb-4">System Info</h2>
          <div className="space-y-2 text-sm">
            {[
              ["AI Model", "Llama 3.3 70B (Groq)"],
              ["Embedding Model", "all-MiniLM-L6-v2 (Local)"],
              ["Database", "PostgreSQL + pgvector"],
              ["Cache", "Redis"],
              ["Context Pruning", "MMR + BM25 + Semantic Scoring"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-slate-400">{k}</span>
                <span className="text-slate-200 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>
    </AppLayout>
  );
}

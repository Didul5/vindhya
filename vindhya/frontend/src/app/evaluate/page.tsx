"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Star, ChevronDown, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { getTextbooks, evaluateAnswer } from "@/lib/api";
import { Spinner } from "@/components/LoadingSkeleton";
import type { Textbook } from "@/types";

const gradeColor = (g: string) =>
  ({ A: "text-emerald-400", B: "text-cyan-400", C: "text-amber-400", D: "text-orange-400", F: "text-red-400" }[g] || "text-slate-400");

const gradeBg = (g: string) =>
  ({ A: "bg-emerald-500/10 border-emerald-500/20", B: "bg-cyan-500/10 border-cyan-500/20",
     C: "bg-amber-500/10 border-amber-500/20", D: "bg-orange-500/10 border-orange-500/20",
     F: "bg-red-500/10 border-red-500/20" }[g] || "bg-slate-500/10 border-slate-500/20");

export default function EvaluatePage() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTextbooks().then((b) => { setTextbooks(b); if (b.length > 0) setSelectedBook(b[0].id); });
  }, []);

  const handleEvaluate = async () => {
    if (!question.trim() || !answer.trim() || !selectedBook)
      return toast.error("Fill all fields");
    setLoading(true);
    setResult(null);
    try {
      const data = await evaluateAnswer({ question, student_answer: answer, textbook_id: selectedBook });
      setResult(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Evaluation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <Header title="Answer Evaluator" subtitle="Get AI-powered scoring and feedback on your answers" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input */}
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Your Answer</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Textbook</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <select className="input-dark pl-9 appearance-none" value={selectedBook || ""} onChange={(e) => setSelectedBook(Number(e.target.value))}>
                  {textbooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Question</label>
              <textarea
                className="input-dark resize-none"
                rows={3}
                placeholder="What is Newton's Second Law of Motion?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Your Answer</label>
              <textarea
                className="input-dark resize-none"
                rows={5}
                placeholder="Write your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
            </div>

            <button onClick={handleEvaluate} disabled={loading || !selectedBook} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : <><Star className="w-4 h-4" /> Evaluate Answer</>}
            </button>
          </div>
        </div>

        {/* Result */}
        <div>
          {loading && (
            <div className="glass p-8 flex flex-col items-center justify-center gap-3 h-48">
              <Spinner size="lg" />
              <p className="text-slate-400 text-sm">Evaluating your answer...</p>
            </div>
          )}

          {result && !loading && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
              {/* Score card */}
              <div className={`glass p-6 border ${gradeBg(result.grade)} text-center`}>
                <div className="text-5xl font-bold text-white mb-1">{result.score}<span className="text-2xl text-slate-400">/10</span></div>
                <div className={`text-2xl font-bold mb-2 ${gradeColor(result.grade)}`}>Grade {result.grade}</div>
                <div className="w-full bg-white/5 rounded-full h-2 mt-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.score * 10}%` }}
                    transition={{ duration: 0.8 }}
                    className={`h-2 rounded-full ${result.score >= 8 ? "bg-emerald-500" : result.score >= 6 ? "bg-amber-500" : "bg-red-500"}`}
                  />
                </div>
              </div>

              {/* Feedback */}
              <div className="glass p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Feedback</h3>
                </div>
                <p className="text-slate-300 text-sm">{result.feedback}</p>
              </div>

              {result.correct_answer && (
                <div className="glass p-5 border-l-2 border-emerald-500">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-2">Model Answer</h3>
                  <p className="text-slate-300 text-sm">{result.correct_answer}</p>
                </div>
              )}

              {result.improvement_tips && (
                <div className="glass p-5">
                  <h3 className="text-sm font-semibold text-amber-400 mb-2">How to Improve</h3>
                  <p className="text-slate-300 text-sm">{result.improvement_tips}</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="stat-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">{result.latency_ms}ms</span>
                <span className="stat-badge bg-slate-500/10 text-slate-400 border border-slate-500/20">+2 XP</span>
              </div>
            </motion.div>
          )}

          {!loading && !result && (
            <div className="glass p-8 flex flex-col items-center justify-center text-center h-48">
              <Star className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-slate-400">Submit your answer to get AI feedback</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

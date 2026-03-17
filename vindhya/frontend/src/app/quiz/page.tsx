"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronDown, Sparkles, CheckCircle, XCircle, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { getTextbooks, generateQuiz, submitQuiz } from "@/lib/api";
import { Spinner } from "@/components/LoadingSkeleton";
import type { Textbook, QuizQuestion } from "@/types";

type Phase = "setup" | "quiz" | "results";

export default function QuizPage() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [topic, setTopic] = useState("");
  const [numQ, setNumQ] = useState(5);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [phase, setPhase] = useState<Phase>("setup");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    getTextbooks().then((b) => { setTextbooks(b); if (b.length > 0) setSelectedBook(b[0].id); });
  }, []);

  const handleGenerate = async () => {
    if (!selectedBook) return toast.error("Select a textbook");
    setLoading(true);
    try {
      const data = await generateQuiz({ textbook_id: selectedBook, topic, num_questions: numQ });
      setQuestions(data.questions);
      setAnswers({});
      setCurrent(0);
      setPhase("quiz");
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to generate quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBook) return;
    const correct: Record<string, string> = {};
    questions.forEach((q, i) => { correct[i] = q.answer; });
    const userAnswers: Record<string, string> = {};
    Object.entries(answers).forEach(([k, v]) => { userAnswers[k] = v; });

    setLoading(true);
    try {
      const res = await submitQuiz({ textbook_id: selectedBook, answers: userAnswers, correct_answers: correct });
      setResults(res);
      setPhase("results");
      if (res.badges_earned?.length > 0) {
        res.badges_earned.forEach((b: any) => toast.success(`🏅 Badge earned: ${b.name}!`));
      }
    } catch (err: any) {
      toast.error("Submit failed");
    } finally {
      setLoading(false);
    }
  };

  const q = questions[current];
  const gradeColor = (g: string) =>
    ({ A: "text-emerald-400", B: "text-cyan-400", C: "text-amber-400", D: "text-orange-400", F: "text-red-400" }[g] || "text-slate-400");

  return (
    <AppLayout>
      <Header title="Quiz Generator" subtitle="Auto-generated quizzes from your textbooks" />

      <AnimatePresence mode="wait">
        {phase === "setup" && (
          <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass p-6 max-w-lg">
              <h2 className="text-lg font-semibold text-white mb-5">Configure Quiz</h2>
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
                  <label className="text-xs text-slate-400 mb-1.5 block">Topic (optional)</label>
                  <input className="input-dark" placeholder="e.g. Newton's Laws, Photosynthesis..." value={topic} onChange={(e) => setTopic(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Number of Questions: {numQ}</label>
                  <input type="range" min={3} max={10} value={numQ} onChange={(e) => setNumQ(Number(e.target.value))} className="w-full accent-indigo-500" />
                  <div className="flex justify-between text-xs text-slate-500 mt-1"><span>3</span><span>10</span></div>
                </div>
                <button onClick={handleGenerate} disabled={loading || !selectedBook} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <Spinner size="sm" /> : <><Sparkles className="w-4 h-4" /> Generate Quiz</>}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {phase === "quiz" && q && (
          <motion.div key="quiz" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
            {/* Progress */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-400">Question {current + 1} of {questions.length}</span>
              <div className="flex gap-1">
                {questions.map((_, i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${i < current ? "bg-indigo-500" : i === current ? "bg-cyan-400" : "bg-white/10"}`} />
                ))}
              </div>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1 mb-6">
              <div className="h-1 bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all" style={{ width: `${((current + 1) / questions.length) * 100}%` }} />
            </div>

            <div className="glass p-6 mb-4">
              <p className="text-white font-medium text-lg mb-6">{q.q}</p>
              <div className="grid grid-cols-1 gap-3">
                {q.options.map((opt, j) => {
                  const letter = opt[0];
                  const selected = answers[current] === letter;
                  return (
                    <motion.button
                      key={j}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setAnswers({ ...answers, [current]: letter })}
                      className={`text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                        selected
                          ? "bg-indigo-600/30 border-indigo-500/50 text-white"
                          : "bg-white/3 border-white/10 text-slate-300 hover:bg-white/5 hover:border-white/20"
                      }`}
                    >
                      {opt}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              {current > 0 && <button onClick={() => setCurrent(c => c - 1)} className="btn-secondary">← Back</button>}
              {current < questions.length - 1 ? (
                <button onClick={() => setCurrent(c => c + 1)} disabled={!answers[current]} className="btn-primary ml-auto">Next →</button>
              ) : (
                <button onClick={handleSubmit} disabled={loading || Object.keys(answers).length < questions.length} className="btn-primary ml-auto flex items-center gap-2">
                  {loading ? <Spinner size="sm" /> : "Submit Quiz"}
                </button>
              )}
            </div>
          </motion.div>
        )}

        {phase === "results" && results && (
          <motion.div key="results" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="glass p-8 text-center max-w-md mx-auto mb-6">
              <Trophy className="w-14 h-14 text-amber-400 mx-auto mb-4" />
              <h2 className="text-4xl font-bold text-white mb-1">{results.score}%</h2>
              <p className={`text-2xl font-bold mb-2 ${gradeColor(results.grade)}`}>Grade {results.grade}</p>
              <p className="text-slate-400 text-sm">{results.correct} / {results.total} correct</p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="stat-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">+{results.xp_earned} XP</span>
              </div>
            </div>

            {/* Answer review */}
            <div className="space-y-3 mb-6">
              {questions.map((q, i) => {
                const userAns = answers[i];
                const correct = q.answer;
                const isRight = userAns === correct;
                return (
                  <div key={i} className={`glass p-4 border-l-2 ${isRight ? "border-emerald-500" : "border-red-500"}`}>
                    <div className="flex items-start gap-2">
                      {isRight ? <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />}
                      <div>
                        <p className="text-sm text-slate-200">{q.q}</p>
                        {!isRight && <p className="text-xs text-emerald-400 mt-1">Correct: {correct}) {q.options.find(o => o.startsWith(correct))?.slice(3)}</p>}
                        <p className="text-xs text-slate-500 mt-1 italic">{q.explanation}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={() => { setPhase("setup"); setResults(null); }} className="btn-secondary">Take Another Quiz</button>
          </motion.div>
        )}
      </AnimatePresence>
    </AppLayout>
  );
}

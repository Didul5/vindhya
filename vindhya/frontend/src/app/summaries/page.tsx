"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, BookOpen, ChevronDown, Sparkles, Download } from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { getTextbooks, generateSummary, getChapters } from "@/lib/api";
import { Spinner } from "@/components/LoadingSkeleton";
import type { Textbook } from "@/types";

export default function SummariesPage() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [chapters, setChapters] = useState<string[]>([]);
  const [selectedChapter, setSelectedChapter] = useState("");
  const [pageRange, setPageRange] = useState("");
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTextbooks().then((b) => { setTextbooks(b); if (b.length > 0) setSelectedBook(b[0].id); });
  }, []);

  useEffect(() => {
    if (!selectedBook) return;
    getChapters(selectedBook).then((d) => setChapters(d.chapters || []));
    setSummary(null);
  }, [selectedBook]);

  const handleGenerate = async () => {
    if (!selectedBook) return toast.error("Select a textbook");
    setLoading(true);
    setSummary(null);
    try {
      const data = await generateSummary({
        textbook_id: selectedBook,
        chapter_title: selectedChapter,
        page_range: pageRange,
      });
      setSummary(data);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!summary) return;
    const content = `# ${summary.chapter}\n\nPages: ${summary.pages_covered}\n\n${summary.summary}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${summary.chapter.replace(/\s+/g, "_")}_summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Summary downloaded!");
  };

  return (
    <AppLayout>
      <Header title="Chapter Summaries" subtitle="AI-generated summaries with key points and concepts" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="glass p-5 h-fit">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Summary Settings</h2>
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

            {chapters.length > 0 && (
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Chapter (optional)</label>
                <div className="relative">
                  <select className="input-dark appearance-none" value={selectedChapter} onChange={(e) => setSelectedChapter(e.target.value)}>
                    <option value="">All chapters</option>
                    {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Page Range (optional)</label>
              <input className="input-dark" placeholder="e.g. 10-25" value={pageRange} onChange={(e) => setPageRange(e.target.value)} />
            </div>

            <button onClick={handleGenerate} disabled={loading || !selectedBook} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Spinner size="sm" /> : <><Sparkles className="w-4 h-4" /> Generate Summary</>}
            </button>
          </div>
        </div>

        {/* Summary output */}
        <div className="lg:col-span-2">
          {loading && (
            <div className="glass p-8 flex flex-col items-center justify-center gap-3">
              <Spinner size="lg" />
              <p className="text-slate-400 text-sm">Generating summary...</p>
            </div>
          )}

          {summary && !loading && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <h2 className="text-white font-semibold">{summary.chapter}</h2>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {summary.pages_covered && (
                      <span className="stat-badge bg-slate-500/10 text-slate-400 border border-slate-500/20">pp. {summary.pages_covered}</span>
                    )}
                    <span className="stat-badge bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{summary.chunks_used} chunks</span>
                    <span className="stat-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">${summary.cost_usd}</span>
                    <span className="stat-badge bg-slate-500/10 text-slate-400 border border-slate-500/20">{summary.latency_ms}ms</span>
                  </div>
                </div>
                <button onClick={handleDownload} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Save
                </button>
              </div>

              <div className="prose-dark">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary.summary}</ReactMarkdown>
              </div>

              {summary.chapters_covered?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-xs text-slate-500 mb-2">Chapters covered:</p>
                  <div className="flex flex-wrap gap-2">
                    {summary.chapters_covered.map((c: string) => (
                      <span key={c} className="stat-badge bg-violet-500/10 text-violet-400 border border-violet-500/20">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {!loading && !summary && (
            <div className="glass p-8 flex flex-col items-center justify-center text-center h-48">
              <FileText className="w-10 h-10 text-slate-600 mb-3" />
              <p className="text-slate-400">Configure settings and generate a summary</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

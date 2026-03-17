"use client";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Bot, User, Zap, ChevronDown, RotateCcw,
  AlertCircle, BookOpen, Wifi, WifiOff
} from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { askQuestion, getTextbooks, getChatHistory, clearChatHistory } from "@/lib/api";
import type { Textbook, AskResponse } from "@/types";

interface Message {
  role: "user" | "assistant";
  content: string;
  stats?: AskResponse["stats"];
  sources?: number[];
  rewritten?: string;
  from_cache?: boolean;
  doubt?: boolean;
}

export default function AskPage() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usePruning, setUsePruning] = useState(true);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTextbooks().then((books) => {
      setTextbooks(books);
      if (books.length > 0) setSelectedBook(books[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedBook) return;
    getChatHistory(selectedBook).then((data) => {
      const formatted = (data.history || []).map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
      setMessages(formatted);
    });
  }, [selectedBook]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !selectedBook || loading) return;
    const query = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: query }]);
    setLoading(true);

    try {
      const res: AskResponse = await askQuestion({
        query,
        textbook_id: selectedBook,
        use_pruning: usePruning,
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: res.response,
          stats: res.stats,
          sources: res.source_pages,
          rewritten: res.rewritten_query || undefined,
          from_cache: res.from_cache,
          doubt: res.smart_doubt_detected,
        },
      ]);
      if (res.smart_doubt_detected) {
        toast("Seems like you've asked this a few times — try rephrasing for a different angle.", {
          icon: "💡",
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to get answer");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (!selectedBook) return;
    await clearChatHistory(selectedBook);
    setMessages([]);
    toast.success("Chat cleared");
  };

  return (
    <AppLayout>
      <Header title="Ask AI" subtitle="Chat with your textbook using intelligent context pruning" />

      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Textbook selector */}
        <div className="relative flex-1 min-w-48">
          <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <select
            className="input-dark pl-9 appearance-none cursor-pointer"
            value={selectedBook || ""}
            onChange={(e) => setSelectedBook(Number(e.target.value))}
          >
            <option value="" disabled>Select a textbook...</option>
            {textbooks.map((b) => (
              <option key={b.id} value={b.id}>{b.title}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        </div>

        {/* Pruning toggle */}
        <button
          onClick={() => setUsePruning(!usePruning)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
            usePruning
              ? "bg-indigo-600/20 border-indigo-500/30 text-indigo-300"
              : "bg-white/5 border-white/10 text-slate-400"
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          {usePruning ? "Pruning ON" : "Pruning OFF"}
        </button>

        {/* Low bandwidth */}
        <button
          onClick={() => setLowBandwidth(!lowBandwidth)}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
            lowBandwidth
              ? "bg-amber-600/20 border-amber-500/30 text-amber-300"
              : "bg-white/5 border-white/10 text-slate-400"
          }`}
        >
          {lowBandwidth ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
          {lowBandwidth ? "Low BW" : "Normal"}
        </button>

        {messages.length > 0 && (
          <button onClick={handleClear} className="btn-secondary text-xs px-3 py-2.5 flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Chat window */}
      <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ height: "calc(100vh - 280px)" }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center mb-4">
                <Bot className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-slate-300 font-medium">Ask anything from your textbook</p>
              <p className="text-sm text-slate-500 mt-1">Select a textbook above and type your question</p>
            </div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-indigo-500 to-violet-500"
                    : "bg-gradient-to-br from-cyan-500 to-indigo-500"
                }`}>
                  {msg.role === "user" ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                </div>
                <div className={`flex-1 max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  {msg.rewritten && (
                    <p className="text-xs text-slate-500 italic">Interpreted as: "{msg.rewritten}"</p>
                  )}
                  <div className={`rounded-2xl px-4 py-3 text-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600/30 border border-indigo-500/20 text-slate-200"
                      : "bg-white/5 border border-white/8 text-slate-300"
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="prose-dark">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.stats && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="stat-badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        -{msg.stats.tokens_saved} tok ({msg.stats.reduction_pct}%)
                      </span>
                      <span className="stat-badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        ${msg.stats.cost_pruned_usd.toFixed(6)}
                      </span>
                      <span className="stat-badge bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        {msg.stats.latency_ms}ms
                      </span>
                      {msg.sources && msg.sources.length > 0 && (
                        <span className="stat-badge bg-violet-500/10 text-violet-400 border border-violet-500/20">
                          pp. {msg.sources.join(", ")}
                        </span>
                      )}
                      {msg.from_cache && (
                        <span className="stat-badge bg-amber-500/10 text-amber-400 border border-amber-500/20">cached</span>
                      )}
                    </div>
                  )}
                  {msg.doubt && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5" /> Repeated query detected
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white/5 border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-1.5">
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-white/5 p-4">
          <div className="flex gap-3">
            <input
              className="input-dark flex-1"
              placeholder={selectedBook ? "Type your question..." : "Select a textbook first"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={!selectedBook || loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || !selectedBook || loading}
              className="btn-primary px-4 flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

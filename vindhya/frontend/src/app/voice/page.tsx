"use client";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, BookOpen, ChevronDown, Bot, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { getTextbooks, voiceAsk } from "@/lib/api";
import type { Textbook, AskResponse } from "@/types";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function VoicePage() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedBook, setSelectedBook] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(true);

  // Refs to avoid stale closure issues inside speech recognition callbacks
  const recogRef = useRef<any>(null);
  const transcriptRef = useRef("");        // mirrors transcript state, always fresh
  const selectedBookRef = useRef<number | null>(null);
  const hadErrorRef = useRef(false);       // prevents double-toast when onerror + onend both fire

  useEffect(() => {
    selectedBookRef.current = selectedBook;
  }, [selectedBook]);

  useEffect(() => {
    getTextbooks().then((b) => {
      setTextbooks(b);
      if (b.length > 0) {
        setSelectedBook(b[0].id);
        selectedBookRef.current = b[0].id;
      }
    });
    if (!("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      setSupported(false);
    }
  }, []);

  const sendToAI = async (text: string) => {
    const bookId = selectedBookRef.current;
    if (!text.trim() || !bookId) return;

    setLoading(true);
    try {
      const res = await voiceAsk({ transcription: text, textbook_id: bookId });
      setResponse(res);

      // Speak the response aloud
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel(); // stop any previous
        const utterance = new SpeechSynthesisUtterance(res.response.slice(0, 500));
        utterance.lang = "en-IN";
        utterance.rate = 0.9;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      toast.error("Failed to get answer from AI");
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    if (!selectedBookRef.current) return toast.error("Select a textbook first");
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return toast.error("Speech recognition not supported — use Chrome/Edge");

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const t = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join("");
      setTranscript(t);
      transcriptRef.current = t; // keep ref in sync — avoids stale closure in onend
    };

    recognition.onend = () => {
      setListening(false);
      if (hadErrorRef.current) return; // onerror already handled feedback
      const finalText = transcriptRef.current;
      if (finalText.trim()) {
        sendToAI(finalText);
      } else {
        toast("No speech detected — tap mic and speak clearly", { icon: "🎤" });
      }
    };

    recognition.onerror = (e: any) => {
      hadErrorRef.current = true;
      setListening(false);
      if (e.error === "no-speech") toast("No speech detected — try again", { icon: "🎤" });
      else if (e.error === "not-allowed") toast.error("Microphone access denied — check browser permissions");
      else if (e.error === "aborted") { /* user manually stopped, no toast needed */ }
      else toast.error(`Voice error: ${e.error}`);
    };

    recogRef.current = recognition;
    transcriptRef.current = ""; // reset before new session
    hadErrorRef.current = false; // clear error flag
    setTranscript("");
    setResponse(null);
    recognition.start();
    setListening(true);
  };

  const stopListening = () => {
    recogRef.current?.stop();
  };

  return (
    <AppLayout>
      <Header title="Voice Mode" subtitle="Speak your question — Vindhya listens and answers aloud" />

      {/* Textbook selector */}
      <div className="max-w-sm mb-8">
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text3)" }}>Select Textbook</label>
        <div className="relative">
          <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text3)" }} />
          <select
            className="input-dark pl-9"
            value={selectedBook || ""}
            onChange={(e) => setSelectedBook(Number(e.target.value))}
          >
            <option value="" disabled>Select textbook...</option>
            {textbooks.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--text3)" }} />
        </div>
      </div>

      {!supported && (
        <div className="glass p-4 mb-6" style={{ borderLeft: "3px solid #f59e0b" }}>
          <p className="text-sm" style={{ color: "#f59e0b" }}>
            Voice input not supported — please use Chrome or Edge browser.
          </p>
        </div>
      )}

      {/* Main voice UI */}
      <div className="flex flex-col items-center gap-6 py-8">

        {/* Big mic button */}
        <div className="relative">
          {listening && [1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full"
              style={{ border: "2px solid #ef4444" }}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1 + i * 0.35, opacity: 0 }}
              transition={{ duration: 1.5, delay: i * 0.4, repeat: Infinity, ease: "easeOut" }}
            />
          ))}

          <motion.button
            onClick={listening ? stopListening : startListening}
            disabled={!supported || loading}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="relative w-28 h-28 rounded-full flex items-center justify-center"
            style={{
              background: listening
                ? "linear-gradient(135deg, #ef4444, #f97316)"
                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              boxShadow: listening
                ? "0 8px 32px rgba(239,68,68,0.4)"
                : "0 8px 32px rgba(99,102,241,0.4)",
              opacity: (!supported || loading) ? 0.5 : 1,
              cursor: (!supported || loading) ? "not-allowed" : "pointer",
            }}
          >
            {listening
              ? <MicOff className="w-10 h-10 text-white" />
              : <Mic className="w-10 h-10 text-white" />
            }
          </motion.button>
        </div>

        {/* Status text */}
        <div className="text-center min-h-6">
          {listening && (
            <motion.p
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="font-semibold text-base"
              style={{ color: "#ef4444" }}
            >
              🎤 Listening... speak now
            </motion.p>
          )}
          {loading && (
            <p className="font-medium" style={{ color: "#6366f1" }}>
              <Sparkles className="inline w-4 h-4 mr-1" />
              Thinking...
            </p>
          )}
          {!listening && !loading && (
            <p style={{ color: "var(--text3)" }}>Tap the mic and ask your question</p>
          )}
        </div>

        {/* What you said */}
        <AnimatePresence>
          {transcript && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-lg glass p-4 text-center"
            >
              <p className="text-xs font-medium mb-1" style={{ color: "var(--text3)" }}>You said:</p>
              <p className="font-semibold text-base" style={{ color: "var(--text)" }}>"{transcript}"</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Response */}
        <AnimatePresence>
          {response && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-2xl glass p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>Vindhya</span>
                <div className="ml-auto flex items-center gap-1.5" style={{ color: "#06b6d4" }}>
                  <Volume2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Speaking</span>
                </div>
              </div>

              <div className="prose-dark">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{response.response}</ReactMarkdown>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 flex-wrap" style={{ borderTop: "1px solid var(--border)" }}>
                <span className="stat-badge" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }}>
                  -{response.stats.tokens_saved} tokens ({response.stats.reduction_pct}%)
                </span>
                <span className="stat-badge" style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.25)" }}>
                  {response.stats.latency_ms}ms
                </span>
                {response.source_pages.length > 0 && (
                  <span className="stat-badge" style={{ background: "rgba(139,92,246,0.12)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.25)" }}>
                    pp. {response.source_pages.join(", ")}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-center text-xs mt-2" style={{ color: "var(--text3)" }}>
        Browser Web Speech API · No external API · Response read aloud automatically
      </p>
    </AppLayout>
  );
}

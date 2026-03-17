"use client";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle, Trash2, BookOpen, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import Header from "@/components/Header";
import { uploadTextbook, getTextbooks, deleteTextbook } from "@/lib/api";
import { Spinner } from "@/components/LoadingSkeleton";
import type { Textbook } from "@/types";

export default function UploadPage() {
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadBooks = () => getTextbooks().then(setTextbooks);
  useEffect(() => { loadBooks(); }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === "application/pdf") { setFile(f); if (!title) setTitle(f.name.replace(".pdf", "")); }
    else toast.error("Only PDF files are accepted");
  }, [title]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); if (!title) setTitle(f.name.replace(".pdf", "")); }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) return toast.error("Add a title and select a PDF");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("file", file);
      await uploadTextbook(fd);
      toast.success("Upload started! Processing in background...");
      setFile(null);
      setTitle("");
      setTimeout(loadBooks, 1000);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number, bookTitle: string) => {
    if (!confirm(`Delete "${bookTitle}"?`)) return;
    try {
      await deleteTextbook(id);
      toast.success("Deleted");
      loadBooks();
    } catch {
      toast.error("Delete failed");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <AppLayout>
      <Header title="Upload Textbook" subtitle="Upload PDF textbooks for AI-powered Q&A and summaries" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload form */}
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Add New Textbook</h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Textbook Title</label>
              <input
                className="input-dark"
                placeholder="e.g. Class 10 Physics NCERT"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                dragOver
                  ? "border-indigo-500 bg-indigo-500/5"
                  : file
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-white/10 hover:border-white/20 hover:bg-white/3"
              }`}
              onClick={() => document.getElementById("pdf-input")?.click()}
            >
              <input id="pdf-input" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
              {file ? (
                <div>
                  <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-emerald-300 font-medium">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatSize(file.size)}</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-10 h-10 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-300">Drop PDF here or click to browse</p>
                  <p className="text-xs text-slate-500 mt-1">Max 50MB</p>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80">
                Processing happens in the background. Larger books may take a few minutes.
                Come back to Ask AI once the chunk count appears.
              </p>
            </div>

            <button onClick={handleUpload} disabled={uploading || !file || !title} className="btn-primary w-full flex items-center justify-center gap-2">
              {uploading ? <Spinner size="sm" /> : <><Upload className="w-4 h-4" /> Upload & Process</>}
            </button>
          </div>
        </div>

        {/* Library */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Your Library ({textbooks.length})</h2>
          {textbooks.length === 0 ? (
            <div className="glass p-8 text-center">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No textbooks yet. Upload your first one!</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {textbooks.map((book, i) => (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.06 }}
                    className="glass p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{book.title}</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{book.total_pages}p</span>
                          <span>·</span>
                          <span>{book.chunk_count} chunks</span>
                          <span>·</span>
                          <span>{formatSize(book.file_size)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {book.chunk_count === 0 && (
                        <span className="stat-badge bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">Processing...</span>
                      )}
                      <button
                        onClick={() => handleDelete(book.id, book.title)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

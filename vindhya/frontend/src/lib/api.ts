import axios from "axios";
import { getToken, clearAuth } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_URL });

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// Auth
export const signup = (data: { email: string; password: string; name: string }) =>
  api.post("/api/auth/signup", data).then((r) => r.data);

export const login = (data: { email: string; password: string }) =>
  api.post("/api/auth/login", data).then((r) => r.data);

export const getMe = () => api.get("/api/auth/me").then((r) => r.data);

// Textbooks
export const getTextbooks = () => api.get("/api/textbooks/").then((r) => r.data);

export const uploadTextbook = (formData: FormData) =>
  api.post("/api/textbooks/upload", formData).then((r) => r.data);

export const deleteTextbook = (id: number) =>
  api.delete(`/api/textbooks/${id}`).then((r) => r.data);

// Ask
export const askQuestion = (data: { query: string; textbook_id: number; use_pruning?: boolean }) =>
  api.post("/api/ask/", data).then((r) => r.data);

export const getChatHistory = (textbookId: number) =>
  api.get(`/api/ask/history/${textbookId}`).then((r) => r.data);

export const clearChatHistory = (textbookId: number) =>
  api.delete(`/api/ask/history/${textbookId}`).then((r) => r.data);

export const getConceptHighlights = (data: { query: string; textbook_id: number }) =>
  api.post("/api/ask/concepts", { ...data, use_pruning: true }).then((r) => r.data);

// Quiz
export const generateQuiz = (data: { textbook_id: number; topic?: string; num_questions?: number }) =>
  api.post("/api/quiz/generate", data).then((r) => r.data);

export const submitQuiz = (data: { textbook_id: number; answers: Record<string, string>; correct_answers: Record<string, string> }) =>
  api.post("/api/quiz/submit", data).then((r) => r.data);

// Summaries
export const generateSummary = (data: { textbook_id: number; chapter_title?: string; page_range?: string }) =>
  api.post("/api/summaries/generate", data).then((r) => r.data);

export const getChapters = (textbookId: number) =>
  api.get(`/api/summaries/chapters/${textbookId}`).then((r) => r.data);

// Progress
export const getProgress = () => api.get("/api/progress/").then((r) => r.data);
export const getCostComparison = () => api.get("/api/progress/cost-comparison").then((r) => r.data);

// Evaluate
export const evaluateAnswer = (data: { question: string; student_answer: string; textbook_id: number }) =>
  api.post("/api/evaluate/", data).then((r) => r.data);

// Gamification
export const getGamificationStats = () => api.get("/api/gamification/stats").then((r) => r.data);

// Voice
export const voiceAsk = (data: { transcription: string; textbook_id: number }) =>
  api.post("/api/voice/ask", { ...data, use_pruning: true }).then((r) => r.data);

export default api;

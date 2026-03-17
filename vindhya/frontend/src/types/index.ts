export interface User {
  id: number;
  email: string;
  name: string;
  xp_points: number;
  streak_days: number;
  low_bandwidth_mode: boolean;
}

export interface Textbook {
  id: number;
  title: string;
  total_pages: number;
  file_size: number;
  created_at: string;
  chunk_count: number;
}

export interface AskResponse {
  response: string;
  rewritten_query: string | null;
  source_pages: number[];
  stats: {
    baseline_tokens: number;
    pruned_tokens: number;
    tokens_saved: number;
    reduction_pct: number;
    cost_pruned_usd: number;
    cost_baseline_usd: number;
    latency_ms: number;
  };
  smart_doubt_detected: boolean;
  from_cache: boolean;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface Badge {
  name: string;
  description: string;
  earned_at: string;
}

export interface GamificationStats {
  xp: number;
  streak_days: number;
  level: string;
  next_level_at: number;
  level_progress_pct: number;
  total_queries: number;
  total_quizzes: number;
  badges: Badge[];
  new_badges: Badge[];
}

export interface ProgressStats {
  user: { name: string; xp_points: number; streak_days: number };
  stats: {
    total_queries: number;
    total_tokens_saved: number;
    total_cost_saved_usd: number;
    avg_latency_ms: number;
  };
  textbook_progress: {
    textbook_id: number;
    textbook_title: string;
    quizzes_taken: number;
    avg_score: number;
    questions_asked: number;
    summaries_generated: number;
  }[];
  recent_queries: {
    id: number;
    query: string;
    tokens_saved: number;
    cost_pruned: number;
    latency_ms: number;
    created_at: string;
  }[];
}

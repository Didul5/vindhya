export function CardSkeleton() {
  return (
    <div className="glass p-5 animate-pulse space-y-3">
      <div className="h-4 bg-white/10 rounded-lg w-3/4 shimmer" />
      <div className="h-3 bg-white/5 rounded w-1/2 shimmer" />
      <div className="h-3 bg-white/5 rounded w-2/3 shimmer" />
    </div>
  );
}

export function TextSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-3 bg-white/10 rounded shimmer ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-10 h-10" : "w-6 h-6";
  return (
    <div className={`${s} border-2 border-indigo-500 border-t-transparent rounded-full animate-spin`} />
  );
}

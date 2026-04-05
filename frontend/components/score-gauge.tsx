export function ScoreGauge({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} stroke="#e2e8f0" strokeWidth="12" fill="none" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke={score >= 75 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444"}
          strokeWidth="12"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-4xl font-semibold text-slate-950">{score}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Overall</p>
      </div>
    </div>
  );
}

export default function Smoke({ className = '' }: { className?: string }) {
  return (
    <svg className={`smoke-asset ${className}`} viewBox="0 0 180 120" fill="none" aria-hidden="true">
      <path d="M31 94c24-18 1-37 24-53 18-12 42 0 33 20-7 16-31 14-26 33 5 20 42 12 67-5" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity=".14" />
      <path d="M62 103c31-12 25-30 19-43-7-17 14-31 35-24 25 8 13 30 4 43-8 12 12 19 35 11" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity=".10" />
      <path d="M16 76c20-7 29-18 22-32-7-15 10-28 28-25" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity=".09" />
      <path d="M109 21c29 4 44 21 35 39-7 15-1 24 21 29" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity=".08" />
    </svg>
  );
}

/** Placeholder rows while a section loads, sized to the content that replaces them. */
export default function Loading({ rows = 3, className }) {
  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
      ))}
    </div>
  );
}

import Card from "../../../components/ui/Card";
import Badge from "../../../components/ui/Badge";

/**
 * Shared intro block, so every Builder tab opens the same way. Its own file
 * rather than a second export from DeptBuilder, which would make every tab
 * import the shell that imports it.
 */
export default function TabIntro({ title, badge, children }) {
  return (
    <Card className="mb-5 p-5">
      <div className="mb-1.5 flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white">{title}</h2>
        {badge && <Badge tone="slate">{badge}</Badge>}
      </div>
      <p className="text-sm leading-relaxed text-slate-400">{children}</p>
    </Card>
  );
}

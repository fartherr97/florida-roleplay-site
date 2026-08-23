import Card from "../ui/Card";

/** What a section says when the API returned nothing. */
export default function Empty({ title, children }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-sm font-semibold text-white">{title}</p>
      {children && (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
          {children}
        </p>
      )}
    </Card>
  );
}

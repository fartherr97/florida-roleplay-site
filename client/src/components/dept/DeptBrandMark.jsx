/**
 * A department's mark. Uses the logo from its config when one is set, and
 * otherwise draws a monogram in the department's accent — so a new department
 * looks deliberate from the moment it is created, before anyone uploads
 * artwork.
 */
export default function DeptBrandMark({ config, className = "size-9" }) {
  const { logoUrl, shortName, name } = config.branding;

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${className} shrink-0 rounded-xl object-cover ring-1 ring-inset ring-white/10`}
      />
    );
  }

  // Three characters at most: "FHP" and "MPD" are the whole name, while "BSO"
  // at this size is a smudge — so it clips, and the tighter type keeps three
  // letters from overflowing the tile.
  const letters = (shortName || name || "?").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const monogram = letters.slice(0, 3);

  return (
    <span
      className={`dept-accent-tile ${className} grid shrink-0 place-items-center rounded-xl font-extrabold ring-1 ring-inset ${
        monogram.length > 2 ? "text-[10px] tracking-tighter" : "text-[11px] tracking-tight"
      }`}
      aria-hidden="true"
    >
      {monogram}
    </span>
  );
}

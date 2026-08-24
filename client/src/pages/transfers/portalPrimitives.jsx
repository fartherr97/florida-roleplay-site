// ─────────────────────────────────────────────────────────────────────────────
// Transfer Portal — toast system and primitives
//
// The Toast System and Primitives blocks of the ES Transfer Portal
// (github.com/fartherr97/es-transfer-portal, app/page.jsx). Behaviour is the
// original's; two things changed on the way across, both forced by the move out
// of Next.js:
//
//   • `next/image` is gone — plain <img>, which is what it compiled to for
//     these sizes anyway.
//   • DeptLogo replaces the per-department <Image>. This community has no
//     department artwork yet, so it falls back to the abbreviation on a tile in
//     the department's colour; set `logo` in portalConfig.js and every slot
//     picks the image up with no other change.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X, Zap } from "lucide-react";
import { DEPTS, STATUS_CFG, ds } from "./portalConfig";
import ToastContext from "./portalToastContext";
import { avatarColor, initials } from "./portalUtils";

/* ─── Toast System ─────────────────────────────────────────────────────────── */

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, exiting: false }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 260);
    }, 3400);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 260);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div
        className="pointer-events-none fixed bottom-3 left-3 right-3 z-[100] flex flex-col gap-2 sm:bottom-5 sm:left-auto sm:right-5"
        // Announced rather than merely drawn: a toast is often the only report
        // that an approval landed or a message failed to send.
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_META = {
  success: {
    icon: <CheckCircle2 className="size-4 text-emerald-400" strokeWidth={1.5} />,
    border: "border-emerald-500/25",
  },
  error: {
    icon: <AlertCircle className="size-4 text-rose-400" strokeWidth={1.5} />,
    border: "border-rose-500/25",
  },
  info: {
    icon: <Info className="size-4 text-sky-400" strokeWidth={1.5} />,
    border: "border-sky-500/25",
  },
  warning: {
    icon: <Zap className="size-4 text-amber-400" strokeWidth={1.5} />,
    border: "border-amber-500/25",
  },
};

function ToastItem({ toast, onDismiss }) {
  const meta = TOAST_META[toast.type] || TOAST_META.info;
  return (
    <div
      onClick={onDismiss}
      className={`pointer-events-auto flex w-full cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl shadow-black/50 sm:w-auto sm:min-w-72 sm:max-w-sm ${meta.border} ${toast.exiting ? "toast-exit" : "toast-enter"}`}
      style={{ backgroundColor: "var(--color-surface-2)" }}
    >
      <div className="mt-0.5 shrink-0">{meta.icon}</div>
      <p className="flex-1 text-sm leading-relaxed text-slate-200">{toast.message}</p>
      <X className="mt-0.5 size-3.5 shrink-0 text-slate-500 transition hover:text-slate-300" strokeWidth={1.5} />
    </div>
  );
}

/* ─── Primitives ───────────────────────────────────────────────────────────── */

/**
 * A department's mark.
 *
 * The original renders `<Image src={d.logo}>`. There is no department artwork
 * in this repo yet, so an empty `logo` falls back to the abbreviation on a tile
 * in the department's own colour — which reads as a badge rather than as a
 * broken image, and keeps the five departments distinguishable at 14px.
 */
export function DeptLogo({ dept, size = 14, className = "" }) {
  const d = DEPTS[dept];
  if (!d) return null;
  if (d.logo) {
    return (
      <img
        src={d.logo}
        alt={dept}
        width={size}
        height={size}
        className={`object-contain ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  // The whole abbreviation, scaled to fit, rather than its first two letters:
  // HCSO and HCFR both begin "HC", and two departments that differ only by tile
  // colour is not a distinction anybody should have to make at 14px.
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center rounded font-bold leading-none ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(5, Math.round((size * 0.9) / Math.max(2, dept.length))),
        letterSpacing: "-0.02em",
        backgroundColor: d.color + "33",
        color: d.color,
      }}
    >
      {dept}
    </span>
  );
}

export function DeptBadge({ dept, fullName = false }) {
  const d = DEPTS[dept];
  if (!d) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-bold"
      style={ds(d.color).chip}
    >
      <DeptLogo dept={dept} size={14} />
      {fullName ? d.name : dept}
    </span>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export function Avatar({ name, src, size = "md" }) {
  const sz = { sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-11 text-base" }[size];
  if (src) {
    return <img src={src} alt="" className={`${sz} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div
      className={`${sz} ${avatarColor(name)} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
    >
      {initials(name)}
    </div>
  );
}

export function Btn({
  children,
  variant = "primary",
  size = "md",
  disabled,
  onClick,
  type = "button",
  className = "",
  title,
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]";
  const sz = {
    xs: "px-3 py-1.5 text-xs",
    sm: "px-3.5 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-sm",
  }[size];
  const styles =
    {
      primary: {
        bg: "rounded-xl text-white hover:-translate-y-px hover:shadow-lg hover:shadow-orange-500/20",
        inline: { backgroundColor: "var(--color-primary)" },
        hoverBg: "var(--color-hover)",
      },
      secondary: {
        bg: "rounded-xl border text-slate-200 hover:-translate-y-px hover:border-white/15",
        inline: { backgroundColor: "var(--color-surface-2)", borderColor: "var(--color-border)" },
      },
      approve: {
        bg: "rounded-md bg-emerald-600 text-white hover:bg-emerald-500 hover:-translate-y-px hover:shadow-lg hover:shadow-emerald-500/20",
      },
      complete: {
        bg: "rounded-md bg-emerald-600 text-white hover:bg-emerald-500 hover:-translate-y-px hover:shadow-lg hover:shadow-emerald-500/20",
      },
      danger: {
        bg: "rounded-md bg-rose-700 text-white hover:bg-rose-600 hover:-translate-y-px hover:shadow-lg hover:shadow-rose-700/20",
      },
      ghost: { bg: "rounded-xl text-slate-400 hover:text-white hover:bg-white/5" },
    }[variant] || {};

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`${base} ${sz} ${styles.bg} ${className}`}
      style={styles.inline}
      onMouseEnter={(e) => {
        if (styles.hoverBg) e.currentTarget.style.backgroundColor = styles.hoverBg;
      }}
      onMouseLeave={(e) => {
        if (styles.inline?.backgroundColor) {
          e.currentTarget.style.backgroundColor = styles.inline.backgroundColor;
        }
      }}
    >
      {children}
    </button>
  );
}

export function Input({ label, readOnly, ...props }) {
  const el = (
    <input
      {...props}
      readOnly={readOnly}
      className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-slate-600 ${
        readOnly
          ? "cursor-default text-slate-400"
          : "text-white focus:border-[#f2800d] focus:ring-2 focus:ring-[#f2800d]/20"
      }`}
      style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
    />
  );
  if (!label) return el;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {el}
    </label>
  );
}

export function Textarea({ label, ...props }) {
  const el = (
    <textarea
      {...props}
      className="min-h-28 w-full resize-none rounded-xl border px-4 py-2.5 text-sm text-white outline-none transition-all duration-200 placeholder:text-slate-600 focus:border-[#f2800d] focus:ring-2 focus:ring-[#f2800d]/20"
      style={{ backgroundColor: "var(--color-bg)", borderColor: "var(--color-border)" }}
    />
  );
  if (!label) return el;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-display text-[11px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {el}
    </label>
  );
}

/** Tracks error per-src so when the URL changes the error clears automatically. */
export function PreviewImg({ src, className, width, height, fallback = null }) {
  const [errorSrc, setErrorSrc] = useState(null);
  if (!src || errorSrc === src) return fallback;
  return (
    <img
      src={src}
      alt=""
      className={className}
      width={width}
      height={height}
      onError={() => setErrorSrc(src)}
    />
  );
}

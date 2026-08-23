import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

/**
 * Standard constrained content wrapper. `reveal` fades the whole block up as it
 * scrolls into view; `eyebrow`/`title`/`subtitle` render the centred heading.
 */
export default function Section({
  eyebrow,
  title,
  subtitle,
  reveal = false,
  className,
  innerClassName,
  id,
  children,
}) {
  const heading = (eyebrow || title || subtitle) && (
    <div className={cn("mx-auto max-w-3xl text-center", children && "mb-12")}>
      {eyebrow && (
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-400">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
      )}
      {subtitle && <p className="mt-4 text-slate-400">{subtitle}</p>}
    </div>
  );

  const inner = (
    <>
      {heading}
      {children}
    </>
  );

  return (
    <section
      id={id}
      className={cn(
        "mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8",
        className,
      )}
    >
      {reveal ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className={innerClassName}
        >
          {inner}
        </motion.div>
      ) : (
        <div className={innerClassName}>{inner}</div>
      )}
    </section>
  );
}

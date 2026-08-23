import { Link } from "react-router-dom";
import Logo from "./Logo";
import { SITE } from "../../data/mockData";

/** Slim frosted footer closing every public page. */
export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0a0e1a]/80 py-5 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <Logo size="size-7" />
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()}{" "}
            <Link to="/" className="text-slate-400 transition hover:text-white">
              {SITE.name}
            </Link>
            . All rights reserved.
          </p>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
          Serious Roleplay · Gulf Coast, Florida
        </p>
      </div>
    </footer>
  );
}

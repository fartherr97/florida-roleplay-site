import { FaDiscord, FaTiktok, FaXTwitter, FaYoutube } from "react-icons/fa6";
import { SITE } from "../../data/mockData";
import { cn } from "../../lib/cn";

/**
 * Bare social icons — no circles. Each lifts into its own brand colour with a
 * matching drop shadow on hover.
 */
const LINKS = [
  { key: "discord", label: "Discord", href: SITE.socials.discord, Icon: FaDiscord, color: "#5865F2" },
  { key: "tiktok", label: "TikTok", href: SITE.socials.tiktok, Icon: FaTiktok, color: "#ff3b5c" },
  { key: "x", label: "X", href: SITE.socials.x, Icon: FaXTwitter, color: "#e8e8e8" },
  { key: "youtube", label: "YouTube", href: SITE.socials.youtube, Icon: FaYoutube, color: "#ff0000" },
];

export default function SocialLinks({ className }) {
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <p
        className="uppercase"
        style={{
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "1.4px",
          color: "rgba(120,160,200,0.4)",
        }}
      >
        Connect With Us
      </p>
      <div className="flex items-center gap-6">
        {LINKS.map(({ key, label, href, Icon, color }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={label}
            className="social-link"
            style={{ "--social-color": color }}
          >
            <Icon size={22} />
          </a>
        ))}
      </div>

      <style>{`
        .social-link {
          color: rgba(150, 180, 215, 0.5);
          transition: color 0.18s ease, transform 0.18s ease, filter 0.18s ease;
          display: inline-flex;
        }
        .social-link:hover {
          color: var(--social-color);
          transform: translateY(-4px);
          filter: drop-shadow(0 6px 12px color-mix(in srgb, var(--social-color) 40%, transparent));
        }
      `}</style>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { api } from "../../lib/api";
import { portalLinks as seedLinks } from "../../data/staffHubData";

/**
 * Rank-scoped link collection. One component serves Resources, Administrators
 * and Senior Admins+ — they differ only in which section of the portal's link
 * store they read and who may open them.
 */
export default function HubLinks({ section, icon, title, subtitle, badge, badgeTone }) {
  const [links, setLinks] = useState(seedLinks[section] ?? []);

  useEffect(() => {
    let active = true;
    api.hubPortal().then((data) => {
      if (active && data?.links?.[section]) setLinks(data.links[section]);
    });
    return () => {
      active = false;
    };
  }, [section]);

  return (
    <>
      <HubPageHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        actions={badge ? <Badge tone={badgeTone}>{badge}</Badge> : null}
      />

      {links.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-400">
            No links here yet. A Director can add them from the Director panel.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {links.map((link) => (
            <Card
              key={link.url}
              as="a"
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              hover
              className="group flex items-center gap-4 p-5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{link.title}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{link.url}</p>
              </div>
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-500/15 text-primary-400 ring-1 ring-inset ring-primary-400/20 transition group-hover:bg-primary-500/25">
                <ExternalLink className="size-4" />
              </span>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

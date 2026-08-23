import { useEffect, useState } from "react";
import { CircleDollarSign, MapPin, Phone } from "lucide-react";
import HubPageHeader from "../../components/hub/HubPageHeader";
import Card from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import StatTile from "../../components/hub/StatTile";
import { api } from "../../lib/api";
import { money } from "../../lib/money";
import { formatDate } from "../../lib/format";
import { characters as seedCharacters } from "../../data/civilianHubData";

/** Every character on the account, with their identity and balances. */
export default function CivCharacters() {
  const [characters, setCharacters] = useState(seedCharacters);

  useEffect(() => {
    let active = true;
    api.civCharacters().then((next) => {
      if (active && next?.length) setCharacters(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <HubPageHeader
        icon="IdCard"
        eyebrow="Civilian Hub"
        title="Characters"
        subtitle="Identity records for every character on your account. Balances update when you next log off."
        actions={<Badge tone="brand">{characters.length} characters</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        {characters.map((character) => (
          <Card key={character.id} hover className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-white">{character.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{character.occupation}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {character.primary && <Badge tone="primary">Primary</Badge>}
                <Badge tone="green" dot>
                  {character.status}
                </Badge>
              </div>
            </div>

            <dl className="mt-5 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <MapPin className="size-4 shrink-0 text-slate-500" />
                <dt className="sr-only">Residence</dt>
                <dd className="min-w-0 truncate text-slate-300">{character.residence}</dd>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <Phone className="size-4 shrink-0 text-slate-500" />
                <dt className="sr-only">Phone</dt>
                <dd className="text-slate-300">{character.phone}</dd>
              </div>
              <div className="flex items-center gap-2.5 text-sm">
                <CircleDollarSign className="size-4 shrink-0 text-slate-500" />
                <dt className="sr-only">Date of birth</dt>
                <dd className="text-slate-300">
                  Born {formatDate(character.dob)} · joined {formatDate(character.joinedAt)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatTile label="Bank" value={money(character.bank)} tone="green" />
              <StatTile label="Cash" value={money(character.cash)} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

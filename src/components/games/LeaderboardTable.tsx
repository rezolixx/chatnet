"use client";

import { useRef, useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { PlayerProfileDialog } from "@/components/games/PlayerProfileDialog";
import { formatCount, playerHref } from "@/lib/games";
import type { LeaderboardRow } from "@/lib/games";

export function LeaderboardTable({ entries, caption }: { entries: LeaderboardRow[]; caption: string }) {
  const [selected, setSelected] = useState<LeaderboardRow | null>(null);
  const opener = useRef<HTMLElement | null>(null);

  // A plain click opens the player card; the link still leads to the full
  // statistics page without JavaScript, in a new tab or with a modifier key.
  const openPlayer = (entry: LeaderboardRow) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    opener.current = event.currentTarget;
    setSelected(entry);
  };
  const closePlayer = () => {
    setSelected(null);
    opener.current?.focus();
  };

  return <>
    <div className="leaderboard-scroll" role="region" aria-label={caption} tabIndex={0}><table className="leaderboard"><caption className="sr-only">{caption}</caption><thead><tr><th scope="col">Rang</th><th scope="col">Joueur</th><th scope="col">Points</th><th scope="col">Parties<span className="sr-only"> jouées</span></th><th scope="col">Victoires</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.rank} className={entry.rank <= 3 ? `leaderboard-podium leaderboard-rank-${entry.rank}` : undefined}><td><span className="leaderboard-rank">{entry.rank}</span></td><th scope="row"><Link href={playerHref(entry.nickname)} className="leaderboard-player" aria-haspopup="dialog" onClick={openPlayer(entry)}><PlayerAvatar nickname={entry.nickname} identity={entry} /><span className="leaderboard-player-name">{entry.nickname}</span></Link></th><td className="leaderboard-points">{formatCount(entry.points)}</td><td>{formatCount(entry.gamesPlayed)}</td><td>{formatCount(entry.wins)}</td></tr>)}</tbody></table></div>
    {selected && <PlayerProfileDialog key={selected.rank} player={selected} onClose={closePlayer} />}
  </>;
}

import Link from "next/link";
import { formatCount, playerHref } from "@/lib/games";
import type { DefisLeaderboardEntry } from "@/lib/api/defis.server";

/** Défis ranking for one period: points and challenges solved (read-only, Game API). */
export function DefisLeaderboard({ entries, caption }: { entries: DefisLeaderboardEntry[]; caption: string }) {
  return <div className="leaderboard-scroll" role="region" aria-label={caption} tabIndex={0}><table className="leaderboard"><caption className="sr-only">{caption}</caption><thead><tr><th scope="col">Rang</th><th scope="col">Joueur</th><th scope="col">Points</th><th scope="col">Défis<span className="sr-only"> résolus</span></th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.rank} className={entry.rank <= 3 ? `leaderboard-podium leaderboard-rank-${entry.rank}` : undefined}><td><span className="leaderboard-rank">{entry.rank}</span></td><th scope="row"><Link href={playerHref(entry.nickname)} className="leaderboard-player"><span className="leaderboard-player-name">{entry.nickname}</span></Link></th><td className="leaderboard-points">{formatCount(entry.points)}</td><td>{formatCount(entry.solves)}</td></tr>)}</tbody></table></div>;
}

import Link from "next/link";
import { formatCount, playerHref } from "@/lib/games";
import type { LeaderboardEntry } from "@/lib/games";

export function LeaderboardTable({ entries, caption }: { entries: LeaderboardEntry[]; caption: string }) {
  return <div className="leaderboard-scroll" role="region" aria-label={caption} tabIndex={0}><table className="leaderboard"><caption className="sr-only">{caption}</caption><thead><tr><th scope="col">Rang</th><th scope="col">Joueur</th><th scope="col">Points</th><th scope="col">Parties<span className="sr-only"> jouées</span></th><th scope="col">Victoires</th></tr></thead><tbody>{entries.map((entry) => <tr key={entry.rank} className={entry.rank <= 3 ? `leaderboard-podium leaderboard-rank-${entry.rank}` : undefined}><td><span className="leaderboard-rank">{entry.rank}</span></td><th scope="row"><Link href={playerHref(entry.nickname)} className="leaderboard-player">{entry.nickname}</Link></th><td className="leaderboard-points">{formatCount(entry.points)}</td><td>{formatCount(entry.gamesPlayed)}</td><td>{formatCount(entry.wins)}</td></tr>)}</tbody></table></div>;
}

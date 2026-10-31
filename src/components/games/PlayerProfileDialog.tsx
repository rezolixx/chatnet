"use client";

import { useEffect, useId, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";
import Link from "next/link";
import { PlayerAvatar } from "@/components/games/PlayerAvatar";
import { Icon } from "@/components/ui/Icons";
import { formatCount, NICKNAME_OWNER_CAVEAT, NICKNAME_OWNER_LABEL, playerHref } from "@/lib/games";
import type { LeaderboardRow } from "@/lib/games";

export function rankLabel(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}

// Native modal <dialog>: the browser traps focus in the top layer, makes the
// page inert and closes on Escape. Every close path ends in the "close" event.
export function PlayerProfileDialog({ player, onClose }: { player: LeaderboardRow; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const close = () => dialogRef.current?.close();
  // The panel fills the dialog box, so only the backdrop targets the dialog itself.
  // Requiring both press and release there ignores a text selection dragged outside.
  const onPointerDown = (event: PointerEvent<HTMLDialogElement>) => { pressedBackdrop.current = event.target === event.currentTarget; };
  const onClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (pressedBackdrop.current && event.target === event.currentTarget) close();
    pressedBackdrop.current = false;
  };

  return <dialog ref={dialogRef} className="player-dialog" aria-labelledby={titleId} onClose={onClose} onPointerDown={onPointerDown} onClick={onClick}>
    <div className="player-dialog-panel">
      <button type="button" className="player-dialog-close" onClick={close} aria-label="Fermer la fiche du joueur"><Icon name="close" size={18} /></button>
      <div className="player-dialog-head">
        <PlayerAvatar nickname={player.nickname} identity={player} size={72} />
        <div><span className="eyebrow">Joueur Chatnet</span><h2 id={titleId}>{player.nickname}</h2><span className="player-rank">{rankLabel(player.rank)}<span className="sr-only"> au classement du Quiz</span></span></div>
      </div>
      <dl className="player-stats"><div><dt>Points</dt><dd>{formatCount(player.points)}</dd></div><div><dt>Parties jouées</dt><dd>{formatCount(player.gamesPlayed)}</dd></div><div><dt>Victoires</dt><dd>{formatCount(player.wins)}</dd></div></dl>
      {player.account
        ? <p className="player-dialog-note player-dialog-verified"><Icon name="shield" size={16} /> Compte membre vérifié : {player.account.nickname}</p>
        : player.nicknameOwner
          ? <p className="player-dialog-note player-dialog-owner"><Icon name="shield" size={16} /> <span>{NICKNAME_OWNER_LABEL} : <strong>{player.nicknameOwner.nickname}</strong>. {NICKNAME_OWNER_CAVEAT}</span></p>
          : <p className="player-dialog-note"><Icon name="shield" size={16} /> Pseudo utilisé dans les salons de jeu, pas forcément associé à un compte membre Chatnet du même nom.</p>}
      <div className="player-dialog-actions">
        <Link href={playerHref(player.nickname)} className="button button-primary">Statistiques complètes <Icon name="arrow" size={16} /></Link>
        {player.account && <Link href={player.account.profileHref} className="button button-outline">Profil membre<span className="sr-only"> de {player.account.nickname}</span></Link>}
        {player.nicknameOwner && <Link href={player.nicknameOwner.profileHref} className="button button-outline">Profil associé<span className="sr-only"> au pseudo : {player.nicknameOwner.nickname}</span></Link>}
      </div>
    </div>
  </dialog>;
}

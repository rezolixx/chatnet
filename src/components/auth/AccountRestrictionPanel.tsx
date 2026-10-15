"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icons";
import { accountRefusalView, type AccountRefusal } from "@/lib/auth/account-restriction";

// The API's Ban / Suspension refusal (or unreadable restriction state): title,
// end date in the visitor's time zone, public reason. Presentational only.
export function AccountRestrictionPanel({ refusal, onDismiss, onRetry, className = "" }: {
  refusal: AccountRefusal;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
}) {
  const view = accountRefusalView(refusal);
  return <div className={`account-restriction ${className}`.trim()} role="alert">
    <Icon name="shield" size={20} aria-hidden="true" className="account-restriction-icon" />
    <div className="account-restriction-body">
      <p className="account-restriction-title">{view.title}</p>
      <p>{view.message}</p>
      {view.reason && <p><strong>Motif :</strong> {view.reason}</p>}
      {view.temporary && <p className="account-restriction-note">Vous pourrez vous reconnecter après cette date.</p>}
      {view.retry
        ? onRetry && <button type="button" className="button button-outline account-restriction-action" onClick={onRetry}>Réessayer</button>
        : <p className="account-restriction-note">Une question ? <Link href="/contact">Contacter l’équipe</Link></p>}
    </div>
    {onDismiss && <button type="button" className="account-restriction-close" onClick={onDismiss} aria-label="Fermer ce message"><Icon name="close" size={16} aria-hidden="true" /></button>}
  </div>;
}

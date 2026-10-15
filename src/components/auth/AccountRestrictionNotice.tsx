"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { AccountRestrictionPanel } from "./AccountRestrictionPanel";

// Site-wide notice of the API's latest refusal (AuthProvider, memory only).
// The sign-in page shows it inside its form instead.
export function AccountRestrictionNotice() {
  const pathname = usePathname();
  const { accountRefusal, clearAccountRefusal, refreshUser } = useAuth();
  if (!accountRefusal || pathname === "/connexion") return null;
  return <div className="container account-restriction-notice">
    <AccountRestrictionPanel refusal={accountRefusal} onDismiss={clearAccountRefusal} onRetry={() => { void refreshUser(); }} />
  </div>;
}

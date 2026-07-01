import type { BillingAccountingStatus, BillingSessionRow, SessionStatus } from "@/lib/types";

export const ACCOUNTING_STATUS_LABELS: Record<BillingAccountingStatus, string> = {
  realized: "Réalisée (facturable)",
  cancelled: "Annulée",
  rescheduled: "Reportée",
  not_held: "Non tenue",
  future: "À venir",
};

export function suggestAccountingStatus(input: {
  sessionDate: string;
  status: SessionStatus;
  past: boolean;
  presentCount: number;
  registeredCount: number;
}): BillingAccountingStatus {
  if (!input.past) {
    return "future";
  }
  if (input.status === "cancelled") {
    return "cancelled";
  }
  if (input.status === "rescheduled") {
    return "rescheduled";
  }
  if (input.presentCount >= 1) {
    return "realized";
  }
  if (input.registeredCount === 0) {
    return "not_held";
  }
  return "not_held";
}

export function countBillableSessions(statuses: BillingAccountingStatus[]) {
  return statuses.filter((status) => status === "realized").length;
}

export function buildSessionSnapshot(
  row: BillingSessionRow,
  accountingStatus: BillingAccountingStatus,
) {
  return {
    id: row.id,
    sessionDate: row.sessionDate,
    theme: row.theme,
    registeredCount: row.registeredCount,
    presentCount: row.presentCount,
    accountingStatus,
    presentParticipants: row.presentParticipants,
  };
}

export function billableSnapshotsFromRows(
  rows: BillingSessionRow[],
  statusBySessionId: Record<string, BillingAccountingStatus>,
) {
  return rows
    .map((row) => {
      const status = statusBySessionId[row.id] ?? row.suggestedAccountingStatus;
      return buildSessionSnapshot(row, status);
    })
    .filter((snapshot) => snapshot.accountingStatus === "realized");
}

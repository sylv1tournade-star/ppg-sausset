import type { BillingAccountingStatus, BillingSessionRow, SessionStatus } from "@/lib/types";

export const ACCOUNTING_STATUS_LABELS: Record<BillingAccountingStatus, string> = {
  realized: "Réalisée (facturable)",
  cancelled: "Annulée",
  rescheduled: "Reportée",
  future: "À venir",
};

export function suggestAccountingStatus(input: {
  status: SessionStatus;
  past: boolean;
  presentCount: number;
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
  return "cancelled";
}

export function countBillableSessions(statuses: BillingAccountingStatus[]) {
  return statuses.filter((status) => status === "realized").length;
}

export function buildSessionSnapshot(
  row: BillingSessionRow,
  accountingStatus: BillingAccountingStatus,
  comment: string | null = null,
) {
  return {
    id: row.id,
    sessionDate: row.sessionDate,
    theme: row.theme,
    registeredCount: row.registeredCount,
    presentCount: row.presentCount,
    accountingStatus,
    comment: comment?.trim() || null,
    presentParticipants: row.presentParticipants,
  };
}

export function billableSnapshotsFromRows(
  rows: BillingSessionRow[],
  statusBySessionId: Record<string, BillingAccountingStatus>,
  commentBySessionId: Record<string, string>,
) {
  return rows
    .map((row) => {
      const status = statusBySessionId[row.id] ?? row.suggestedAccountingStatus;
      return buildSessionSnapshot(row, status, commentBySessionId[row.id] ?? null);
    })
    .filter((snapshot) => snapshot.accountingStatus === "realized");
}

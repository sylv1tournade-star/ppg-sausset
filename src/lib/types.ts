export type SessionStatus = "scheduled" | "cancelled" | "rescheduled";

export type AttendanceStatus = "present" | "absent" | "excused";

export type Season = {
  id: string;
  label: string;
  startYear: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
  isActive: boolean;
  createdAt: string;
};

export type Session = {
  id: string;
  seasonId: string;
  sessionDate: string;
  status: SessionStatus;
  theme: string | null;
  notes: string | null;
  createdAt: string;
};

export type Participant = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  accessToken: string;
  createdAt: string;
};

export type Registration = {
  id: string;
  sessionId: string;
  participantId: string;
  createdAt: string;
};

export type Attendance = {
  id: string;
  sessionId: string;
  participantId: string;
  status: AttendanceStatus;
  markedAt: string;
};

export type SessionWithMeta = Session & {
  registrationCount: number;
  isRegistered?: boolean;
  participants?: { id: string; firstName: string; lastName: string }[];
};

export type RankingEntry = {
  participantId: string;
  firstName: string;
  lastName: string;
  presentCount: number;
  registeredCount: number;
  rate: number;
};

export type PaidMember = {
  id: string;
  seasonId: string;
  firstName: string;
  lastName: string;
  normalizedKey: string;
  importedAt: string;
};

export type BureauStats = {
  sessions: {
    id: string;
    sessionDate: string;
    registered: number;
    present: number;
    absent: number;
    fillRate: number;
    attendanceRate: number;
  }[];
  months: {
    month: string;
    absences: number;
    sessions: number;
  }[];
};

export type TreasurerEmail = {
  id: string;
  email: string;
  label: string | null;
  recipientType: BillingRecipientType;
  createdAt: string;
};

export type BillingRecipientType = "treasurer" | "coach" | "billing_manager";

export type BillingAccountingStatus =
  | "realized"
  | "cancelled"
  | "rescheduled"
  | "not_held"
  | "future";

export type BillingSessionSnapshot = {
  id: string;
  sessionDate: string;
  theme: string | null;
  registeredCount: number;
  presentCount: number;
  accountingStatus: BillingAccountingStatus;
  presentParticipants: { firstName: string; lastName: string }[];
};

export type MonthValidation = {
  id: string;
  seasonId: string;
  year: number;
  month: number;
  computedSessionCount: number;
  billedSessionCount: number;
  billingNote: string | null;
  sessionSnapshot: BillingSessionSnapshot[];
  lastSentAt: string | null;
  sendCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BillingSessionRow = {
  id: string;
  sessionDate: string;
  theme: string | null;
  status: SessionStatus;
  registeredCount: number;
  presentCount: number;
  attendanceMarkedCount: number;
  suggestedAccountingStatus: BillingAccountingStatus;
  presentParticipants: { firstName: string; lastName: string }[];
  registeredParticipants: { firstName: string; lastName: string }[];
};

export type MonthBillingPreview = {
  season: Season;
  monthLabel: string;
  year: number;
  month: number;
  sessions: BillingSessionRow[];
  suggestedBillableCount: number;
  canValidate: boolean;
  lastValidation: MonthValidation | null;
};

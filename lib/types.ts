/**
 * Shared, client-safe DTO types (no server-only imports here).
 */

export type AttendanceStatus = "present" | "absent" | "unmarked";

export type MemberDTO = {
  id: string;
  fullName: string;
  phoneNumber?: string;
  isActive: boolean;
  createdAt: string;
};

export type ServiceDTO = {
  id: string;
  title: string;
  serviceDate: string;
  isActive: boolean;
  createdAt?: string;
};

export type AttendanceRow = {
  member: MemberDTO;
  status: AttendanceStatus;
  attendanceId: string | null;
  markedAt: string | null;
};

export type AttendanceSummary = {
  totalMembers: number;
  present: number;
  absent: number;
  percentage: number;
};

/** Public roster row (phone numbers intentionally omitted). */
export type PublicRow = {
  id: string;
  fullName: string;
  status: AttendanceStatus;
  markedAt: string | null;
};

export type Overview = {
  service: { id: string; title: string; serviceDate: string } | null;
  totalMembers: number;
  newMembers: number;
  present: number;
  absent: number;
  percentage: number;
};

export type PreviewRow = {
  index: number;
  fullName: string;
  phoneNumber: string;
  duplicateOf?: "existing" | "file";
  existingMatchName?: string;
  valid: boolean;
};

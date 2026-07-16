// Shared TypeScript types mirroring the Go backend structs.

export interface User {
  id: number;
  email: string;
  role: "officer" | "member";
  plate: string | null;
  balance: number;
  created_at: string;
}

export interface BalanceResponse {
  balance: number;
}

export interface RuleVersion {
  id: number;
  published_by: number;
  published_at: string;
  is_active: boolean;
  base_amounts: Record<string, number>;
  time_multipliers: {
    day: number;
    night: number;
    night_start_hour: string;
    night_end_hour: string;
  };
  repeat_multipliers: Record<string, number>;
}

export interface Violation {
  id: number;
  plate: string;
  violation_type: string;
  location: string;
  timestamp: string;
  photo_path?: string;
  submitted_by: number;
  invoice_status?: "pending" | "paid" | "failed";
  created_at: string;
}

export interface Invoice {
  id: number;
  violation_id: number;
  rule_version_id: number;
  base_amount: number;
  time_multiplier: number;
  repeat_multiplier: number;
  fine_amount: number;
  status: "pending" | "paid" | "failed";
  created_at: string;
}

export interface SubmitViolationResponse {
  violation: Violation;
  invoice: Invoice;
}

export interface Payment {
  id: number;
  invoice_id: number;
  member_id: number;
  scenario: "success" | "failed";
  provider_transaction_id: string;
  status: "paid" | "failed";
  created_at: string;
}

export interface PayResponse {
  status: string;
  transaction_id: string;
}

export interface ViolationDetail {
  violation: Violation;
  invoice?: Invoice;
  officer?: User;
  member?: User;
}

export type RuleActivationResponse = RuleVersion;

export interface ApiError {
  error: string;
}

export type AlertSeverity = "danger" | "warn" | "info" | "success";
export type AlertCategory = "account" | "campaign" | "sku" | "trend";

export type SmartAlert = {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  deltaPct: number;
  entityName?: string;
  entityId?: string;
  recommendation?: string;
};

export type SmartAlertsResponse = {
  period: string;
  source: "google-ads" | "mock";
  updatedAt: string;
  currentPeriod: { start: string; end: string };
  previousPeriod: { start: string; end: string };
  alerts: SmartAlert[];
  summary: {
    total: number;
    danger: number;
    warn: number;
    info: number;
    success: number;
  };
};

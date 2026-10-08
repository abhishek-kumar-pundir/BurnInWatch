import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Detection, ScreeningStatus, TimelinePoint } from "../types/api";

export interface StatusMeta {
  status: ScreeningStatus;
  label: string;
  headline: string;
  explanation: string;
  Icon: LucideIcon;
  /** Tailwind classes */
  text: string;
  soft: string;
  border: string;
  solid: string;
  /** Hex for charts */
  color: string;
}

/**
 * Wording follows the backend status logic exactly:
 *   window: NORMAL = no detector flags, REVIEW = exactly one, ANOMALY = both.
 *   overall: ANOMALY if any ANOMALY window, else REVIEW if any REVIEW window, else NORMAL.
 */
export const STATUS_META: Record<ScreeningStatus, StatusMeta> = {
  NORMAL: {
    status: "NORMAL",
    label: "Normal",
    headline: "No anomalous behavior detected",
    explanation: "No analysis windows were flagged by either detection model.",
    Icon: CheckCircle2,
    text: "text-normal",
    soft: "bg-normal-soft",
    border: "border-normal-line",
    solid: "bg-normal",
    color: "#1d6b4a",
  },
  REVIEW: {
    status: "REVIEW",
    label: "Review",
    headline: "Review recommended",
    explanation:
      "One detection model identified unusual behavior in one or more windows while the other did not. Further engineering review is recommended.",
    Icon: TriangleAlert,
    text: "text-review",
    soft: "bg-review-soft",
    border: "border-review-line",
    solid: "bg-review",
    color: "#b97a00",
  },
  ANOMALY: {
    status: "ANOMALY",
    label: "Anomaly",
    headline: "Anomaly detected",
    explanation:
      "One or more analysis windows were flagged by both detection models. Review the highlighted intervals and abnormal measurement signals below.",
    Icon: CircleAlert,
    text: "text-anomaly",
    soft: "bg-anomaly-soft",
    border: "border-anomaly-line",
    solid: "bg-anomaly",
    color: "#b4261f",
  },
};

export function statusMeta(status: ScreeningStatus): StatusMeta {
  return STATUS_META[status];
}

export const DETECTION_LABEL: Record<Detection, string> = {
  both: "Both",
  isolation_forest: "Isolation Forest",
  autoencoder: "Autoencoder",
  none: "None",
};

export function detectionOf(p: Pick<TimelinePoint, "isolation_forest_flag" | "autoencoder_flag">): Detection {
  if (p.isolation_forest_flag && p.autoencoder_flag) return "both";
  if (p.isolation_forest_flag) return "isolation_forest";
  if (p.autoencoder_flag) return "autoencoder";
  return "none";
}

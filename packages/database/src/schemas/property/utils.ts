import type { CertificateStatus } from "./enums";

export function getPropertyIsOperational(certificateStatus: CertificateStatus): boolean {
  return certificateStatus === "RECEIVED" || certificateStatus === "NOT_REQUIRED";
}

type PropertyOperationalTransitionInput = {
  certificateStatus: CertificateStatus;
  currentCertificateReceivedAt?: Date | null;
  now?: Date;
};

type PropertyOperationalTransitionOutput = {
  isOperational: boolean;
  certificateReceivedAt: Date | null;
};

/**
 * Keeps the operational state aligned with certificate status.
 *
 * Rule:
 * - PENDING -> isOperational false, certificateReceivedAt null
 * - RECEIVED -> isOperational true, certificateReceivedAt stamped if missing
 * - NOT_REQUIRED -> isOperational true, certificateReceivedAt left as-is if already present
 */
export function derivePropertyOperationalState({
  certificateStatus,
  currentCertificateReceivedAt = null,
  now = new Date(),
}: PropertyOperationalTransitionInput): PropertyOperationalTransitionOutput {
  if (certificateStatus === "PENDING") {
    return {
      isOperational: false,
      certificateReceivedAt: null,
    };
  }

  if (certificateStatus === "RECEIVED") {
    return {
      isOperational: true,
      certificateReceivedAt: currentCertificateReceivedAt ?? now,
    };
  }

  return {
    isOperational: true,
    certificateReceivedAt: currentCertificateReceivedAt,
  };
}

// web/src/components/PatientQRScanner.tsx
//
// Shared camera QR scanner used by both the receptionist and doctor scan pages.
// Requires (web folder):  npm install html5-qrcode
//
// Decodes the HealthChain payload { t: "hc-patient", id } (or a raw UUID),
// verifies the patient exists, then hands the patient to onFound.

"use client";
import { useEffect, useRef, useState } from "react";
import { patientApi } from "@/lib/api";
import {
  QrCode,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export interface ScannedPatient {
  id: string;
  firstName?: string;
  lastName?: string;
  [k: string]: any;
}

export default function PatientQRScanner({
  onFound,
  hint,
}: {
  onFound: (patient: ScannedPatient) => void;
  hint?: string;
}) {
  const scannerRef = useRef<any>(null);
  const handledRef = useRef(false);
  const [status, setStatus] = useState<
    "starting" | "scanning" | "found" | "error"
  >("starting");
  const [error, setError] = useState("");
  const [foundName, setFoundName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!mounted) return;

        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          async (decodedText: string) => {
            if (handledRef.current) return;

            // Parse payload
            let patientId: string | null = null;
            try {
              const parsed = JSON.parse(decodedText);
              if (parsed.t === "hc-patient" && parsed.id) patientId = parsed.id;
            } catch {
              if (/^[0-9a-f-]{36}$/i.test(decodedText.trim()))
                patientId = decodedText.trim();
            }
            if (!patientId) {
              setError("Not a HealthChain patient code.");
              return;
            }

            handledRef.current = true;
            try {
              await scanner.stop();
            } catch {}
            setStatus("found");

            try {
              const res = await patientApi.getById(patientId);
              const patient = res.data?.data ?? { id: patientId };
              setFoundName(
                patient.firstName
                  ? `${patient.firstName} ${patient.lastName ?? ""}`.trim()
                  : null,
              );
              setTimeout(() => onFound({ ...patient, id: patientId }), 900);
            } catch {
              setError("Patient not found in the system.");
              setStatus("error");
              handledRef.current = false;
            }
          },
          () => {
            /* per-frame misses — ignore */
          },
        );

        if (mounted) setStatus("scanning");
      } catch (err: any) {
        if (mounted) {
          setStatus("error");
          setError(
            err?.message?.includes("Permission")
              ? "Camera permission denied. Allow camera access and retry."
              : "Could not start the camera.",
          );
        }
      }
    })();

    return () => {
      mounted = false;
      const s = scannerRef.current;
      if (s) {
        try {
          s.stop().catch(() => {});
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = () => window.location.reload();

  return (
    <div className="space-y-4" style={{ fontFamily: "var(--font-sans)" }}>
      <div className="bg-[var(--surface-card)] rounded-[var(--r-lg)] border border-[var(--border-faint)] shadow-[var(--elev-1)] overflow-hidden">
        {/* Camera viewport */}
        <div className="relative" style={{ minHeight: 320, background: "var(--ink-900)" }}>
          <div id="qr-reader" className="w-full" />

          {status === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--white)]">
              <Loader2 size={28} className="animate-spin" />
              <p className="text-sm">Starting camera…</p>
            </div>
          )}

          {status === "found" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[var(--white)]" style={{ background: "color-mix(in srgb, var(--green-900) 92%, transparent)" }}>
              <CheckCircle2 size={40} style={{ color: "var(--green-300)" }} />
              <p className="text-base font-bold">
                {foundName ?? "Patient found!"}
              </p>
              <p className="text-sm text-[var(--green-200)]">Continuing…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4">
          {status === "scanning" && (
            <div className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "var(--green-300)" }} />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "var(--brand)" }} />
              </span>
              Scanning — hold the phone's QR steady in the frame
            </div>
          )}

          {(status === "error" || error) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 p-3 rounded-[var(--r-sm)] bg-[var(--coral-050)] border border-[var(--coral-100)] text-sm text-[var(--critical-ink)]">
                <AlertTriangle size={15} className="flex-shrink-0" />
                {error || "Something went wrong."}
              </div>
              <button
                onClick={retry}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--r-sm)] text-sm font-bold"
                style={{ background: "var(--brand)", color: "var(--on-brand)" }}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5 p-4 rounded-[var(--r-lg)] bg-[var(--blue-050)] border border-[var(--info-tint)]">
        <QrCode size={15} className="flex-shrink-0 mt-0.5" style={{ color: "var(--info-ink)" }} />
        <p className="text-xs text-[var(--info-ink)] leading-relaxed">
          {hint ??
            "Patients find their QR under Records → My Hospital ID in the HealthChain app. Scanning identifies the patient only — record access still follows normal permissions."}
        </p>
      </div>
    </div>
  );
}

// ── LabOrdersTab.tsx ──────────────────────────────────────────────────────────
import { visitApi, practitionersApi } from "@/lib/api";
import {
  FlaskConical,
  ChevronDown as ChevronDownLab,
  ChevronUp as ChevronUpLab,
  AlertCircle as AlertCircleLab,
  CheckCircle2 as CheckCircle2Lab,
  PlusCircle as PlusCircleLab,
  Trash2,
  Zap,
  Clock,
  Stethoscope,
} from "lucide-react";
import { useState, useEffect } from "react";
import { FieldGroup } from "../shared/FieldGroup";
import { InputField } from "../shared/InputField";
import { SelectField } from "../shared/SelectField";
import StaffDropdown from "../shared/StaffDropdown";
import { SubmitBtn } from "../shared/SubmitBtn";
import { safeFormatDate } from "../utils/dateHelpers";

const COMMON_TESTS = [
  { name: "Full Blood Count", code: "FBC", specimen: "blood" },
  { name: "Urea & Electrolytes", code: "UE", specimen: "blood" },
  { name: "Liver Function", code: "LFT", specimen: "blood" },
  { name: "Troponin I", code: "TROP-I", specimen: "blood" },
  { name: "Blood Glucose", code: "BGL", specimen: "blood" },
  { name: "HbA1c", code: "HBA1C", specimen: "blood" },
  { name: "Malaria RDT", code: "MAL-RDT", specimen: "blood" },
  { name: "Lipid Profile", code: "LIPID", specimen: "blood" },
  { name: "Urinalysis", code: "UA", specimen: "urine" },
  { name: "Blood Culture", code: "BC", specimen: "blood" },
];

const SPECIMEN_TYPES = [
  "blood",
  "urine",
  "stool",
  "sputum",
  "csf",
  "tissue",
  "swab",
  "other",
];

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  specialization: string | null;
  lastSeenAt: string | null;
}

const URGENCY_STYLE: Record<string, { bg: string; text: string }> = {
  routine: { bg: "#f0fdf4", text: "#15803d" },
  urgent: { bg: "#fffbeb", text: "#d97706" },
  emergency: { bg: "#fef2f2", text: "#dc2626" },
  critical: { bg: "#fdf4ff", text: "#7c3aed" },
};

// ── Lab order card ────────────────────────────────────────────────────────────
function LabOrderCard({ order }: { order: any }) {
  const [open, setOpen] = useState(false);
  const resulted = order.status === "resulted";
  const ug = URGENCY_STYLE[order.urgency] ?? URGENCY_STYLE.routine;

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${resulted ? "border-green-100" : "border-gray-100"}`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${resulted ? "bg-green-50" : "bg-amber-50"}`}
        >
          <FlaskConical
            className={`w-4 h-4 ${resulted ? "text-green-600" : "text-amber-500"}`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-800">{order.testName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs font-mono text-gray-400">
              {order.orderNumber}
            </span>
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400 capitalize">
              {order.specimenType}
            </span>
            {order.assignedToName && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400">
                  {order.assignedToName}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full capitalize"
            style={{
              background: resulted ? "#f0fdf4" : ug.bg,
              color: resulted ? "#15803d" : ug.text,
            }}
          >
            {resulted ? (
              <CheckCircle2Lab className="w-3 h-3" />
            ) : (
              <Clock className="w-3 h-3" />
            )}
            {order.status}
          </span>
          {open ? (
            <ChevronUpLab className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDownLab className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-4 bg-white space-y-4">
          {/* Abnormal findings */}
          {order.result?.abnormalFindings && (
            <div className="flex gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
              <AlertCircleLab className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-1">
                  Abnormal Findings
                </p>
                <p className="text-sm text-red-800 whitespace-pre-wrap">
                  {order.result.abnormalFindings}
                </p>
              </div>
            </div>
          )}

          {/* Interpretation */}
          {order.result?.interpretation && (
            <div className="flex gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-100">
              <Stethoscope className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">
                  Interpretation
                </p>
                <p className="text-sm text-blue-800 whitespace-pre-wrap">
                  {order.result.interpretation}
                </p>
              </div>
            </div>
          )}

          {/* Results table */}
          {order.result?.resultsData &&
            typeof order.result.resultsData === "object" &&
            Object.keys(order.result.resultsData).length > 0 && (
              <div className="rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Quantitative Results
                  </p>
                </div>
                <div className="divide-y divide-gray-50">
                  {Object.entries(order.result.resultsData).map(
                    ([param, value]) => (
                      <div
                        key={param}
                        className="flex items-center justify-between px-4 py-2.5"
                      >
                        <span className="text-sm text-gray-700 font-medium">
                          {param}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold font-mono text-gray-900">
                            {String(value)}
                          </span>
                          {order.result?.referenceRanges?.[param] && (
                            <span className="text-xs text-gray-400">
                              ref: {order.result.referenceRanges[param]}
                            </span>
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

          {!order.result && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-700">
              <Clock className="w-4 h-4" /> Awaiting lab result.
            </div>
          )}

          {order.result?.performedAt && (
            <p className="text-xs text-gray-400 text-right">
              Resulted:{" "}
              {safeFormatDate(order.result.performedAt, "dd MMM yyyy, HH:mm")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main LabOrdersTab ─────────────────────────────────────────────────────────
export function LabOrdersTab({
  visitId,
  labOrders: initialOrders,
  onSaved,
  onError,
  isCompleted,
}: {
  visitId: string;
  labOrders: any[];
  onSaved: () => void;
  onError: (m: string) => void;
  isCompleted: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [labTechs, setLabTechs] = useState<StaffMember[]>([]);
  const [techsLoading, setTechsLoading] = useState(true);
  const [liveOrders, setLiveOrders] = useState(initialOrders);
  const [tests, setTests] = useState([
    {
      testName: "",
      testCode: "",
      specimenType: "blood",
      urgency: "routine",
      clinicalNotes: "",
      assignedTo: "",
    },
  ]);

  useEffect(() => {
    setLiveOrders(initialOrders);
  }, [initialOrders]);

  useEffect(() => {
    if (!visitId || isCompleted) return;
    const iv = setInterval(async () => {
      try {
        const res = await visitApi.getLabResults(visitId);
        if (res.data.success) setLiveOrders(res.data.data.labOrders);
      } catch {}
    }, 5000);
    return () => clearInterval(iv);
  }, [visitId, isCompleted]);

  useEffect(() => {
    practitionersApi
      .getOnlineStaff("lab_technician")
      .then((res) => setLabTechs(res.data.data?.staff ?? []))
      .catch(() => setLabTechs([]))
      .finally(() => setTechsLoading(false));
  }, []);

  const addTest = () =>
    setTests((p) => [
      ...p,
      {
        testName: "",
        testCode: "",
        specimenType: "blood",
        urgency: "routine",
        clinicalNotes: "",
        assignedTo: "",
      },
    ]);
  const removeTest = (i: number) =>
    setTests((p) => p.filter((_, idx) => idx !== i));
  const updateTest = (i: number, field: string, value: string) =>
    setTests((p) =>
      p.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)),
    );

  const quickAdd = (test: { name: string; code: string; specimen: string }) => {
    const emptyIdx = tests.findIndex((t) => !t.testName);
    if (emptyIdx >= 0) {
      updateTest(emptyIdx, "testName", test.name);
      updateTest(emptyIdx, "testCode", test.code);
      updateTest(emptyIdx, "specimenType", test.specimen);
    } else {
      setTests((p) => [
        ...p,
        {
          testName: test.name,
          testCode: test.code,
          specimenType: test.specimen,
          urgency: "routine",
          clinicalNotes: "",
          assignedTo: "",
        },
      ]);
    }
  };

  const handleSubmit = async () => {
    const valid = tests.filter((t) => t.testName.trim() && t.testCode.trim());
    if (!valid.length) {
      onError("Add at least one test with name and code.");
      return;
    }
    const missing = valid.find((t) => !t.assignedTo);
    if (missing) {
      onError(`Assign a lab technician to "${missing.testName}".`);
      return;
    }
    setSubmitting(true);
    try {
      await visitApi.orderLabs(visitId, { tests: valid });
      setTests([
        {
          testName: "",
          testCode: "",
          specimenType: "blood",
          urgency: "routine",
          clinicalNotes: "",
          assignedTo: "",
        },
      ]);
      setShowForm(false);
      onSaved();
      const res = await visitApi.getLabResults(visitId);
      if (res.data.success) setLiveOrders(res.data.data.labOrders);
    } catch (err: any) {
      onError(err.response?.data?.error?.message ?? "Failed to order tests.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="p-5 space-y-4"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {liveOrders.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 px-0.5">
            Lab Orders ({liveOrders.length})
          </p>
          <div className="space-y-2.5">
            {liveOrders.map((order: any) => (
              <LabOrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}

      {!isCompleted &&
        (!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gray-200 text-sm font-semibold text-gray-400 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50/40 transition-all"
          >
            <PlusCircleLab className="w-4 h-4" />
            Order Lab Tests
          </button>
        ) : (
          <div className="rounded-2xl border border-amber-100 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-50 to-white border-b border-amber-100">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">
                  Order Lab Tests
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select tests and assign a technician
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="ml-auto text-xs text-gray-400 hover:text-gray-600 font-medium"
              >
                Cancel
              </button>
            </div>

            <div className="p-5 space-y-4 bg-white">
              {/* Quick add chips */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Quick Add
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_TESTS.map((t) => (
                    <button
                      key={t.code}
                      onClick={() => quickAdd(t)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full border border-gray-200 text-gray-500 hover:border-amber-400 hover:text-amber-700 hover:bg-amber-50 transition-all"
                    >
                      + {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test rows */}
              <div className="space-y-3">
                {tests.map((test, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-gray-100 space-y-3 bg-gray-50/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                        Test {idx + 1}
                      </span>
                      {tests.length > 1 && (
                        <button
                          onClick={() => removeTest(idx)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <FieldGroup label="Test Name *">
                        <InputField
                          value={test.testName}
                          onChange={(v: string) =>
                            updateTest(idx, "testName", v)
                          }
                          placeholder="e.g. Full Blood Count"
                        />
                      </FieldGroup>
                      <FieldGroup label="Test Code *">
                        <InputField
                          value={test.testCode}
                          onChange={(v: string) =>
                            updateTest(idx, "testCode", v)
                          }
                          placeholder="e.g. FBC"
                        />
                      </FieldGroup>
                      <FieldGroup label="Specimen">
                        <SelectField
                          value={test.specimenType}
                          onChange={(v: string) =>
                            updateTest(idx, "specimenType", v)
                          }
                          options={SPECIMEN_TYPES.map((s) => ({
                            value: s,
                            label: s.charAt(0).toUpperCase() + s.slice(1),
                          }))}
                        />
                      </FieldGroup>
                      <FieldGroup label="Urgency">
                        <SelectField
                          value={test.urgency}
                          onChange={(v: string) =>
                            updateTest(idx, "urgency", v)
                          }
                          options={[
                            { value: "routine", label: "Routine" },
                            { value: "urgent", label: "Urgent" },
                            { value: "emergency", label: "Emergency" },
                            { value: "critical", label: "Critical" },
                          ]}
                        />
                      </FieldGroup>
                    </div>
                    <FieldGroup label="Clinical Notes">
                      <InputField
                        value={test.clinicalNotes}
                        onChange={(v: string) =>
                          updateTest(idx, "clinicalNotes", v)
                        }
                        placeholder="Reason for test"
                      />
                    </FieldGroup>
                    <FieldGroup label="Assign Lab Technician *">
                      <StaffDropdown
                        value={test.assignedTo}
                        onChange={(v) => updateTest(idx, "assignedTo", v)}
                        staff={labTechs}
                        loading={techsLoading}
                        placeholder="Select a technician…"
                      />
                    </FieldGroup>
                  </div>
                ))}
              </div>

              <button
                onClick={addTest}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-amber-400 hover:text-amber-600 transition-all"
              >
                <PlusCircleLab className="w-4 h-4" /> Add another test
              </button>

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <SubmitBtn
                  onClick={handleSubmit}
                  loading={submitting}
                  label={`Order ${tests.filter((t) => t.testName).length || 1} Test${tests.filter((t) => t.testName).length !== 1 ? "s" : ""}`}
                />
              </div>
            </div>
          </div>
        ))}

      {liveOrders.length === 0 && isCompleted && (
        <div className="flex flex-col items-center gap-2 py-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50/60">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm font-semibold text-gray-400">No lab orders</p>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
import { useAuthStore } from "@/lib/store";
import {
  Settings,
  Shield,
  Bell,
  Database,
  Key,
  ChevronRight,
  Check,
} from "lucide-react";

const SECTIONS = [
  { key: "profile", label: "Profile", icon: Settings },
  { key: "security", label: "Security", icon: Shield },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "system", label: "System", icon: Database },
];

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
          {title}
        </h2>
      </div>
      <div className="px-6 py-5 space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
        style={{ background: value ? "#166534" : "#e5e7eb" }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
          style={{ transform: value ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

export default function AdminSettingsPage() {
  const { user } = useAuthStore();
  const [activeSection, setActiveSection] = useState("profile");
  const [saved, setSaved] = useState(false);

  // Notification toggles
  const [notifs, setNotifs] = useState({
    newPatient: true,
    permissionRequests: true,
    criticalAlerts: true,
    auditAlerts: false,
    systemUpdates: true,
  });

  // System toggles
  const [sys, setSys] = useState({
    blockchainVerification: true,
    auditLogging: true,
    twoFactor: false,
    maintenanceMode: false,
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", maxWidth: 820 }}>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Settings
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage system preferences and configuration
        </p>
      </div>

      <div className="flex gap-5">
        {/* Sidebar nav */}
        <div className="w-44 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 sticky top-6">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={
                  activeSection === key
                    ? {
                        background: "#f0fdf4",
                        color: "#166534",
                        fontWeight: 600,
                      }
                    : { color: "#6b7280" }
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeSection === "profile" && (
            <>
              <SectionCard title="Admin Profile">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-50">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #166534, #15803d)",
                    }}
                  >
                    {user?.firstName?.[0]}
                    {user?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-sm text-gray-400">
                      System Administrator
                    </p>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600 mt-1 inline-block">
                      Admin
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "First Name", value: user?.firstName ?? "" },
                    { label: "Last Name", value: user?.lastName ?? "" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                        {label}
                      </label>
                      <input
                        defaultValue={value}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {activeSection === "security" && (
            <SectionCard title="Security Settings">
              <ToggleRow
                label="Two-Factor Authentication"
                description="Require 2FA for all admin logins"
                value={sys.twoFactor}
                onChange={(v) => setSys((s) => ({ ...s, twoFactor: v }))}
              />
              <ToggleRow
                label="Blockchain Verification"
                description="Verify all records against Hyperledger Fabric"
                value={sys.blockchainVerification}
                onChange={(v) =>
                  setSys((s) => ({ ...s, blockchainVerification: v }))
                }
              />
              <div className="pt-4 border-t border-gray-50">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Change Password
                </p>
                {["Current Password", "New Password", "Confirm Password"].map(
                  (label) => (
                    <div key={label} className="mb-3">
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        {label}
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
                      />
                    </div>
                  ),
                )}
              </div>
            </SectionCard>
          )}

          {activeSection === "notifications" && (
            <SectionCard title="Notification Preferences">
              <ToggleRow
                label="New Patient Registrations"
                description="Get notified when a new patient registers"
                value={notifs.newPatient}
                onChange={(v) => setNotifs((n) => ({ ...n, newPatient: v }))}
              />
              <ToggleRow
                label="Permission Requests"
                description="Alerts for pending access requests"
                value={notifs.permissionRequests}
                onChange={(v) =>
                  setNotifs((n) => ({ ...n, permissionRequests: v }))
                }
              />
              <ToggleRow
                label="Critical Priority Visits"
                description="Immediate alerts for critical patient visits"
                value={notifs.criticalAlerts}
                onChange={(v) =>
                  setNotifs((n) => ({ ...n, criticalAlerts: v }))
                }
              />
              <ToggleRow
                label="Audit Alerts"
                description="Notify on suspicious audit activity"
                value={notifs.auditAlerts}
                onChange={(v) => setNotifs((n) => ({ ...n, auditAlerts: v }))}
              />
              <ToggleRow
                label="System Updates"
                description="Platform updates and maintenance notices"
                value={notifs.systemUpdates}
                onChange={(v) => setNotifs((n) => ({ ...n, systemUpdates: v }))}
              />
            </SectionCard>
          )}

          {activeSection === "system" && (
            <>
              <SectionCard title="System Configuration">
                <ToggleRow
                  label="Audit Logging"
                  description="Log all system actions to the database and blockchain"
                  value={sys.auditLogging}
                  onChange={(v) => setSys((s) => ({ ...s, auditLogging: v }))}
                />
                <ToggleRow
                  label="Maintenance Mode"
                  description="Disable access for non-admin users"
                  value={sys.maintenanceMode}
                  onChange={(v) =>
                    setSys((s) => ({ ...s, maintenanceMode: v }))
                  }
                />
              </SectionCard>
              <SectionCard title="System Info">
                {[
                  { label: "Platform", value: "HealthChain v1.0" },
                  { label: "Blockchain", value: "Hyperledger Fabric" },
                  {
                    label: "Channel",
                    value:
                      process.env.NEXT_PUBLIC_FABRIC_CHANNEL ??
                      "healthcare-channel",
                  },
                  {
                    label: "API",
                    value:
                      process.env.NEXT_PUBLIC_API_URL ??
                      "http://localhost:3000",
                  },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                  >
                    <p className="text-sm text-gray-500">{label}</p>
                    <p className="text-sm font-semibold text-gray-800 font-mono">
                      {value}
                    </p>
                  </div>
                ))}
              </SectionCard>
            </>
          )}

          {/* Save button */}
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md"
              style={{
                background: saved
                  ? "#15803d"
                  : "linear-gradient(135deg, #166534, #15803d)",
              }}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" /> Saved!
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

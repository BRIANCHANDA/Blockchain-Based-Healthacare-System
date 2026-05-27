"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { patientApi } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  Search,
  User,
  Calendar,
  Phone,
  MapPin,
  ChevronRight,
  Loader2,
  AlertCircle,
  Users,
  Activity,
  FileText,
  Filter,
} from "lucide-react";
import { format } from "date-fns";

// Safe date formatter
function safeFormatDate(d: any, fmt: string): string {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "—" : format(dt, fmt);
}

export default function DoctorPatientsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<any[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterBloodType, setFilterBloodType] = useState<string>("all");
  const [error, setError] = useState("");

  const institutionId = (user as any)?.institutionId;
  const institutionName = (user as any)?.institutionName;

  useEffect(() => {
    const fetchPatients = async () => {
      if (!institutionId) {
        setError("No institution assigned to your account.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Fetch all patients from this institution
        const res = await patientApi.getAllByInstitution(institutionId);
        const patientsData = res.data.data?.patients ?? [];
        setPatients(patientsData);
        setFilteredPatients(patientsData);
      } catch (err: any) {
        setError(
          err.response?.data?.error?.message ?? "Failed to load patients.",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, [institutionId]);

  // Filter patients based on search and filters
  useEffect(() => {
    let result = [...patients];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.firstName?.toLowerCase().includes(q) ||
          p.lastName?.toLowerCase().includes(q) ||
          p.medicalRecordNumber?.toLowerCase().includes(q) ||
          p.nationalId?.toLowerCase().includes(q) ||
          p.phoneNumber?.includes(q),
      );
    }

    // Gender filter
    if (filterGender !== "all") {
      result = result.filter((p) => p.gender === filterGender);
    }

    // Blood type filter
    if (filterBloodType !== "all") {
      result = result.filter((p) => p.bloodType === filterBloodType);
    }

    setFilteredPatients(result);
  }, [searchQuery, filterGender, filterBloodType, patients]);

  const handleViewPatient = (patientId: string) => {
    router.push(`/dashboard/doctor/patients/${patientId}`);
  };

  if (!institutionId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-lg font-semibold text-gray-700">
          No Institution Assigned
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Contact your administrator to assign you to an institution.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 size={48} className="animate-spin text-green-600 mb-4" />
        <p className="text-sm text-gray-500">Loading patients...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle size={48} className="text-red-400 mb-4" />
        <p className="text-lg font-semibold text-gray-700">Error</p>
        <p className="text-sm text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div
      className="max-w-7xl mx-auto"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Users size={20} className="text-green-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Patient Directory
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {institutionName ?? "Your Institution"} ·{" "}
              {filteredPatients.length} of {patients.length} patients
            </p>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Search Patients
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, MRN, National ID, Phone..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none
                  focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white placeholder:text-gray-400 transition-all"
              />
            </div>
          </div>

          {/* Gender Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Gender
            </label>
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none
                focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
            >
              <option value="all">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Blood Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
              Blood Type
            </label>
            <select
              value={filterBloodType}
              onChange={(e) => setFilterBloodType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none
                focus:border-green-600 focus:ring-2 focus:ring-green-600/10 focus:bg-white transition-all"
            >
              <option value="all">All</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
        </div>

        {/* Active Filters Summary */}
        {(searchQuery ||
          filterGender !== "all" ||
          filterBloodType !== "all") && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400">Active filters:</span>
            {searchQuery && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-100">
                Search: "{searchQuery}"
              </span>
            )}
            {filterGender !== "all" && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                Gender: {filterGender}
              </span>
            )}
            {filterBloodType !== "all" && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-100">
                Blood: {filterBloodType}
              </span>
            )}
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterGender("all");
                setFilterBloodType("all");
              }}
              className="text-xs text-gray-400 hover:text-gray-600 underline ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Users size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">
                {patients.length}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Total Patients</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Activity size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">
                {filteredPatients.length}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Filtered Results</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <FileText size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">
                {patients.reduce((sum, p) => sum + (p.visitCount ?? 0), 0)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Total Visits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Patient List */}
      {filteredPatients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Users size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">
            No patients found
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {searchQuery || filterGender !== "all" || filterBloodType !== "all"
              ? "Try adjusting your filters"
              : "No patients registered at this institution yet"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Patient
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    MRN
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Demographics
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Contact
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Visits
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleViewPatient(patient.id)}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-sm font-bold text-green-700">
                          {patient.firstName?.[0]}
                          {patient.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-xs text-gray-400">
                            {patient.nationalId ?? "—"}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-sm font-mono font-semibold text-gray-700">
                        {patient.medicalRecordNumber}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <User size={12} className="text-gray-400" />
                          <span className="capitalize">{patient.gender}</span>
                          {patient.bloodType && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="font-semibold text-red-600">
                                {patient.bloodType}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar size={12} className="text-gray-400" />
                          DOB:{" "}
                          {safeFormatDate(patient.dateOfBirth, "dd MMM yyyy")}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        {patient.phoneNumber && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Phone size={12} className="text-gray-400" />
                            {patient.phoneNumber}
                          </div>
                        )}
                        {patient.address && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin size={12} className="text-gray-400" />
                            <span className="truncate max-w-[200px]">
                              {patient.address}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">
                            {patient.visitCount ?? 0}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">visits</span>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewPatient(patient.id);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 border border-green-100 transition-all"
                      >
                        View Details
                        <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

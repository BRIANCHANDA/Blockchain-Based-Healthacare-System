"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, user, initFromStorage } = useAuthStore();

  useEffect(() => {
    initFromStorage();
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      switch (user.type) {
        case "practitioner":
          router.push("/dashboard/doctor");
          break;
        case "nurse":
          router.push("/dashboard/nurse");
          break;
        case "admin":
          router.push("/dashboard/admin");
          break;
        case "receptionist":
          router.push("/dashboard/receptionist");
          break;
        default:
          router.push("/login");
          break;
      }
    } else {
      router.push("/login");
    }
  }, [isAuthenticated, user]);

  return (
    <div className="min-h-screen zambia-pattern flex items-center justify-center">
      <div className="text-white text-center">
        <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p
          style={{ fontFamily: "Playfair Display, serif" }}
          className="text-lg"
        >
          Loading HealthChain...
        </p>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import NewVisitPage from "@/components/doctor/tabs/NewVisitPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding: 40,
            textAlign: "center",
            font: "400 13px/1 var(--font-sans)",
            color: "var(--text-muted)",
          }}
        >
          Loading…
        </div>
      }
    >
      <NewVisitPage />
    </Suspense>
  );
}

import { Suspense } from "react";
import NewVisitPage from "../../../../../components/doctor/tabs/NewVisitPage";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
          Loading…
        </div>
      }
    >
      <NewVisitPage />
    </Suspense>
  );
}

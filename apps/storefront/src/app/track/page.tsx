import { Suspense } from "react";
import { TrackRedirect } from "./track-redirect";

export const metadata = { title: "Відстеження посилки" };

// Nova Poshta's own tracking page does not support pre-filling its search
// box from a URL parameter (verified live - see apps/backend/src/lib/
// np-tracking-url.ts for the full list of tested formats, all empty). This
// page is the workaround: it copies the tracking number to the clipboard
// and opens Nova Poshta's tracking page, so the customer only has to paste
// (Ctrl+V) instead of re-typing a 14-digit number from the email.
export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackRedirect />
    </Suspense>
  );
}

import { Eye } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const AUTO_HIDE_MS = 5000;

/** Neutral candidate notice for a new red flag. Polite live region, fades out, no sound/shake/modal. */
export function FlagNotice({ flagNo, max, reason = "look" }: { flagNo: number | null; max: number; reason?: "look" | "tab" }) {
  const [visible, setVisible] = useState(false);
  const valid = flagNo !== null && flagNo >= 1 && flagNo <= max;

  useEffect(() => {
    if (!valid) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [flagNo, valid]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div role="status" aria-live="polite">
        {valid && (
          <div
            data-visible={visible}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-danger-500/30 bg-danger-50 px-4 py-3 text-sm text-danger-700 transition-opacity duration-200 ease-out",
              visible ? "opacity-100" : "invisible opacity-0",
            )}
          >
            <Eye className="size-4" aria-hidden="true" />
            {/* text stays during the fade-out; hidden from assistive tech once faded */}
            <span aria-hidden={!visible}>
              Flag {flagNo} of {max} – {reason === "tab" ? "please stay on the assessment tab." : "please keep your eyes on the screen."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

import { IS_DEMO } from "@/lib/config";

/**
 * Small amber "DEMO — zakup nie zostanie zrealizowany" badge rendered
 * above every purchase CTA in the app during pre-release / closed
 * testing. Gated on the IS_DEMO flag in lib/config.ts — flip to
 * false before App Store / Play Store release and every instance
 * hides at once.
 *
 * Render as: <DemoBadge /> immediately above the purchase button.
 */
export function DemoBadge() {
  if (!IS_DEMO) return null;
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: 11,
        color: "#f59e0b",
        fontWeight: 700,
        marginBottom: 6,
        letterSpacing: 1,
        textTransform: "uppercase",
      }}
    >
      ⚠️ DEMO — zakup nie zostanie zrealizowany
    </div>
  );
}

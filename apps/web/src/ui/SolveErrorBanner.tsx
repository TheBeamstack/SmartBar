/**
 * H1 ([v1.0.4], owner decision A-6): a non-blocking banner shown when a mid-edit solve throws. The
 * store's `withDoc` guard keeps the last good result on screen and sets `solveError`; this strip
 * tells the user the change couldn't be computed and to fix the input. It clears itself the moment
 * the next solve succeeds (`solveError` → null). Role=alert so screen readers announce it (a11y).
 */
import { useStore } from "../store/useStore";
import { t } from "../i18n/strings";

export function SolveErrorBanner() {
  const solveError = useStore((s) => s.solveError);
  const lang = useStore((s) => s.lang);
  if (!solveError) return null;
  const s = t(lang);
  return (
    <div className="solve-error-banner" role="alert" aria-live="assertive">
      {s.solveErrorBanner.replace("{msg}", solveError)}
    </div>
  );
}

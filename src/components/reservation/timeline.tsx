import { PhText } from "@/components/ph";
import type { TimelineStep } from "./format";

// The vertical timeline of the status page (canvas Status.dc.html): a 22px square per step, a 1px line joining them,
// the step title with its state in words (" · done", " · current"), and one line of detail. The current step is
// marked by word, by colour and by aria-current. Ivory ground only.

const FILL: Record<TimelineStep["tone"], string> = {
  ok: "var(--color-ok)",
  wait: "var(--color-wait)",
  none: "transparent",
};

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol aria-label="Progress" className="m-0 list-none p-0">
      {steps.map((s, i) => {
        const reached = s.state !== "upcoming";
        const last = i === steps.length - 1;
        // The line below a step is bronze once the guest has moved past it.
        const lineDone = s.state === "done" && steps[i + 1]?.state !== "upcoming";
        return (
          <li key={s.key} aria-current={s.state === "current" ? "step" : undefined} className="flex gap-5" style={{ minHeight: last ? 0 : 92 }}>
            <div className="flex w-[22px] shrink-0 flex-col items-center" aria-hidden="true">
              <span
                style={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  border: `1px solid ${reached ? "var(--color-bronze)" : "var(--color-taupe)"}`,
                  background: FILL[s.tone],
                }}
              />
              {!last ? <span style={{ flex: 1, width: 1, background: lineDone ? "var(--color-bronze)" : "var(--color-taupe)" }} /> : null}
            </div>
            <div style={{ paddingBottom: last ? 0 : 24 }}>
              <p className="m-0" style={{ fontWeight: 500, color: reached ? "var(--color-ink)" : "var(--color-ink-2)" }}>
                {s.title}
                {s.state === "done" ? " · done" : s.state === "current" ? " · current" : ""}
              </p>
              <p className="m-0" style={{ marginTop: 2, fontSize: 14, color: "var(--color-ink-2)" }}>
                <PhText text={s.detail} />
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// The folio layout of every reserve step (canvas Reserve1-4): the step's content on ivory, the folio spine sticky
// on the right from 1024px, and on smaller screens the "Your stay" bar fixed to the bottom of the viewport.
// No hooks: usable from server pages and from the steps' client components alike.

export function ReserveFrame({
  main,
  spine,
  bar,
}: {
  main: React.ReactNode;
  /** The folio spine (desktop). Hidden below 1024px, where the bar carries the total instead. */
  spine: React.ReactNode;
  /** The mobile "Your stay" bar with the step's action. */
  bar?: React.ReactNode;
}) {
  return (
    <>
      <div className="container-site flex flex-wrap items-start pt-8 pb-10 lg:pt-14 lg:pb-[120px]" style={{ gap: 56 }}>
        <main id="main" tabIndex={-1} className="flex min-w-0 flex-col outline-none" style={{ flex: "999 1 480px" }}>
          {main}
        </main>
        <div className="max-lg:hidden" style={{ flex: "1 1 360px", position: "sticky", top: 24, alignSelf: "flex-start" }}>
          {spine}
        </div>
      </div>
      {bar}
    </>
  );
}

/** "Step 1 of 4 · Three-Bedroom Apartment with Lounge" + the display heading, as on the canvas. */
export function StepHeading({
  step,
  typeName,
  eyebrowExtra,
  title,
  mobileTitle,
  intro,
}: {
  step: number;
  typeName?: string;
  /** Replaces the type name after "Step n of 4 · " (canvas step 2: "optional"). */
  eyebrowExtra?: string;
  title: string;
  /** The canvas mobile heading, when it differs. */
  mobileTitle?: string;
  intro?: React.ReactNode;
}) {
  const after = eyebrowExtra ?? typeName;
  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <p className="eyebrow" style={{ color: "var(--color-bronze)" }}>
        <span className="max-lg:hidden">
          Step {step} of 4{after ? " · " : ""}
        </span>
        {after ? <span className="max-lg:hidden">{after}</span> : null}
        <span className="lg:hidden">{typeName ?? `Step ${step} of 4`}</span>
      </p>
      <h1 className="display text-[38px] lg:text-[56px]" style={{ color: "var(--color-ink)" }}>
        {mobileTitle ? (
          <>
            <span className="max-lg:hidden">{title}</span>
            <span className="lg:hidden">{mobileTitle}</span>
          </>
        ) : (
          title
        )}
      </h1>
      {intro ? (
        <div className="m-0" style={{ color: "var(--color-ink-2)", maxWidth: 620 }}>
          {intro}
        </div>
      ) : null}
    </div>
  );
}

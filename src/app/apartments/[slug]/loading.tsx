import { SiteHeader } from "@/components/site-header";

// Shown while an apartment page loads: the gallery and column in their final shapes, so nothing jumps.

export default function ApartmentLoading() {
  return (
    <>
      <SiteHeader variant="minimal" />
      <main id="main" className="on-ivory" aria-busy="true">
        <p className="sr-only" role="status">
          Loading the apartment.
        </p>
        <div className="container-site pt-10 max-[900px]:px-0! max-[900px]:pt-0" aria-hidden="true">
          <div className="grid grid-cols-3 gap-2 [grid-template-rows:300px_220px] max-[900px]:gap-1 max-[900px]:[grid-template-rows:auto]">
            <div className="plate col-span-3 max-[900px]:aspect-[4/3]" />
            <div className="plate max-[900px]:aspect-square" />
            <div className="plate max-[900px]:aspect-square" />
            <div className="plate max-[900px]:aspect-square" />
          </div>
        </div>
        <div className="container-site flex flex-col gap-5 pt-14 pb-[120px] max-[900px]:pt-8" aria-hidden="true">
          <div style={{ height: 12, width: 220, background: "var(--color-taupe)" }} />
          <div style={{ height: 56, width: "min(560px, 100%)", background: "var(--color-ivory-2)" }} />
          <div style={{ height: 1, width: "min(740px, 100%)", background: "var(--color-bronze)", marginTop: 24 }} />
        </div>
      </main>
    </>
  );
}

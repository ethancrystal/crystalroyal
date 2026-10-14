"use client";

import { useEffect, useRef } from "react";

/** Moves focus to a message that arrives with the page (after a server action sent the guest back here). */
export function FocusOnMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      {children}
    </div>
  );
}

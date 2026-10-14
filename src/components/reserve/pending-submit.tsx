"use client";

import { useFormStatus } from "react-dom";

// A submit button that refuses a second press while its form is being sent (no duplicate reservations from a double
// tap). It stays focusable (aria-disabled), so keyboard focus is not lost while the action runs.

export function PendingSubmit({
  children,
  className,
  style,
  name,
  value,
  describedBy,
  form,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  name?: string;
  value?: string;
  describedBy?: string;
  /** id of the form, when the button sits outside it. */
  form?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      form={form}
      className={className}
      aria-disabled={pending || undefined}
      aria-busy={pending || undefined}
      aria-describedby={describedBy}
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
      style={{ ...style, ...(pending ? { opacity: 0.6, cursor: "progress" } : {}) }}
    >
      {children}
    </button>
  );
}

"use client";

// Opens the browser's print dialog for the voucher page (A4 print stylesheet in voucher/page.tsx).

export function PrintButton({ className = "btn-light", children = "Print voucher" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {children}
    </button>
  );
}

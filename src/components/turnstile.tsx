"use client";

import { useEffect, useRef } from "react";

// Cloudflare Turnstile. Renders the widget inside a form so the form posts "cf-turnstile-response"; the server
// checks it with verifyTurnstile() (src/lib/protect.ts). Renders nothing until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | undefined;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** Loads the Turnstile script once per page, however many widgets mount. */
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing"))));
    script.addEventListener("error", () => {
      loading = null;
      reject(new Error("turnstile failed to load"));
    });
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
  return loading;
}

export function Turnstile({
  tone = "ivory",
  action,
  className = "",
}: {
  /** midnight renders the dark widget. */
  tone?: "midnight" | "ivory";
  /** Optional action name, visible in Turnstile analytics (e.g. "reserve", "upload"). */
  action?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    const el = ref.current;
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        widgetId = api.render(el, {
          sitekey: SITE_KEY,
          theme: tone === "midnight" ? "dark" : "light",
          // The standard widget is 300px wide; below that (a 320px phone inside its gutters) use the compact one.
          size: el.clientWidth > 0 && el.clientWidth < 300 ? "compact" : "flexible",
          "response-field-name": "cf-turnstile-response",
          ...(action ? { action } : {}),
        });
      })
      .catch((e) => console.error(e));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [tone, action]);

  if (!SITE_KEY) return null;
  return <div ref={ref} className={className} style={{ minHeight: 65, maxWidth: "100%" }} />;
}

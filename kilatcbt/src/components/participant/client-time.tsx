"use client";

import * as React from "react";
import { formatDateTimeId } from "@/lib/utils";
import { useMounted } from "@/lib/client-hooks";

/**
 * Renders a timestamp only after mount. The server has no reliable notion of the
 * participant's "now", so rendering it during SSR would produce a hydration
 * mismatch (and an unstable value during prerender).
 */
export function ClientTime({ fallback = "baru saja" }: { fallback?: string }) {
  const mounted = useMounted();
  const text = React.useMemo(
    () => (mounted ? formatDateTimeId(new Date()) : null),
    [mounted],
  );

  return <span suppressHydrationWarning>{text ?? fallback}</span>;
}

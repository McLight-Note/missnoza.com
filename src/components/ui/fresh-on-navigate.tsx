"use client";

import { useRouter } from "next/navigation";
import { Fragment, type ReactNode } from "react";

/**
 * Next.js keeps a page's state when you navigate away and come back.
 * Wrap a form in this to start it empty on every fresh visit (a link or
 * redirect), while still restoring it for the browser's Back/Forward.
 */
export function FreshOnNavigate({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}

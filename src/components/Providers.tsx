"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // No refetch on tab focus: a slow check on a phone must never look like a logout
  return <SessionProvider refetchOnWindowFocus={false}>{children}</SessionProvider>;
}

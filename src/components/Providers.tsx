"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { Toaster } from "sonner";
import { useApplyTheme } from "@/lib/theme";

export function Providers({ children }: { children: ReactNode }) {
  const theme = useApplyTheme();
  // No refetch on tab focus: a slow check on a phone must never look like a logout
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      {children}
      <Toaster theme={theme} position="top-right" richColors closeButton />
    </SessionProvider>
  );
}

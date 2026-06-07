"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { setClientToken } from "@/lib/services/django";

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = authClient.useSession();
  const accessToken = (session?.user as { access_token?: string })?.access_token;

  useEffect(() => {
    setClientToken(accessToken ?? null);
  }, [accessToken]);

  return <>{children}</>;
}

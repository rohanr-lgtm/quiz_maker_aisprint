"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { clearCurrentUser } from "@/lib/client-identity";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      clearCurrentUser();
      router.push("/login");
    }
  }

  return (
    <Button variant="outline" onClick={handleLogout} disabled={isLoggingOut}>
      Logout
    </Button>
  );
}

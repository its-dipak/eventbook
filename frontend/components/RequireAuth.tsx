"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Empty, Loading } from "./States";

/** Guards a page in the browser. The real protection is on the API; this just shows a friendly message. */
export function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) {
    return (
      <Empty title="Please log in to continue">
        <Link href="/login" className="btn">
          Log in
        </Link>
      </Empty>
    );
  }
  if (admin && user.role !== "admin") {
    return <Empty title="Admins only">You do not have permission to view this page.</Empty>;
  }
  return <>{children}</>;
}

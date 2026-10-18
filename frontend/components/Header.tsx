"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="site-header">
      <div className="container header-row">
        <Link href="/" className="brand">
          Event<span>Book</span>
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/">Events</Link>
          {user && <Link href="/bookings">My bookings</Link>}
          {user?.role === "admin" && <Link href="/admin">Admin</Link>}
          {!loading &&
            (user ? (
              <>
                <span className="nav-user" title={user.email}>
                  {user.name}
                </span>
                <button
                  className="btn btn-small btn-ghost"
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/login">Log in</Link>
                <Link href="/register" className="btn btn-small">
                  Sign up
                </Link>
              </>
            ))}
        </nav>
      </div>
    </header>
  );
}

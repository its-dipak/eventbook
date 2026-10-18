"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { Empty, ErrorBox, Loading } from "@/components/States";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { MyBooking } from "@/lib/types";

function Bookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBookings((await api<{ data: MyBooking[] }>("/me/bookings", { auth: true })).data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function cancel(b: MyBooking) {
    if (!confirm(`Cancel your booking for "${b.event.title}"?`)) return;
    setCancelling(b.id);
    setActionError(null);
    try {
      await api(`/bookings/${b.id}`, { method: "DELETE", auth: true });
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      await load();
      setCancelling(null);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={load} />;

  const active = bookings.filter((b) => b.status === "confirmed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");

  return (
    <>
      <h1>My bookings</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Your seats at upcoming and past events.
      </p>
      {actionError && (
        <div className="alert alert-error" role="alert">
          {actionError}
        </div>
      )}

      {bookings.length === 0 ? (
        <Empty title="No bookings yet">
          <Link href="/">Browse events</Link> and book your first seat.
        </Empty>
      ) : (
        <>
          <h2>Active ({active.length})</h2>
          {active.length === 0 ? (
            <p className="muted">You have no active bookings.</p>
          ) : (
            <div className="list">
              {active.map((b) => (
                <div className="card row-card" key={b.id}>
                  <div>
                    <h3>
                      <Link href={`/events/${b.event.id}`}>{b.event.title}</Link>
                    </h3>
                    <p className="muted">
                      {formatDateTime(b.event.startsAt)} · {b.event.venue}
                    </p>
                  </div>
                  {b.event.isPast ? (
                    <span className="badge badge-muted">Attended / ended</span>
                  ) : (
                    <button className="btn btn-small btn-danger-ghost" disabled={cancelling === b.id} onClick={() => cancel(b)}>
                      {cancelling === b.id ? "Cancelling..." : "Cancel booking"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {cancelled.length > 0 && (
            <>
              <h2 style={{ marginTop: 28 }}>Cancelled ({cancelled.length})</h2>
              <div className="list">
                {cancelled.map((b) => (
                  <div className="card row-card" key={b.id} style={{ opacity: 0.75 }}>
                    <div>
                      <h3>
                        <Link href={`/events/${b.event.id}`}>{b.event.title}</Link>
                      </h3>
                      <p className="muted">
                        {formatDateTime(b.event.startsAt)} · cancelled {b.cancelledAt ? formatDateTime(b.cancelledAt) : ""}
                      </p>
                    </div>
                    <span className="badge badge-muted">Cancelled</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export default function BookingsPage() {
  return (
    <RequireAuth>
      <Bookings />
    </RequireAuth>
  );
}

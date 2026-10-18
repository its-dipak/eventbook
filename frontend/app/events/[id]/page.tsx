"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SeatBadge } from "@/components/EventCard";
import { Empty, ErrorBox, Loading } from "@/components/States";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import type { EventItem, MyBooking } from "@/lib/types";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [booking, setBooking] = useState<MyBooking | null>(null); // the user's active booking for this event
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api<{ event: EventItem }>(`/events/${id}`);
      setEvent(r.event);
      if (user) {
        const mine = await api<{ data: MyBooking[] }>("/me/bookings", { auth: true });
        setBooking(mine.data.find((b) => b.event.id === r.event.id && b.status === "confirmed") ?? null);
      } else {
        setBooking(null);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function book() {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await api(`/events/${id}/bookings`, { method: "POST", auth: true });
      setNotice("You're booked! See you there.");
    } catch (e) {
      setActionError(errorMessage(e)); // e.g. "Sorry, this event is full"
    } finally {
      await load(); // always refresh so seat counts are never stale
      setBusy(false);
    }
  }

  async function cancel() {
    if (!booking || !confirm("Cancel your booking for this event?")) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await api(`/bookings/${booking.id}`, { method: "DELETE", auth: true });
      setNotice("Your booking was cancelled.");
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      await load();
      setBusy(false);
    }
  }

  if (loading || authLoading) return <Loading />;
  if (notFound) {
    return (
      <Empty title="Event not found">
        <Link href="/">Back to all events</Link>
      </Empty>
    );
  }
  if (error || !event) return <ErrorBox message={error ?? "Could not load the event"} onRetry={load} />;

  const full = event.seatsLeft === 0;

  return (
    <>
      <p>
        <Link href="/">← All events</Link>
      </p>
      <div className="detail-grid">
        <section className="panel">
          <SeatBadge event={event} />
          <h1 style={{ marginTop: 8 }}>{event.title}</h1>
          <p className="detail-desc">{event.description}</p>
        </section>

        <aside className="panel" aria-label="Booking">
          <dl className="facts">
            <dt>When</dt>
            <dd>{formatDateTime(event.startsAt)}</dd>
            <dt>Where</dt>
            <dd>{event.venue}</dd>
            <dt>Seats</dt>
            <dd>
              {event.seatsLeft} of {event.totalSeats} available
            </dd>
          </dl>

          {notice && (
            <div className="alert alert-success" role="status">
              {notice}
            </div>
          )}
          {actionError && (
            <div className="alert alert-error" role="alert">
              {actionError}
            </div>
          )}

          {event.isPast ? (
            <p className="muted">This event has ended.</p>
          ) : !user ? (
            <Link href="/login" className="btn" style={{ width: "100%" }}>
              Log in to book
            </Link>
          ) : booking ? (
            <>
              <p className="muted" style={{ marginBottom: 10 }}>
                ✓ You have a seat for this event.
              </p>
              <button className="btn btn-danger-ghost" style={{ width: "100%" }} onClick={cancel} disabled={busy}>
                {busy ? "Working..." : "Cancel my booking"}
              </button>
            </>
          ) : (
            <button className="btn" style={{ width: "100%" }} onClick={book} disabled={busy || full}>
              {busy ? "Booking..." : full ? "Sold out" : "Book a seat"}
            </button>
          )}
        </aside>
      </div>
    </>
  );
}

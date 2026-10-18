"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { EventForm } from "@/components/EventForm";
import { RequireAuth } from "@/components/RequireAuth";
import { Empty, ErrorBox, Loading } from "@/components/States";
import { api, ApiError, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Attendee, EventItem } from "@/lib/types";

function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [e, a] = await Promise.all([
        api<{ event: EventItem }>(`/events/${id}`),
        api<{ data: Attendee[] }>(`/events/${id}/bookings`, { auth: true }),
      ]);
      setEvent(e.event);
      setAttendees(a.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading />;
  if (notFound) return <Empty title="Event not found"><Link href="/admin">Back to events</Link></Empty>;
  if (error || !event) return <ErrorBox message={error ?? "Could not load the event"} onRetry={load} />;

  const active = attendees.filter((a) => a.status === "confirmed");

  return (
    <>
      <p>
        <Link href="/admin">← Manage events</Link>
      </p>
      <h1 style={{ marginBottom: 16 }}>Edit event</h1>

      <div className="panel">
        {saved && (
          <div className="alert alert-success" role="status">
            Changes saved.
          </div>
        )}
        <EventForm
          // Remount with fresh values after a save, so the form always matches the server.
          key={`${event.id}-${event.totalSeats}-${event.startsAt}-${event.title}`}
          initial={event}
          submitLabel="Save changes"
          onSubmit={async (values) => {
            setSaved(false);
            await api(`/events/${id}`, { method: "PATCH", body: values, auth: true });
            await load();
            setSaved(true);
          }}
        />
      </div>

      <h2 style={{ marginTop: 32 }}>
        Attendees ({active.length} of {event.totalSeats} seats booked)
      </h2>
      {attendees.length === 0 ? (
        <Empty title="No bookings yet">Attendees will appear here once people book.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Booked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => (
                <tr key={a.id}>
                  <td>{a.user.name}</td>
                  <td>{a.user.email}</td>
                  <td>{formatDateTime(a.bookedAt)}</td>
                  <td>
                    {a.status === "confirmed" ? (
                      <span className="badge badge-ok">Confirmed</span>
                    ) : (
                      <span className="badge badge-muted">Cancelled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function EditEventPage() {
  return (
    <RequireAuth admin>
      <EditEvent />
    </RequireAuth>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SeatBadge } from "@/components/EventCard";
import { Pagination } from "@/components/Pagination";
import { RequireAuth } from "@/components/RequireAuth";
import { Empty, ErrorBox, Loading } from "@/components/States";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { EventItem, Pagination as PaginationInfo } from "@/lib/types";

function AdminEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Wait until the admin stops typing before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ when: "all", limit: "10", page: String(page) });
      if (search) params.set("search", search);
      const r = await api<{ data: EventItem[]; pagination: PaginationInfo }>(`/events?${params}`);
      setEvents(r.data);
      setPagination(r.pagination);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(ev: EventItem) {
    if (!confirm(`Delete "${ev.title}"? This cannot be undone.`)) return;
    setActionError(null);
    try {
      await api(`/events/${ev.id}`, { method: "DELETE", auth: true });
      // Deleting the last item on a page would leave it empty, so step back one page.
      if (events.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (e) {
      setActionError(errorMessage(e)); // e.g. the event still has active bookings
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Manage events</h1>
          <p className="muted">Create, edit and remove events.</p>
        </div>
        <Link href="/admin/events/new" className="btn">
          + New event
        </Link>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search events by title"
          aria-label="Search events by title"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>

      {actionError && (
        <div className="alert alert-error" role="alert">
          {actionError}
        </div>
      )}

      {error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : loading ? (
        <Loading />
      ) : events.length === 0 ? (
        <Empty title={search ? `No events match "${search}"` : "No events yet"}>
          {search ? "Try a different search." : "Create your first event to get started."}
        </Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Seats</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="wrap">
                      <strong>{ev.title}</strong>
                      <div className="muted">{ev.venue}</div>
                    </td>
                    <td>{formatDateTime(ev.startsAt)}</td>
                    <td>
                      {ev.totalSeats - ev.seatsLeft} / {ev.totalSeats} booked
                    </td>
                    <td>
                      <SeatBadge event={ev} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <Link href={`/admin/events/${ev.id}`} className="btn btn-small btn-ghost">
                          Edit / attendees
                        </Link>
                        <button className="btn btn-small btn-danger-ghost" onClick={() => remove(ev)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pagination && <Pagination pagination={pagination} onPage={setPage} />}
        </>
      )}
    </>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth admin>
      <AdminEvents />
    </RequireAuth>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { EventCard } from "@/components/EventCard";
import { Pagination } from "@/components/Pagination";
import { Empty, ErrorBox, Loading } from "@/components/States";
import { api, errorMessage } from "@/lib/api";
import type { EventItem, Pagination as PaginationInfo } from "@/lib/types";

type When = "upcoming" | "past";

export default function HomePage() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState(""); // debounced copy of input
  const [when, setWhen] = useState<When>("upcoming");
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Wait until the user stops typing before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    let cancelled = false; // ignore responses that arrive after a newer request started
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ when, page: String(page), limit: "9" });
    if (search) params.set("search", search);

    api<{ data: EventItem[]; pagination: PaginationInfo }>(`/events?${params}`)
      .then((r) => {
        if (cancelled) return;
        setEvents(r.data);
        setPagination(r.pagination);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [search, when, page, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <p className="muted">Browse what is coming up and book your seat.</p>
        </div>
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

      <div className="tabs" role="group" aria-label="Show events">
        {(["upcoming", "past"] as const).map((w) => (
          <button
            key={w}
            className="tab"
            aria-pressed={when === w}
            onClick={() => {
              setWhen(w);
              setPage(1);
            }}
          >
            {w === "upcoming" ? "Upcoming" : "Past"}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={retry} />
      ) : loading ? (
        <Loading label="Loading events..." />
      ) : events.length === 0 ? (
        <Empty title={search ? `No events match "${search}"` : `No ${when} events`}>
          {search ? "Try a different search." : "Check back soon."}
        </Empty>
      ) : (
        <>
          <div className="event-grid">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
          {pagination && <Pagination pagination={pagination} onPage={setPage} />}
        </>
      )}
    </>
  );
}

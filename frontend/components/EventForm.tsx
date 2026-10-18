"use client";

import { useState, type FormEvent } from "react";
import { ApiError, errorMessage } from "@/lib/api";
import { toLocalInput } from "@/lib/format";
import type { EventItem } from "@/lib/types";

export interface EventFormValues {
  title: string;
  description: string;
  startsAt: string; // ISO
  venue: string;
  totalSeats: number;
}

export function EventForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: EventItem;
  submitLabel: string;
  onSubmit: (values: EventFormValues) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [startsAt, setStartsAt] = useState(initial ? toLocalInput(initial.startsAt) : "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [totalSeats, setTotalSeats] = useState(String(initial?.totalSeats ?? 20));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    const seats = Number(totalSeats);
    if (!Number.isInteger(seats) || seats < 1) {
      setFieldErrors({ totalSeats: "Enter a whole number of seats (at least 1)" });
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        title,
        description,
        // datetime-local is in the admin's own time zone and drops seconds, so if the admin did not
        // touch the field, send the original value back untouched (otherwise it looks like a date change).
        startsAt: initial && startsAt === toLocalInput(initial.startsAt) ? initial.startsAt : new Date(startsAt).toISOString(),
        venue,
        totalSeats: seats,
      });
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form form-wide" onSubmit={submit}>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} />
        {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
      </div>
      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" required maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
        {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="startsAt">Date and time</label>
          <input id="startsAt" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          {fieldErrors.startsAt && <span className="field-error">{fieldErrors.startsAt}</span>}
        </div>
        <div className="field">
          <label htmlFor="totalSeats">Total seats</label>
          <input
            id="totalSeats"
            type="number"
            min={1}
            step={1}
            required
            value={totalSeats}
            onChange={(e) => setTotalSeats(e.target.value)}
          />
          {fieldErrors.totalSeats && <span className="field-error">{fieldErrors.totalSeats}</span>}
        </div>
      </div>
      <div className="field">
        <label htmlFor="venue">Venue</label>
        <input id="venue" required maxLength={200} value={venue} onChange={(e) => setVenue(e.target.value)} />
        {fieldErrors.venue && <span className="field-error">{fieldErrors.venue}</span>}
      </div>
      <div>
        <button className="btn" disabled={busy}>
          {busy ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

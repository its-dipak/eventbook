import Link from "next/link";
import { formatDateTime } from "@/lib/format";
import type { EventItem } from "@/lib/types";

export function SeatBadge({ event }: { event: EventItem }) {
  if (event.isPast) return <span className="badge badge-muted">Ended</span>;
  if (event.seatsLeft === 0) return <span className="badge badge-danger">Sold out</span>;
  if (event.seatsLeft <= 3) return <span className="badge badge-warn">Only {event.seatsLeft} left</span>;
  return <span className="badge badge-ok">{event.seatsLeft} seats left</span>;
}

export function EventCard({ event }: { event: EventItem }) {
  return (
    <Link href={`/events/${event.id}`} className="card event-card">
      <div className="card-top">
        <SeatBadge event={event} />
      </div>
      <h3>{event.title}</h3>
      <p className="muted">{formatDateTime(event.startsAt)}</p>
      <p className="muted">{event.venue}</p>
      <p className="seats">
        {event.seatsLeft} of {event.totalSeats} seats available
      </p>
    </Link>
  );
}

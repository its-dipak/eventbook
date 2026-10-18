export interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
}

export interface EventItem {
  id: number;
  title: string;
  description: string;
  startsAt: string;
  venue: string;
  totalSeats: number;
  seatsLeft: number;
  isPast: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MyBooking {
  id: number;
  status: "confirmed" | "cancelled";
  bookedAt: string;
  cancelledAt: string | null;
  event: { id: number; title: string; startsAt: string; venue: string; isPast: boolean };
}

export interface Attendee {
  id: number;
  status: "confirmed" | "cancelled";
  bookedAt: string;
  cancelledAt: string | null;
  user: { id: number; name: string; email: string };
}

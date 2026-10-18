"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EventForm } from "@/components/EventForm";
import { RequireAuth } from "@/components/RequireAuth";
import { api } from "@/lib/api";

export default function NewEventPage() {
  const router = useRouter();
  return (
    <RequireAuth admin>
      <p>
        <Link href="/admin">← Manage events</Link>
      </p>
      <h1 style={{ marginBottom: 16 }}>New event</h1>
      <div className="panel">
        <EventForm
          submitLabel="Publish event"
          onSubmit={async (values) => {
            await api("/events", { method: "POST", body: values, auth: true });
            router.push("/admin");
          }}
        />
      </div>
    </RequireAuth>
  );
}

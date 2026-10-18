"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await register(name, email, password);
      router.push("/");
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.field, d.message])));
      } else {
        setError(errorMessage(err));
      }
      setBusy(false);
    }
  }

  return (
    <div className="panel form-narrow">
      <h1>Create account</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Sign up to book seats at events.
      </p>
      <form className="form" onSubmit={submit}>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="hint">At least 8 characters.</span>
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </div>
        <button className="btn" disabled={busy}>
          {busy ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        Already registered? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}

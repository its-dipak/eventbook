import type { Pagination as P } from "@/lib/types";

export function Pagination({ pagination, onPage }: { pagination: P; onPage: (page: number) => void }) {
  if (pagination.totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pagination">
      <button className="btn btn-small btn-ghost" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>
        ← Previous
      </button>
      <span>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <button
        className="btn btn-small btn-ghost"
        disabled={pagination.page >= pagination.totalPages}
        onClick={() => onPage(pagination.page + 1)}
      >
        Next →
      </button>
    </nav>
  );
}

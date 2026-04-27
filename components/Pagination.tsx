"use client";

import { useState, useEffect } from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemsPerPage?: number;
}

export default function Pagination({ currentPage, totalPages, onPageChange, totalItems, itemsPerPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  const start = totalItems ? (currentPage - 1) * (itemsPerPage || 20) + 1 : 0;
  const end = totalItems ? Math.min(currentPage * (itemsPerPage || 20), totalItems) : 0;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
      {totalItems !== undefined && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          แสดง {start}-{end} จาก {totalItems} รายการ
        </p>
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: "var(--card-border)", color: "var(--foreground)", background: "var(--card-bg)" }}
        >
          &lt;
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`dot-${i}`} className="px-2 text-xs" style={{ color: "var(--muted)" }}>...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                currentPage === p
                  ? "text-white shadow-sm"
                  : "border"
              }`}
              style={
                currentPage === p
                  ? { background: "var(--primary)" }
                  : { borderColor: "var(--card-border)", color: "var(--foreground)", background: "var(--card-bg)" }
              }
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ borderColor: "var(--card-border)", color: "var(--foreground)", background: "var(--card-bg)" }}
        >
          &gt;
        </button>
      </div>
    </div>
  );
}

// Hook for easy pagination
export function usePagination<T>(items: T[], perPage: number = 20) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(items.length / perPage);
  const paged = items.slice((currentPage - 1) * perPage, currentPage * perPage);

  // Reset to page 1 when items count changes (e.g. filter/search)
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  return {
    paged,
    currentPage,
    totalPages,
    totalItems: items.length,
    itemsPerPage: perPage,
    setCurrentPage: (p: number) => setCurrentPage(Math.max(1, Math.min(p, totalPages || 1))),
  };
}

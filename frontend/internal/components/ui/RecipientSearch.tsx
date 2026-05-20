"use client";

import { useState, useEffect, useRef } from "react";
import { searchUsers } from "@/lib/services/users";
import { listMailboxes } from "@/lib/services/cases";
import type { Mailbox, UserSearchResult } from "@/lib/types";

type RecipientResult =
  | { type: "user"; data: UserSearchResult }
  | { type: "mailbox"; data: Mailbox };

interface Props {
  onSelect: (result: RecipientResult | null) => void;
  placeholder?: string;
}

export type { RecipientResult };

export default function RecipientSearch({ onSelect, placeholder = "Search by name or email…" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<RecipientResult | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || selected) { setResults([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [users, mailboxes] = await Promise.all([
          searchUsers(query),
          listMailboxes(query),
        ]);
        const combined: RecipientResult[] = [
          ...users.map(u => ({ type: "user" as const, data: u })),
          ...mailboxes.map(m => ({ type: "mailbox" as const, data: m })),
        ];
        setResults(combined);
        setOpen(combined.length > 0);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, selected]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(result: RecipientResult) {
    setSelected(result);
    setQuery(result.type === "user" ? result.data.full_name : result.data.name);
    setOpen(false);
    onSelect(result);
  }

  function handleClear() {
    setSelected(null);
    setQuery("");
    setResults([]);
    onSelect(null);
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="text"
          className="govuk-input"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setSelected(null); onSelect(null); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {selected && (
          <button
            type="button"
            onClick={handleClear}
            className="govuk-body-s"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--govuk-secondary-text-colour)", whiteSpace: "nowrap" }}
          >
            Clear
          </button>
        )}
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: "var(--govuk-secondary-text-colour)", marginTop: 4 }}>Searching…</div>
      )}

      {open && results.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            background: "#fff",
            border: "1px solid var(--govuk-border-colour)",
            width: "100%",
            maxHeight: 220,
            overflowY: "auto",
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {results.map((r, i) => {
            const label = r.type === "user" ? r.data.full_name : r.data.name;
            const sub   = r.data.email;
            const badge = r.type === "user"
              ? (r.data.role === "foi_team" ? "FOI team" : "Assignee")
              : "Mailbox";
            return (
              <li
                key={i}
                role="option"
                aria-selected={false}
                onClick={() => handleSelect(r)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  borderBottom: i < results.length - 1 ? "1px solid var(--govuk-border-colour)" : undefined,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--govuk-template-background-colour)")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--govuk-secondary-text-colour)" }}>{sub}</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--govuk-secondary-text-colour)", background: "var(--govuk-template-background-colour)", padding: "2px 6px", whiteSpace: "nowrap" }}>
                  {badge}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

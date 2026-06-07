"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { Tag } from "@/components/ui/Tag";
import { updateUser, searchUsers } from "@/lib/services/users";
import type { ApiUser, UserSearchResult } from "@/lib/types";

interface Props {
  initial: ApiUser[];
  currentUserId: number;
}

function FOITeamRow({ u, currentUserId, onUpdate, onRemove }: {
  u: ApiUser;
  currentUserId: number;
  onUpdate: (updated: ApiUser) => void;
  onRemove: (id: number) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSelf = u.id === currentUserId;

  function handleToggleActive() {
    startTransition(async () => {
      try {
        const updated = await updateUser(u.id, { is_active: !u.is_active });
        onUpdate(updated);
        setError(null);
      } catch {
        setError("Failed to update user.");
      }
    });
  }

  function handleRemove() {
    startTransition(async () => {
      try {
        await updateUser(u.id, { role: "assignee" });
        onRemove(u.id);
        setError(null);
      } catch {
        setError("Failed to update user.");
      }
    });
  }

  return (
    <tr className="govuk-table__row" style={{ opacity: u.is_active ? 1 : 0.55 }}>
      <td className="govuk-table__cell">
        <div style={{ fontSize: 14, fontWeight: 500 }}>
          {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.email}
          {isSelf && <span style={{ fontSize: 11, marginLeft: 6, color: "var(--govuk-secondary-text-colour)" }}>(you)</span>}
        </div>
        <div className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>{u.email}</div>
        {error && <p className="govuk-error-message" style={{ marginTop: 4 }}>{error}</p>}
      </td>
      <td className="govuk-table__cell">
        <Tag colour={u.is_active ? "green" : "grey"}>{u.is_active ? "Active" : "Inactive"}</Tag>
      </td>
      <td className="govuk-table__cell" style={{ whiteSpace: "nowrap" }}>
        {!isSelf && (
          <>
            <button
              className="govuk-link govuk-body-s govuk-link--no-visited-state"
              style={{ color: u.is_active ? "var(--govuk-error-colour)" : "#1d70b8", marginRight: 16 }}
              onClick={handleToggleActive}
              disabled={isPending}
            >
              {u.is_active ? "Deactivate" : "Reactivate"}
            </button>
            <button
              className="govuk-link govuk-body-s govuk-link--no-visited-state"
              onClick={handleRemove}
              disabled={isPending}
            >
              Remove
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function SearchResult({ result, onAdd, disabled }: {
  result: UserSearchResult;
  onAdd: (result: UserSearchResult) => void;
  disabled: boolean;
}) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "8px 12px",
      borderBottom: "1px solid var(--govuk-border-colour)",
    }}>
      <div>
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          {result.full_name || result.email}
        </span>
        {result.full_name && (
          <span className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginLeft: 8 }}>
            {result.email}
          </span>
        )}
      </div>
      <button
        className="govuk-link govuk-body-s govuk-link--no-visited-state"
        onClick={() => onAdd(result)}
        disabled={disabled}
        style={{ flexShrink: 0, marginLeft: 16 }}
      >
        Add to team
      </button>
    </div>
  );
}

export default function UsersManager({ initial, currentUserId }: Props) {
  const [foiTeam, setFoiTeam] = useState(initial);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [promoting, startPromotion] = useTransition();
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const foiTeamIds = new Set(foiTeam.map(u => u.id));

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPromoteError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setSearchError(null); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchUsers(value);
        setSearchError(null);
        setResults(data.filter(r => r.role === "assignee" && !foiTeamIds.has(r.id)));
      } catch {
        setSearchError("Search failed.");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [foiTeamIds]);

  function handleAdd(result: UserSearchResult) {
    startPromotion(async () => {
      try {
        const updated = await updateUser(result.id, { role: "foi_team" });
        setFoiTeam(prev => [...prev, updated].sort((a, b) =>
          (a.first_name || a.email).localeCompare(b.first_name || b.email)
        ));
        setResults(prev => prev.filter(r => r.id !== result.id));
        setPromoteError(null);
      } catch {
        setPromoteError("Failed to add user to FOI team.");
      }
    });
  }

  return (
    <div className="foi-card" style={{ marginBottom: 24 }}>
      <h2 className="govuk-heading-m" style={{ marginBottom: 4 }}>FOI Team</h2>
      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 16 }}>
        Members of the FOI team have full access to manage cases and settings. All other users are assignees.
        Users must log in at least once before they can be added here.
      </p>

      <table className="govuk-table" style={{ marginBottom: 24 }}>
        <thead className="govuk-table__head">
          <tr className="govuk-table__row">
            <th className="govuk-table__header">User</th>
            <th className="govuk-table__header">Status</th>
            <th className="govuk-table__header" style={{ width: 180 }}>Actions</th>
          </tr>
        </thead>
        <tbody className="govuk-table__body">
          {foiTeam.map(u => (
            <FOITeamRow
              key={u.id}
              u={u}
              currentUserId={currentUserId}
              onUpdate={updated => setFoiTeam(prev => prev.map(x => x.id === updated.id ? updated : x))}
              onRemove={id => setFoiTeam(prev => prev.filter(x => x.id !== id))}
            />
          ))}
          {foiTeam.length === 0 && (
            <tr className="govuk-table__row">
              <td className="govuk-table__cell" colSpan={3} style={{ textAlign: "center", color: "var(--govuk-secondary-text-colour)" }}>
                No FOI team members.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3 className="govuk-heading-s" style={{ marginBottom: 8 }}>Add to FOI team</h3>
      <div style={{ maxWidth: 400 }}>
        <input
          className="govuk-input govuk-input--width-20"
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          aria-label="Search users to add to FOI team"
        />
      </div>

      {searchError && <p className="govuk-error-message" style={{ marginTop: 4 }}>{searchError}</p>}
      {promoteError && <p className="govuk-error-message" style={{ marginTop: 4 }}>{promoteError}</p>}

      {search.trim() && !isSearching && (
        <div style={{
          maxWidth: 500,
          marginTop: 4,
          border: "1px solid var(--govuk-border-colour)",
          borderRadius: 2,
        }}>
          {results.length > 0 ? results.map(r => (
            <SearchResult key={r.id} result={r} onAdd={handleAdd} disabled={promoting} />
          )) : (
            <p className="govuk-body-s" style={{ margin: 0, padding: "8px 12px", color: "var(--govuk-secondary-text-colour)" }}>
              No assignees found matching &ldquo;{search}&rdquo;.
            </p>
          )}
        </div>
      )}

      {isSearching && (
        <p className="govuk-body-s" style={{ marginTop: 8, color: "var(--govuk-secondary-text-colour)" }}>
          Searching…
        </p>
      )}
    </div>
  );
}

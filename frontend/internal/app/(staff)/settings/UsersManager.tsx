"use client";

import { useState, useTransition } from "react";
import { Tag } from "@/components/ui/Tag";
import { updateUserAction } from "./actions";
import type { ApiUser } from "@/lib/types";

interface Props {
  initial: ApiUser[];
  currentUserId: number;
}

function UserRow({ u, currentUserId, onUpdate }: {
  u: ApiUser;
  currentUserId: number;
  onUpdate: (updated: ApiUser) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isSelf = u.id === currentUserId;

  function handleRoleChange(role: "foi_team" | "assignee") {
    startTransition(async () => {
      const result = await updateUserAction(u.id, { role });
      if (result.error) setError(result.error);
      else if (result.data) { onUpdate(result.data); setError(null); }
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const result = await updateUserAction(u.id, { is_active: !u.is_active });
      if (result.error) setError(result.error);
      else if (result.data) { onUpdate(result.data); setError(null); }
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
        <Tag colour={u.role === "foi_team" ? "blue" : "grey"}>
          {u.role === "foi_team" ? "FOI team" : "Assignee"}
        </Tag>
      </td>
      <td className="govuk-table__cell">
        <Tag colour={u.is_active ? "green" : "grey"}>{u.is_active ? "Active" : "Inactive"}</Tag>
      </td>
      <td className="govuk-table__cell" style={{ whiteSpace: "nowrap" }}>
        {!isSelf && (
          <>
            <select
              className="govuk-select"
              value={u.role}
              onChange={e => handleRoleChange(e.target.value as "foi_team" | "assignee")}
              disabled={isPending}
              style={{ marginRight: 8, width: "auto", fontSize: 13 }}
              aria-label={`Role for ${u.email}`}
            >
              <option value="foi_team">FOI team</option>
              <option value="assignee">Assignee</option>
            </select>
            <button
              className="govuk-link govuk-body-s govuk-link--no-visited-state"
              style={{ color: u.is_active ? "var(--govuk-error-colour)" : "#1d70b8" }}
              onClick={handleToggleActive}
              disabled={isPending}
            >
              {u.is_active ? "Deactivate" : "Reactivate"}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

export default function UsersManager({ initial, currentUserId }: Props) {
  const [users, setUsers] = useState(initial);

  return (
    <div className="foi-card" style={{ marginBottom: 24 }}>
      <h2 className="govuk-heading-m" style={{ marginBottom: 4 }}>Users</h2>
      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 16 }}>
        Manage roles and access. To add new users, create an account via the Django admin or Microsoft SSO.
      </p>

      <table className="govuk-table" style={{ marginBottom: 0 }}>
        <thead className="govuk-table__head">
          <tr className="govuk-table__row">
            <th className="govuk-table__header">User</th>
            <th className="govuk-table__header">Role</th>
            <th className="govuk-table__header">Status</th>
            <th className="govuk-table__header" style={{ width: 200 }}>Actions</th>
          </tr>
        </thead>
        <tbody className="govuk-table__body">
          {users.map(u => (
            <UserRow
              key={u.id}
              u={u}
              currentUserId={currentUserId}
              onUpdate={updated => setUsers(prev => prev.map(x => x.id === updated.id ? updated : x))}
            />
          ))}
          {users.length === 0 && (
            <tr className="govuk-table__row">
              <td className="govuk-table__cell" colSpan={4} style={{ textAlign: "center", color: "var(--govuk-secondary-text-colour)" }}>
                No users found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { createRequesterCategory, updateRequesterCategory, deleteRequesterCategory } from "./actions";

interface Category {
  id: number;
  name: string;
  order: number;
}

export default function RequesterCategoriesManager({ initial }: { initial: Category[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditName(c.name);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setError(null);
  }

  function handleSaveEdit(id: number) {
    if (!editName.trim()) return;
    startTransition(async () => {
      const res = await updateRequesterCategory(id, editName);
      if (res.error) { setError(res.error); return; }
      setEditingId(null);
    });
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const res = await deleteRequesterCategory(id);
      if (res.error) setError(res.error);
    });
  }

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createRequesterCategory(newName);
      if (res.error) { setError(res.error); return; }
      setNewName("");
    });
  }

  return (
    <div className="foi-card">
      <h2 className="govuk-heading-s">Requester categories</h2>
      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
        These appear in the new case form. Changes take effect immediately.
      </p>

      {error && (
        <p className="govuk-error-message" style={{ marginBottom: 12 }}>
          <span className="govuk-visually-hidden">Error:</span> {error}
        </p>
      )}

      <table className="govuk-table" style={{ marginBottom: 16 }}>
        <tbody className="govuk-table__body">
          {initial.map(c => (
            <tr key={c.id} className="govuk-table__row">
              <td className="govuk-table__cell" style={{ verticalAlign: "middle" }}>
                {editingId === c.id ? (
                  <input
                    className="govuk-input govuk-input--width-20"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSaveEdit(c.id); if (e.key === "Escape") cancelEdit(); }}
                    autoFocus
                  />
                ) : (
                  <span className="govuk-body-s">{c.name}</span>
                )}
              </td>
              <td className="govuk-table__cell" style={{ textAlign: "right", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                {editingId === c.id ? (
                  <div className="foi-row" style={{ justifyContent: "flex-end" }}>
                    <Button size="small" onClick={() => handleSaveEdit(c.id)} disabled={isPending}>Save</Button>
                    <Button size="small" variant="secondary" onClick={cancelEdit}>Cancel</Button>
                  </div>
                ) : (
                  <div className="foi-row" style={{ justifyContent: "flex-end" }}>
                    <Button size="small" variant="secondary" onClick={() => startEdit(c)} disabled={isPending}>Edit</Button>
                    <Button size="small" variant="warning" onClick={() => handleDelete(c.id, c.name)} disabled={isPending}>Delete</Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
          {initial.length === 0 && (
            <tr className="govuk-table__row">
              <td className="govuk-table__cell" colSpan={2} style={{ color: "var(--govuk-secondary-text-colour)", textAlign: "center", padding: 16 }}>
                No categories yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ borderTop: "1px solid var(--govuk-border-colour)", paddingTop: 16 }}>
        <label className="govuk-label govuk-label--s" htmlFor="new-category">Add category</label>
        <div className="foi-row" style={{ marginTop: 6 }}>
          <input
            id="new-category"
            className="govuk-input govuk-input--width-20"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
            placeholder="e.g. Academic"
            disabled={isPending}
          />
          <Button size="small" onClick={handleAdd} disabled={isPending || !newName.trim()}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

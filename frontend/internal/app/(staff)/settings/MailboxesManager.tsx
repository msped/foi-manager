"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import { createMailbox, deleteMailbox, updateMailbox } from "@/lib/services/cases";
import type { Mailbox } from "@/lib/types";

interface Props {
  initial: Mailbox[];
}

function MailboxRow({ m, onDelete, onUpdate }: {
  m: Mailbox;
  onDelete: (id: number) => void;
  onUpdate: (id: number, name: string, email: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(m.name);
  const [email, setEmail] = useState(m.email);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateMailbox(m.id, { name: name.trim(), email: email.trim() });
        onUpdate(m.id, name, email);
        setEditing(false);
        setError(null);
      } catch {
        setError("Failed to update mailbox.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete mailbox "${m.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteMailbox(m.id);
        onDelete(m.id);
      } catch {
        setError("Failed to delete mailbox.");
      }
    });
  }

  if (editing) {
    return (
      <tr className="govuk-table__row">
        <td className="govuk-table__cell" colSpan={3}>
          <form onSubmit={handleSave}>
            {error && <p className="govuk-error-message">{error}</p>}
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <FormField label="Name" htmlFor={`mb-name-${m.id}`}>
                <input
                  id={`mb-name-${m.id}`}
                  className="govuk-input govuk-input--width-20"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Email" htmlFor={`mb-email-${m.id}`}>
                <input
                  id={`mb-email-${m.id}`}
                  type="email"
                  className="govuk-input govuk-input--width-20"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </FormField>
              <div style={{ display: "flex", gap: 6, paddingBottom: 2 }}>
                <Button type="submit" size="small" disabled={isPending}>Save</Button>
                <Button type="button" variant="secondary" size="small" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="govuk-table__row">
      <td className="govuk-table__cell govuk-body-s">{m.name}</td>
      <td className="govuk-table__cell govuk-body-s foi-mono">{m.email}</td>
      <td className="govuk-table__cell" style={{ whiteSpace: "nowrap" }}>
        <button className="govuk-link govuk-body-s" style={{ marginRight: 12 }} onClick={() => setEditing(true)}>
          Edit
        </button>
        <button className="govuk-link govuk-body-s govuk-link--no-visited-state" style={{ color: "var(--govuk-error-colour)" }} onClick={handleDelete} disabled={isPending}>
          Delete
        </button>
      </td>
    </tr>
  );
}

export default function MailboxesManager({ initial }: Props) {
  const [mailboxes, setMailboxes] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const mailbox = await createMailbox({ name: name.trim(), email: email.trim() });
        setMailboxes(prev => [...prev, mailbox]);
        setName("");
        setEmail("");
        setShowAdd(false);
        setError(null);
      } catch {
        setError("Failed to create mailbox.");
      }
    });
  }

  return (
    <div className="foi-card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 className="govuk-heading-m" style={{ marginBottom: 0 }}>Mailboxes</h2>
        {!showAdd && (
          <Button variant="secondary" size="small" onClick={() => setShowAdd(true)}>
            Add mailbox
          </Button>
        )}
      </div>

      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
        Departmental email addresses used as consultation recipients.
      </p>

      {mailboxes.length > 0 && (
        <table className="govuk-table" style={{ marginBottom: 12 }}>
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <th className="govuk-table__header">Name</th>
              <th className="govuk-table__header">Email</th>
              <th className="govuk-table__header" style={{ width: 100 }}></th>
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {mailboxes.map(m => (
              <MailboxRow
                key={m.id}
                m={m}
                onDelete={id => setMailboxes(prev => prev.filter(x => x.id !== id))}
                onUpdate={(id, n, em) => setMailboxes(prev => prev.map(x => x.id === id ? { ...x, name: n, email: em } : x))}
              />
            ))}
          </tbody>
        </table>
      )}

      {mailboxes.length === 0 && !showAdd && (
        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>No mailboxes configured yet.</p>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} style={{ borderTop: mailboxes.length > 0 ? "1px solid var(--govuk-border-colour)" : undefined, paddingTop: mailboxes.length > 0 ? 12 : 0 }}>
          {error && <p className="govuk-error-message">{error}</p>}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <FormField label="Name" htmlFor="new-mb-name">
              <input
                id="new-mb-name"
                className="govuk-input govuk-input--width-20"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Planning"
                required
              />
            </FormField>
            <FormField label="Email" htmlFor="new-mb-email">
              <input
                id="new-mb-email"
                type="email"
                className="govuk-input govuk-input--width-20"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="planning@example.gov.uk"
                required
              />
            </FormField>
            <div style={{ display: "flex", gap: 6, paddingBottom: 2 }}>
              <Button type="submit" size="small" disabled={isPending}>Add</Button>
              <Button type="button" variant="secondary" size="small" onClick={() => { setShowAdd(false); setError(null); }}>Cancel</Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

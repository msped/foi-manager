"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { createEmailTemplateAction, deleteEmailTemplateAction, updateEmailTemplateAction } from "./actions";
import type { EmailTemplate } from "@/lib/types";

const VARIABLES = [
  "{{ref}}", "{{requester_name}}", "{{requester_email}}", "{{submitted_at}}",
  "{{statutory_deadline}}", "{{request_summary}}", "{{foi_contact_email}}",
];

interface Props {
  initial: EmailTemplate[];
}

function TemplateRow({ t, onDelete, onUpdate }: {
  t: EmailTemplate;
  onDelete: (id: number) => void;
  onUpdate: (updated: EmailTemplate) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(t.name);
  const [description, setDescription] = useState(t.description);
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(t.body);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateEmailTemplateAction(t.id, { name, description, subject, body });
      if (result.error) {
        setError(result.error);
      } else {
        onUpdate({ ...t, name, description, subject, body });
        setEditing(false);
        setError(null);
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteEmailTemplateAction(t.id);
      if (result.error) setError(result.error);
      else onDelete(t.id);
    });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--govuk-border-colour)", paddingBottom: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Tag colour={t.type === "consultation" ? "blue" : "purple"}>
          {t.type === "consultation" ? "Consultation" : "Requester"}
        </Tag>
        <span className="govuk-body-s" style={{ fontWeight: 600, flex: 1 }}>{t.name}</span>
        <button className="govuk-link govuk-body-s" onClick={() => setExpanded(v => !v)}>
          {expanded ? "Hide" : "View"}
        </button>
        <button className="govuk-link govuk-body-s" onClick={() => { setExpanded(true); setEditing(true); }}>
          Edit
        </button>
        <button className="govuk-link govuk-body-s govuk-link--no-visited-state" style={{ color: "var(--govuk-error-colour)" }} onClick={handleDelete} disabled={isPending}>
          Delete
        </button>
      </div>

      {t.description && (
        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginTop: 4, marginBottom: 0 }}>{t.description}</p>
      )}

      {expanded && !editing && (
        <div style={{ marginTop: 10, padding: 12, background: "var(--govuk-template-background-colour)", borderLeft: "3px solid var(--govuk-border-colour)" }}>
          {t.type === "consultation" && t.subject && (
            <div style={{ marginBottom: 8 }}>
              <span className="govuk-body-s" style={{ fontWeight: 600 }}>Subject: </span>
              <span className="govuk-body-s foi-mono">{t.subject}</span>
            </div>
          )}
          <div className="foi-rich-content" style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: t.body }} />
        </div>
      )}

      {expanded && editing && (
        <form onSubmit={handleSave} style={{ marginTop: 10 }}>
          {error && <p className="govuk-error-message">{error}</p>}
          <FormField label="Name" htmlFor={`tpl-name-${t.id}`}>
            <input id={`tpl-name-${t.id}`} className="govuk-input" value={name} onChange={e => setName(e.target.value)} required />
          </FormField>
          <FormField label="Description" hint="Optional." htmlFor={`tpl-desc-${t.id}`}>
            <input id={`tpl-desc-${t.id}`} className="govuk-input" value={description} onChange={e => setDescription(e.target.value)} />
          </FormField>
          <FormField label="Subject" htmlFor={`tpl-subject-${t.id}`}>
            <input id={`tpl-subject-${t.id}`} className="govuk-input" value={subject} onChange={e => setSubject(e.target.value)} />
          </FormField>
          <FormField label="Body" htmlFor={`tpl-body-${t.id}`}>
            <RichTextEditor value={body} onChange={setBody} variables={VARIABLES} minHeight={180} />
          </FormField>
          <div style={{ display: "flex", gap: 6 }}>
            <Button type="submit" size="small" disabled={isPending}>Save</Button>
            <Button type="button" variant="secondary" size="small" onClick={() => { setEditing(false); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function EmailTemplatesManager({ initial }: Props) {
  const [templates, setTemplates] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<"consultation" | "requester">("requester");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createEmailTemplateAction({ name, type, description, subject, body });
      if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setTemplates(prev => [...prev, result.data!]);
        setName(""); setDescription(""); setSubject(""); setBody("");
        setShowAdd(false); setError(null);
      }
    });
  }

  const consultationTemplates = templates.filter(t => t.type === "consultation");
  const requesterTemplates = templates.filter(t => t.type === "requester");

  return (
    <div className="foi-card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 className="govuk-heading-m" style={{ marginBottom: 0 }}>Templates</h2>
        {!showAdd && (
          <Button variant="secondary" size="small" onClick={() => setShowAdd(true)}>
            Add template
          </Button>
        )}
      </div>

      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
        <strong>Requester templates</strong> are sent to the person who made the FOI request — acknowledgements, clarification requests, and final responses.
        {" "}<strong>Consultation templates</strong> are used internally when messaging assignees or departments.
        {" "}Use <code className="foi-mono">{`{{variable}}`}</code> for substitutions.
      </p>

      {requesterTemplates.length > 0 && (
        <>
          <h3 className="govuk-heading-s" style={{ marginBottom: 8 }}>Requester templates</h3>
          {requesterTemplates.map(t => (
            <TemplateRow
              key={t.id}
              t={t}
              onDelete={id => setTemplates(prev => prev.filter(x => x.id !== id))}
              onUpdate={updated => setTemplates(prev => prev.map(x => x.id === updated.id ? updated : x))}
            />
          ))}
        </>
      )}

      {consultationTemplates.length > 0 && (
        <>
          <h3 className="govuk-heading-s" style={{ marginBottom: 8, marginTop: requesterTemplates.length > 0 ? 16 : 0 }}>Consultation templates</h3>
          {consultationTemplates.map(t => (
            <TemplateRow
              key={t.id}
              t={t}
              onDelete={id => setTemplates(prev => prev.filter(x => x.id !== id))}
              onUpdate={updated => setTemplates(prev => prev.map(x => x.id === updated.id ? updated : x))}
            />
          ))}
        </>
      )}

      {templates.length === 0 && !showAdd && (
        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>No templates configured yet.</p>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} style={{ borderTop: templates.length > 0 ? "1px solid var(--govuk-border-colour)" : undefined, paddingTop: templates.length > 0 ? 12 : 0 }}>
          <p className="govuk-heading-s" style={{ marginBottom: 12 }}>New template</p>
          {error && <p className="govuk-error-message">{error}</p>}

          <FormField label="Type" htmlFor="new-tpl-type">
            <select id="new-tpl-type" className="govuk-select" value={type} onChange={e => setType(e.target.value as "consultation" | "requester")}>
              <option value="requester">Requester template</option>
              <option value="consultation">Consultation template</option>
            </select>
          </FormField>
          <FormField label="Name" htmlFor="new-tpl-name">
            <input id="new-tpl-name" className="govuk-input" value={name} onChange={e => setName(e.target.value)} required />
          </FormField>
          <FormField label="Description" hint="Optional." htmlFor="new-tpl-desc">
            <input id="new-tpl-desc" className="govuk-input" value={description} onChange={e => setDescription(e.target.value)} />
          </FormField>
          <FormField label="Subject" htmlFor="new-tpl-subject">
            <input id="new-tpl-subject" className="govuk-input" value={subject} onChange={e => setSubject(e.target.value)} />
          </FormField>
          <FormField label="Body" htmlFor="new-tpl-body">
            <RichTextEditor value={body} onChange={setBody} variables={VARIABLES} placeholder="Template body…" minHeight={180} />
          </FormField>
          <div style={{ display: "flex", gap: 6 }}>
            <Button type="submit" size="small" disabled={isPending}>Save template</Button>
            <Button type="button" variant="secondary" size="small" onClick={() => { setShowAdd(false); setError(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

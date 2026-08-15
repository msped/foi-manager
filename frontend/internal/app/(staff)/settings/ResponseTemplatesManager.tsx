"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import RichTextEditor from "@/components/ui/RichTextEditor";
import {
  createResponseTemplate,
  updateResponseTemplate,
  deleteResponseTemplate,
} from "@/lib/services/cases";
import { EXEMPTION_CODES, RESPONSE_BLOCK_VARIABLES, type ResponseTemplate } from "@/lib/types";

function ExemptionSelect({ id, value, onChange }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select id={id} className="govuk-select" value={value} onChange={e => onChange(e.target.value)}>
      <option value="">None — general explainer</option>
      {EXEMPTION_CODES.map(e => (
        <option key={e.code} value={e.code}>{e.label}</option>
      ))}
    </select>
  );
}

function exemptionLabel(code: string): string | null {
  return EXEMPTION_CODES.find(e => e.code === code)?.label ?? null;
}

interface RowProps {
  template: ResponseTemplate;
  onUpdated: (t: ResponseTemplate) => void;
  onDeleted: (id: number) => void;
}

function TemplateRow({ template, onUpdated, onDeleted }: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(template.name);
  const [exemptionCode, setExemptionCode] = useState(template.exemption_code);
  const [body, setBody] = useState(template.body);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    setName(template.name);
    setExemptionCode(template.exemption_code);
    setBody(template.body);
    setEditing(true);
    setExpanded(true);
    setError(null);
  }

  function handleSave(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const updated = await updateResponseTemplate(template.id, {
          name,
          exemption_code: exemptionCode,
          body,
        });
        onUpdated(updated);
        setEditing(false);
        setExpanded(false);
      } catch {
        setError("Failed to save.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Remove the "${template.name}" response template?`)) return;
    startTransition(async () => {
      try {
        await deleteResponseTemplate(template.id);
        onDeleted(template.id);
      } catch {
        setError("Failed to remove template.");
      }
    });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--govuk-border-colour)", paddingBottom: 14, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="govuk-body-s" style={{ fontWeight: 600, flex: 1 }}>
          {template.name}
          {template.exemption_code && (
            <span
              className="foi-mono"
              style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: "var(--govuk-secondary-text-colour)" }}
              title={exemptionLabel(template.exemption_code) ?? undefined}
            >
              {template.exemption_code}
            </span>
          )}
        </span>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button className="govuk-link govuk-body-s" onClick={() => { setExpanded(v => !v); setEditing(false); }}>
            {expanded && !editing ? "Hide" : "Preview"}
          </button>
          <button className="govuk-link govuk-body-s" onClick={openEdit}>Edit</button>
        </div>
      </div>

      {expanded && !editing && (
        <div style={{ marginTop: 8, padding: 10, background: "var(--govuk-template-background-colour)", borderLeft: "3px solid var(--govuk-border-colour)" }}>
          <div className="foi-rich-content" style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: template.body }} />
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} style={{ marginTop: 10 }}>
          {error && <p className="govuk-error-message">{error}</p>}
          <FormField label="Name" htmlFor={`rt-name-${template.id}`}>
            <input
              id={`rt-name-${template.id}`}
              className="govuk-input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </FormField>
          <FormField
            label="Exemption"
            htmlFor={`rt-code-${template.id}`}
            hint="Blocks linked to an exemption are suggested on cases claiming it."
          >
            <ExemptionSelect id={`rt-code-${template.id}`} value={exemptionCode} onChange={setExemptionCode} />
          </FormField>
          <FormField
            label="Body"
            htmlFor={`rt-body-${template.id}`}
            hint={`Available variables: ${RESPONSE_BLOCK_VARIABLES.join(", ")}`}
          >
            <RichTextEditor
              value={body}
              onChange={setBody}
              variables={RESPONSE_BLOCK_VARIABLES}
              minHeight={150}
            />
          </FormField>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Button type="submit" size="small" disabled={isPending}>Save</Button>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => { setEditing(false); setExpanded(false); setError(null); }}
            >
              Cancel
            </Button>
            <button
              type="button"
              className="govuk-link govuk-body-s"
              style={{ color: "var(--govuk-error-colour)", marginLeft: "auto" }}
              onClick={handleDelete}
              disabled={isPending}
            >
              Remove
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

interface Props {
  initial: ResponseTemplate[];
}

export default function ResponseTemplatesManager({ initial }: Props) {
  const [templates, setTemplates] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newExemptionCode, setNewExemptionCode] = useState("");
  const [newBody, setNewBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const created = await createResponseTemplate({
          name: newName.trim(),
          exemption_code: newExemptionCode,
          body: newBody,
        });
        setTemplates(prev => [...prev, created]);
        setShowForm(false);
        setNewName("");
        setNewExemptionCode("");
        setNewBody("");
        setError(null);
      } catch {
        setError("Failed to create template.");
      }
    });
  }

  function handleUpdated(updated: ResponseTemplate) {
    setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t));
  }

  function handleDeleted(id: number) {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  return (
    <div className="foi-card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 className="govuk-heading-m" style={{ marginBottom: 0 }}>Response templates</h2>
        {!showForm && (
          <Button variant="secondary" size="small" onClick={() => setShowForm(true)}>
            Add template
          </Button>
        )}
      </div>
      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
        Pre-written text blocks that can be inserted into a case response draft. Create templates for common outcomes, exemption justifications, or any other boilerplate you reuse.
      </p>

      {templates.length === 0 && !showForm && (
        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
          No response templates configured.
        </p>
      )}

      {templates.map(t => (
        <TemplateRow key={t.id} template={t} onUpdated={handleUpdated} onDeleted={handleDeleted} />
      ))}

      {showForm && (
        <form onSubmit={handleCreate} style={{ borderTop: templates.length > 0 ? "1px solid var(--govuk-border-colour)" : undefined, paddingTop: templates.length > 0 ? 16 : 0 }}>
          {error && <p className="govuk-error-message">{error}</p>}
          <FormField label="Name" htmlFor="rt-new-name">
            <input
              id="rt-new-name"
              className="govuk-input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Full Disclosure — Standard"
              required
            />
          </FormField>
          <FormField
            label="Exemption"
            htmlFor="rt-new-code"
            hint="Blocks linked to an exemption are suggested on cases claiming it."
          >
            <ExemptionSelect id="rt-new-code" value={newExemptionCode} onChange={setNewExemptionCode} />
          </FormField>
          <FormField
            label="Body"
            htmlFor="rt-new-body"
            hint={`Available variables: ${RESPONSE_BLOCK_VARIABLES.join(", ")}`}
          >
            <RichTextEditor
              value={newBody}
              onChange={setNewBody}
              variables={RESPONSE_BLOCK_VARIABLES}
              minHeight={150}
            />
          </FormField>
          <div style={{ display: "flex", gap: 6 }}>
            <Button type="submit" size="small" disabled={isPending}>Save template</Button>
            <Button
              type="button"
              variant="secondary"
              size="small"
              onClick={() => { setShowForm(false); setNewName(""); setNewBody(""); setError(null); }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import FormField from "@/components/ui/FormField";
import RichTextEditor from "@/components/ui/RichTextEditor";
import { createEmailTemplate, deleteEmailTemplate, updateEmailTemplate } from "@/lib/services/cases";
import type { EmailTemplate, EmailTemplatePurposeInfo } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  requester: "Requester",
  consultation: "Consultation",
  assignee: "Assignee",
};

const TYPE_COLOURS: Record<string, "purple" | "blue" | "green"> = {
  requester: "purple",
  consultation: "blue",
  assignee: "green",
};

interface SlotProps {
  info: EmailTemplatePurposeInfo;
  onConfigured: (template: EmailTemplate) => void;
  onUpdated: (template: EmailTemplate) => void;
  onDeleted: (purpose: string) => void;
}

function TemplateSlot({ info, onConfigured, onUpdated, onDeleted }: SlotProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(info.template?.name ?? info.label);
  const [description, setDescription] = useState(info.template?.description ?? "");
  const [subject, setSubject] = useState(info.template?.subject ?? "");
  const [body, setBody] = useState(info.template?.body ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const variables = info.variables.map(v => `{{${v}}}`);
  const configured = !!info.template;

  function openConfigure() {
    setName(info.template?.name ?? info.label);
    setDescription(info.template?.description ?? "");
    setSubject(info.template?.subject ?? "");
    setBody(info.template?.body ?? "");
    setExpanded(true);
    setEditing(true);
    setError(null);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (info.template) {
          const updated = await updateEmailTemplate(info.template.id, { name, description, subject, body });
          onUpdated(updated);
        } else {
          const created = await createEmailTemplate({ purpose: info.purpose, name, description, subject, body });
          onConfigured(created);
        }
        setEditing(false);
        setExpanded(false);
        setError(null);
      } catch {
        setError("Failed to save template.");
      }
    });
  }

  function handleDelete() {
    if (!info.template) return;
    if (!confirm(`Remove the "${info.label}" template? Send events using this template will fail until it is reconfigured.`)) return;
    startTransition(async () => {
      try {
        await deleteEmailTemplate(info.template!.id);
        onDeleted(info.purpose);
        setExpanded(false);
        setEditing(false);
      } catch {
        setError("Failed to remove template.");
      }
    });
  }

  return (
    <div style={{ borderBottom: "1px solid var(--govuk-border-colour)", paddingBottom: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 2 }}>
            <span className="govuk-body-s" style={{ fontWeight: 600 }}>{info.label}</span>
            {configured ? (
              <Tag colour="green">Configured</Tag>
            ) : (
              <Tag colour="red">Not configured</Tag>
            )}
          </div>
          <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
            {info.description}
          </p>
          {configured && info.template?.name && info.template.name !== info.label && (
            <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginTop: 2, marginBottom: 0 }}>
              Template name: <em>{info.template.name}</em>
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {configured ? (
            <>
              <button className="govuk-link govuk-body-s" onClick={() => { setExpanded(v => !v); setEditing(false); }}>
                {expanded && !editing ? "Hide" : "Preview"}
              </button>
              <button className="govuk-link govuk-body-s" onClick={openConfigure}>Edit</button>
            </>
          ) : (
            <button className="govuk-link govuk-body-s" onClick={openConfigure}>Configure</button>
          )}
        </div>
      </div>

      {expanded && !editing && info.template && (
        <div style={{ marginTop: 10, padding: 12, background: "var(--govuk-template-background-colour)", borderLeft: "3px solid var(--govuk-border-colour)" }}>
          {info.template.subject && (
            <div style={{ marginBottom: 8 }}>
              <span className="govuk-body-s" style={{ fontWeight: 600 }}>Subject: </span>
              <span className="govuk-body-s foi-mono">{info.template.subject}</span>
            </div>
          )}
          <div className="foi-rich-content" style={{ fontSize: 13 }} dangerouslySetInnerHTML={{ __html: info.template.body }} />
        </div>
      )}

      {editing && (
        <form onSubmit={handleSave} style={{ marginTop: 12 }}>
          {error && <p className="govuk-error-message">{error}</p>}
          <FormField label="Template name" htmlFor={`tpl-name-${info.purpose}`}>
            <input id={`tpl-name-${info.purpose}`} className="govuk-input" value={name} onChange={e => setName(e.target.value)} required />
          </FormField>
          <FormField label="Description" hint="Optional internal note." htmlFor={`tpl-desc-${info.purpose}`}>
            <input id={`tpl-desc-${info.purpose}`} className="govuk-input" value={description} onChange={e => setDescription(e.target.value)} />
          </FormField>
          <FormField label="Subject" htmlFor={`tpl-subject-${info.purpose}`}>
            <input id={`tpl-subject-${info.purpose}`} className="govuk-input" value={subject} onChange={e => setSubject(e.target.value)} />
          </FormField>
          <FormField
            label="Body"
            hint={`Available variables: ${variables.join(", ")}`}
            htmlFor={`tpl-body-${info.purpose}`}
          >
            <RichTextEditor value={body} onChange={setBody} variables={variables} minHeight={180} />
          </FormField>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Button type="submit" size="small" disabled={isPending}>Save</Button>
            <Button type="button" variant="secondary" size="small" onClick={() => { setEditing(false); setExpanded(false); setError(null); }}>
              Cancel
            </Button>
            {configured && (
              <button
                type="button"
                className="govuk-link govuk-body-s"
                style={{ color: "var(--govuk-error-colour)", marginLeft: "auto" }}
                onClick={handleDelete}
                disabled={isPending}
              >
                Remove template
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

interface Props {
  initial: EmailTemplatePurposeInfo[];
}

export default function EmailTemplatesManager({ initial }: Props) {
  const [purposes, setPurposes] = useState(initial);

  const missing = purposes.filter(p => !p.template);
  const byType = {
    requester: purposes.filter(p => p.type === "requester"),
    consultation: purposes.filter(p => p.type === "consultation"),
    assignee: purposes.filter(p => p.type === "assignee"),
  };

  function handleConfigured(purpose: string, template: EmailTemplate) {
    setPurposes(prev => prev.map(p => p.purpose === purpose ? { ...p, template } : p));
  }

  function handleUpdated(purpose: string, template: EmailTemplate) {
    setPurposes(prev => prev.map(p => p.purpose === purpose ? { ...p, template } : p));
  }

  function handleDeleted(purpose: string) {
    setPurposes(prev => prev.map(p => p.purpose === purpose ? { ...p, template: null } : p));
  }

  return (
    <div className="foi-card" style={{ marginBottom: 24 }}>
      <h2 className="govuk-heading-m" style={{ marginBottom: 8 }}>Email Templates</h2>

      {missing.length > 0 && (
        <div className="govuk-warning-text" style={{ marginBottom: 16 }}>
          <span className="govuk-warning-text__icon" aria-hidden="true">!</span>
          <strong className="govuk-warning-text__text">
            <span className="govuk-visually-hidden">Warning</span>
            {missing.length === 1
              ? `1 required email template is not configured — some send actions will be blocked until it is set up.`
              : `${missing.length} required email templates are not configured — some send actions will be blocked until they are set up.`}
          </strong>
        </div>
      )}

      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 16 }}>
        All templates are required. Use <code className="foi-mono">{`{{variable}}`}</code> placeholders for substitution.
      </p>

      {(["requester", "consultation", "assignee"] as const).map(type => {
        const slots = byType[type];
        if (!slots.length) return null;
        return (
          <div key={type} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h3 className="govuk-heading-s" style={{ marginBottom: 0 }}>{TYPE_LABELS[type]} templates</h3>
            </div>
            {slots.map(info => (
              <TemplateSlot
                key={info.purpose}
                info={info}
                onConfigured={t => handleConfigured(info.purpose, t)}
                onUpdated={t => handleUpdated(info.purpose, t)}
                onDeleted={p => handleDeleted(p)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

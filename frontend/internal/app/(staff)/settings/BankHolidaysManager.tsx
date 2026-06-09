"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import { createBankHoliday, deleteBankHoliday } from "@/lib/services/cases";
import type { BankHoliday, BankHolidayCountry } from "@/lib/types";

const COUNTRY_LABELS: Record<BankHolidayCountry, string> = {
  england: "England",
  wales: "Wales",
  scotland: "Scotland",
  northern_ireland: "Northern Ireland",
};

const COUNTRIES = Object.entries(COUNTRY_LABELS) as [BankHolidayCountry, string][];

function groupByYear(holidays: BankHoliday[]) {
  const map = new Map<number, BankHoliday[]>();
  for (const h of holidays) {
    const year = new Date(h.date).getFullYear();
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(h);
  }
  return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
}

export default function BankHolidaysManager({ initial }: { initial: BankHoliday[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ country: "england" as BankHolidayCountry, name: "", date: "" });

  function handleAdd(e: React.SubmitEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.date) return;
    startTransition(async () => {
      try {
        await createBankHoliday({ country: form.country, name: form.name.trim(), date: form.date });
        setError(null);
        setForm(f => ({ ...f, name: "", date: "" }));
        router.refresh();
      } catch {
        setError("Failed to add bank holiday.");
      }
    });
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteBankHoliday(id);
        router.refresh();
      } catch {
        setError("Failed to delete bank holiday.");
      }
    });
  }

  const grouped = groupByYear(initial);

  return (
    <div className="foi-card">
      <h2 className="govuk-heading-s">Bank holidays</h2>
      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
        Bank holidays are excluded when calculating statutory deadlines. Add them for each country as needed.
      </p>

      {error && (
        <p className="govuk-error-message" style={{ marginBottom: 12 }}>
          <span className="govuk-visually-hidden">Error:</span> {error}
        </p>
      )}

      {grouped.length === 0 ? (
        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 16 }}>
          No bank holidays added yet.
        </p>
      ) : grouped.map(([year, holidays]) => (
        <div key={year} style={{ marginBottom: 20 }}>
          <h3 className="govuk-heading-s" style={{ marginBottom: 8 }}>{year}</h3>
          <table className="govuk-table" style={{ marginBottom: 0 }}>
            <thead className="govuk-table__head">
              <tr className="govuk-table__row">
                <th className="govuk-table__header" style={{ width: 110 }}>Date</th>
                <th className="govuk-table__header">Name</th>
                <th className="govuk-table__header" style={{ width: 140 }}>Country</th>
                <th className="govuk-table__header" style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody className="govuk-table__body">
              {holidays.map(h => (
                <tr key={h.id} className="govuk-table__row">
                  <td className="govuk-table__cell govuk-body-s">{h.date}</td>
                  <td className="govuk-table__cell govuk-body-s">{h.name}</td>
                  <td className="govuk-table__cell govuk-body-s">{COUNTRY_LABELS[h.country]}</td>
                  <td className="govuk-table__cell" style={{ textAlign: "right" }}>
                    <Button
                      size="small"
                      variant="warning"
                      onClick={() => handleDelete(h.id, h.name)}
                      disabled={isPending}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={{ borderTop: "1px solid var(--govuk-border-colour)", paddingTop: 16 }}>
        <h3 className="govuk-heading-s">Add bank holiday</h3>
        <form onSubmit={handleAdd}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr", gap: 12, alignItems: "end" }}>
            <FormField label="Country" htmlFor="bh-country">
              <select
                id="bh-country"
                className="govuk-select"
                value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value as BankHolidayCountry }))}
              >
                {COUNTRIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Name" htmlFor="bh-name">
              <input
                id="bh-name"
                className="govuk-input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Christmas Day"
                disabled={isPending}
              />
            </FormField>

            <FormField label="Date" htmlFor="bh-date">
              <input
                id="bh-date"
                type="date"
                className="govuk-input"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                disabled={isPending}
              />
            </FormField>
          </div>

          <Button type="submit" size="small" disabled={isPending || !form.name.trim() || !form.date}>
            Add bank holiday
          </Button>
        </form>
      </div>
    </div>
  );
}

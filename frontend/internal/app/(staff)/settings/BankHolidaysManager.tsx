"use client";

import { useState, useTransition } from "react";
import Accordion from "@/components/govuk/Accordion";
import SummaryCard from "@/components/govuk/SummaryCard";
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

const ALL_COUNTRIES = "all";

export default function BankHolidaysManager({ initial }: { initial: BankHoliday[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Every nation's holidays count towards every deadline, so no country is the
  // one to start on. The accordion below is what keeps the page short.
  const [filter, setFilter] = useState<BankHolidayCountry | typeof ALL_COUNTRIES>(ALL_COUNTRIES);
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

  const visible = filter === ALL_COUNTRIES ? initial : initial.filter(h => h.country === filter);
  const grouped = groupByYear(visible);

  return (
    <SummaryCard title="Bank holidays">
      <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>
        Statutory deadlines skip every UK bank holiday, whichever nation observes it — the Act
        counts a bank holiday &ldquo;in any part of the United Kingdom&rdquo;, so a Scottish or
        Northern Irish date extends the clock here too.
      </p>

      <div style={{ marginBottom: 16, maxWidth: 320 }}>
        <FormField label="Show" htmlFor="bh-filter">
          <select
            id="bh-filter"
            className="govuk-select"
            value={filter}
            onChange={e => setFilter(e.target.value as BankHolidayCountry | typeof ALL_COUNTRIES)}
          >
            <option value={ALL_COUNTRIES}>All countries</option>
            {COUNTRIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {error && (
        <p className="govuk-error-message" style={{ marginBottom: 12 }}>
          <span className="govuk-visually-hidden">Error:</span> {error}
        </p>
      )}

      {grouped.length === 0 ? (
        <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 16 }}>
          {initial.length === 0
            ? "No bank holidays added yet. Deadlines are currently being calculated as though there are none, which sets them earlier than they should be."
            : `No bank holidays recorded for ${COUNTRY_LABELS[filter as BankHolidayCountry]}.`}
        </p>
      ) : (
        <Accordion
          id="bank-holidays"
          // Loading a full feed brings a decade of dates across four countries,
          // which is several hundred rows. Only the current year is open: it is
          // the one being worked to, and the years around it are reference.
          defaultExpanded={[String(new Date().getFullYear())]}
          sections={grouped.map(([year, holidays]) => ({
            key: String(year),
            heading: String(year),
            summary: `${holidays.length} ${holidays.length === 1 ? "date" : "dates"}`,
            content: (
              <table className="govuk-table" style={{ marginBottom: 0 }}>
                <thead className="govuk-table__head">
                  <tr className="govuk-table__row">
                    <th className="govuk-table__header" style={{ width: 110 }}>Date</th>
                    <th className="govuk-table__header">Name</th>
                    <th className="govuk-table__header" style={{ width: 140 }}>Country</th>
                    <th className="govuk-table__header" style={{ width: 80 }}>
                      <span className="govuk-visually-hidden">Actions</span>
                    </th>
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
                          Delete<span className="govuk-visually-hidden"> {h.name}, {h.date}</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ),
          }))}
        />
      )}

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
    </SummaryCard>
  );
}

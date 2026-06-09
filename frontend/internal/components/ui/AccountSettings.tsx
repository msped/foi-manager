"use client";

import { useState, useTransition } from "react";
import { updateNotificationPreferences } from "@/lib/services/users";
import type { NotificationPreferences } from "@/lib/types";

interface Props {
  preferences: NotificationPreferences;
}

export default function AccountSettings({ preferences }: Props) {
  const [notifyOnAssignment, setNotifyOnAssignment] = useState(
    preferences.notify_on_case_assignment,
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNotifyOnAssignment(e.target.checked);
    setSaved(false);
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      await updateNotificationPreferences({ notify_on_case_assignment: notifyOnAssignment });
      setSaved(true);
    });
  }

  return (
    <div className="foi-card">
      <h2 className="govuk-heading-m">Notification preferences</h2>
      <form onSubmit={handleSubmit}>
        <div className="govuk-form-group">
          <fieldset className="govuk-fieldset">
            <legend className="govuk-fieldset__legend govuk-fieldset__legend--s">
              Email notifications
            </legend>
            <div className="govuk-checkboxes govuk-checkboxes--small">
              <div className="govuk-checkboxes__item">
                <input
                  className="govuk-checkboxes__input"
                  id="notify-on-assignment"
                  type="checkbox"
                  checked={notifyOnAssignment}
                  onChange={handleChange}
                />
                <label
                  className="govuk-label govuk-checkboxes__label"
                  htmlFor="notify-on-assignment"
                >
                  Email me when I am assigned to a case
                </label>
              </div>
            </div>
          </fieldset>
        </div>
        <button type="submit" className="govuk-button" disabled={isPending}>
          {isPending ? "Saving…" : "Save preferences"}
        </button>
        {saved && !isPending && (
          <span style={{ marginLeft: 12, fontSize: 14, color: "#00703c" }}>
            Saved
          </span>
        )}
      </form>
    </div>
  );
}

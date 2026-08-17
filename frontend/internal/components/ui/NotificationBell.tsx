"use client";

import { useState, useEffect, useRef } from "react";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/services/users";
import { fmtDate } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listNotifications().then(r => setNotifications(r.results)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unread = notifications.filter(n => !n.read).length;

  async function handleMarkAll() {
    await markAllNotificationsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function handleMarkOne(id: number) {
    await markNotificationRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  return (
    <div ref={containerRef} className="foi-notifications">
      <button
        type="button"
        className="foi-notifications__toggle"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
        </svg>
        {unread > 0 && (
          <span className="foi-notifications__count">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div className="foi-notifications__panel">
          <div className="foi-notifications__header">
            <span className="govuk-body-s govuk-!-margin-bottom-0"><strong>Notifications</strong></span>
            {unread > 0 && (
              <button type="button" className="govuk-link" onClick={handleMarkAll}>
                Mark all read
              </button>
            )}
          </div>

          <ul className="foi-notifications__list">
            {notifications.length === 0 && (
              <li className="foi-notifications__item foi-notifications__item--empty govuk-body-s">
                No notifications
              </li>
            )}
            {notifications.slice(0, 20).map(n => (
              <li
                key={n.id}
                className={`foi-notifications__item${n.read ? "" : " foi-notifications__item--unread"}`}
              >
                <button
                  type="button"
                  className="foi-notifications__link"
                  onClick={() => {
                    if (!n.read) handleMarkOne(n.id);
                    if (n.link) window.location.href = n.link;
                  }}
                >
                  <span className="govuk-body-s govuk-!-margin-bottom-0">{n.message}</span>
                  <br />
                  <span className="govuk-hint govuk-!-margin-bottom-0">{fmtDate(n.created_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

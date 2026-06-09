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
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Notifications"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        style={{
          background: "none",
          border: "none",
          color: "#ffffff",
          cursor: "pointer",
          padding: 6,
          position: "relative",
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "#d4351c",
            color: "#fff",
            borderRadius: "50%",
            fontSize: 9,
            fontWeight: 700,
            width: 14,
            height: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: 0,
          width: 300,
          background: "#fff",
          border: "1px solid #cecece",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 100,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderBottom: "1px solid #cecece",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#0b0c0c" }}>Notifications</span>
            {unread > 0 && (
              <button
                onClick={handleMarkAll}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#1d70b8" }}
              >
                Mark all read
              </button>
            )}
          </div>

          <ul style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 320, overflowY: "auto" }}>
            {notifications.length === 0 && (
              <li style={{ padding: "16px 12px", fontSize: 13, color: "#505a5f", textAlign: "center" }}>
                No notifications
              </li>
            )}
            {notifications.slice(0, 20).map(n => (
              <li
                key={n.id}
                style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid #cecece",
                  background: n.read ? "#fff" : "#f0f6ff",
                  cursor: n.link ? "pointer" : "default",
                }}
                onClick={() => {
                  if (!n.read) handleMarkOne(n.id);
                  if (n.link) window.location.href = n.link;
                }}
              >
                <div style={{ fontSize: 13, color: "#0b0c0c", marginBottom: 2 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: "#505a5f" }}>{fmtDate(n.created_at)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

import djangoClient from "./django";
import type { ApiUser, Notification, NotificationPreferences, Paginated, UserSearchResult } from "@/lib/types";

export async function getMe(): Promise<ApiUser> {
  const { data } = await djangoClient.get<ApiUser>("/auth/user/");
  return data;
}

export async function listUsers(): Promise<ApiUser[]> {
  const { data } = await djangoClient.get<ApiUser[]>("/users/");
  return data;
}

export async function updateUser(
  id: number,
  body: Partial<{ role: "foi_team" | "assignee"; is_active: boolean; department: string }>,
): Promise<ApiUser> {
  const { data } = await djangoClient.patch<ApiUser>(`/users/${id}/`, body);
  return data;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const { data } = await djangoClient.get<UserSearchResult[]>(`/users/search/?search=${encodeURIComponent(query)}`);
  return data;
}

export async function listNotifications(): Promise<Paginated<Notification>> {
  const { data } = await djangoClient.get<Paginated<Notification>>("/notifications/");
  return data;
}

export async function markNotificationRead(id: number): Promise<void> {
  await djangoClient.patch(`/notifications/${id}/mark_read/`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await djangoClient.post("/notifications/mark_all_read/");
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const { data } = await djangoClient.get<NotificationPreferences>("/notifications/preferences/");
  return data;
}

export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const { data } = await djangoClient.patch<NotificationPreferences>("/notifications/preferences/", prefs);
  return data;
}

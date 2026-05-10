import djangoClient from "./django";
import type { ApiUser } from "@/lib/types";

export async function getMe(): Promise<ApiUser> {
  const { data } = await djangoClient.get<ApiUser>("/auth/user/");
  return data;
}

export async function listUsers(): Promise<ApiUser[]> {
  const { data } = await djangoClient.get<ApiUser[]>("/users/");
  return data;
}

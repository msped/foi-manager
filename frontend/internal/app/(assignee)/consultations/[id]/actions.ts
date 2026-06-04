"use server";

import { revalidatePath } from "next/cache";
import { sendConsultationMessage } from "@/lib/services/cases";

export async function sendMessageAction(
  consultationId: number,
  body: string,
): Promise<{ error: string } | void> {
  const stripped = body.replace(/<[^>]+>/g, "").trim();
  if (!stripped) return { error: "Message cannot be empty." };
  try {
    await sendConsultationMessage(consultationId, body);
    revalidatePath(`/assignee/consultations/${consultationId}`);
  } catch {
    return { error: "Failed to send message. Please try again." };
  }
}

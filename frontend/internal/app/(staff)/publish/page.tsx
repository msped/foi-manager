import PageHeader from "@/components/govuk/PageHeader";
import { getPublishQueue, getRejectedQueue } from "@/lib/services/publications";
import PublishQueueView from "./PublishQueueView";

export default async function PublishPage() {
  const [queue, rejected] = await Promise.all([getPublishQueue(), getRejectedQueue()]);
  return (
    <>
      <PageHeader title="Publish to disclosure log" />
      <PublishQueueView queue={queue} rejected={rejected} />
    </>
  );
}

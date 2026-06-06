import { getPublishQueue, getRejectedQueue } from "@/lib/services/publications";
import PublishQueueView from "./PublishQueueView";

export default async function PublishPage() {
  const [queue, rejected] = await Promise.all([getPublishQueue(), getRejectedQueue()]);
  return (
    <>
      <header className="staff-header">
        <h1 className="govuk-heading-l">Publish to disclosure log</h1>
      </header>
      <div className="staff-body">
        <PublishQueueView queue={queue} rejected={rejected} />
      </div>
    </>
  );
}

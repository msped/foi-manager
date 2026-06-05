import { getPublishQueue } from "@/lib/services/publications";
import PublishQueueView from "./PublishQueueView";

export default async function PublishPage() {
  const queue = await getPublishQueue();
  return (
    <>
      <header className="staff-header">
        <h1 className="govuk-heading-l">Publish to disclosure log</h1>
      </header>
      <div className="staff-body">
        <PublishQueueView queue={queue} />
      </div>
    </>
  );
}

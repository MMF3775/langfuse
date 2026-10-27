import preview from "../../../../.storybook/preview";
import { type QueueItemScore } from "@/src/features/annotation-queues/lib/queueItemScores";
import { QueueItemSummaryStrip } from "./QueueItemSummaryStrip";
import { parseQueueTraceColumns } from "@/src/features/annotation-queues/lib/queueTraceColumns";

const configs = [
  {
    id: "risk",
    name: "risk",
    categories: [
      { label: "high", value: 0 },
      { label: "medium", value: 1 },
      { label: "low", value: 2 },
    ],
  },
  {
    id: "outcome",
    name: "outcome",
    categories: [
      { label: "booked", value: 0 },
      { label: "not_booked", value: 1 },
      { label: "transferred", value: 2 },
    ],
  },
  { id: "duration", name: "duration_sec", categories: null },
  { id: "notes", name: "notes", categories: null },
];

const scores: QueueItemScore[] = [
  {
    id: "s1",
    name: "risk",
    source: "ANNOTATION",
    configId: "risk",
    dataType: "CATEGORICAL",
    value: 0,
    stringValue: "high",
    timestamp: new Date("2026-10-01T09:31:00Z"),
  },
  {
    id: "s2",
    name: "outcome",
    source: "ANNOTATION",
    configId: "outcome",
    dataType: "CATEGORICAL",
    value: 1,
    stringValue: "not_booked",
    timestamp: new Date("2026-10-01T09:31:00Z"),
  },
  {
    id: "s3",
    name: "duration_sec",
    source: "ANNOTATION",
    configId: "duration",
    dataType: "NUMERIC",
    value: 184.5,
    timestamp: new Date("2026-10-01T09:31:00Z"),
  },
  {
    id: "s4",
    name: "notes",
    source: "ANNOTATION",
    configId: "notes",
    dataType: "TEXT",
    value: 0,
    stringValue: "Caller hung up after being put on hold twice.",
    timestamp: new Date("2026-10-01T09:31:00Z"),
  },
];

const meta = preview.meta({
  component: QueueItemSummaryStrip,
});

export const Default = meta.story({
  args: {
    userId: "+49 30 1234567",
    timestamp: new Date("2026-10-01T09:30:00Z"),
    tags: ["inbound", "clinic-berlin"],
    scores,
    configs,
  },
});

export const NotYetAnnotated = meta.story({
  args: {
    userId: "+49 30 1234567",
    timestamp: new Date("2026-10-01T09:30:00Z"),
    tags: [],
    scores: [],
    configs,
  },
});

const traceColumns = parseQueueTraceColumns([
  { source: "trace", key: "userId", label: "Phone", format: "phone" },
  {
    source: "metadata",
    key: "location_name",
    label: "Location",
    format: "text",
  },
  {
    source: "metadata",
    key: "call_seconds",
    label: "Call length",
    format: "duration",
  },
  {
    source: "metadata",
    key: "recording_url",
    label: "Recording",
    format: "link",
  },
  {
    source: "metadata",
    key: "workflow_type",
    label: "Workflow",
    format: "badge",
  },
]);

export const WithTraceColumns = meta.story({
  args: {
    userId: "+13104898893",
    timestamp: new Date("2026-10-21T22:19:00Z"),
    tags: ["shop:bowie-barker-west-hollywood"],
    traceFields: traceColumns.map((column) => ({
      column,
      value:
        {
          Phone: "+13104898893",
          Location: "Bowie Barker West Hollywood",
          "Call length": "135",
          Recording: "https://example.com/recordings/call-1.mp3",
          Workflow: "telephony",
        }[column.label] ?? null,
    })),
    scores,
    configs,
  },
});

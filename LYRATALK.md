# Lyratalk fork: annotation queue score columns

This fork carries one small patch on top of an upstream Langfuse v4 tag. Only
the **web** image changes; the worker runs the official image of the same
version. It adds one additive Prisma migration (a JSON column on
`annotation_queues`) and no ClickHouse migrations.

## What the patch changes

- **Queue items table** (Human Annotation → a queue): one column per score
  config attached to the queue, in the queue's order. A cell shows the item's
  latest `ANNOTATION` score for that config, matched by config id and falling
  back to the config name. Without an annotation it shows the latest value
  from the source (`API` or `EVAL`), faded and dashed with a "Not reviewed
  yet" tooltip. Categorical and boolean values render as coloured
  badges, numeric values as numbers, and text values truncated, with the full
  text on hover. New columns also show the trace's User ID and timestamp, plus
  its tags (hidden by default). Every column can be hidden through the
  "Columns" menu.
- **Table columns from the trace** (Queue setup → "Table columns" tab):
  each queue can add its own columns, shown after the trace timestamp and
  before the score columns. A column reads one of:
  - a trace field: `userId`, `sessionId`, `name`, `environment`, `release`,
    `version`;
  - a metadata key, e.g. `location_name`, or a dotted path such as
    `customer.name` into a metadata value that holds JSON;
  - a tag prefix, e.g. `shop:` shows `west-hollywood` for the tag
    `shop:west-hollywood` (several matching tags are joined with commas).

  Each column has a label and a format:
  - `text`: the value as stored;
  - `phone`: a phone number in its country's format, using
    `libphonenumber-js`. Numbers with the +1 country code use the national
    format (`+13104898893` becomes `(310) 489-8893`), all other countries the
    international format (`+442071838750` becomes `+44 20 7183 8750`). Values
    without a valid country code stay as they are;
  - `link`: a clickable link that opens in a new tab, for http(s) URLs only,
    e.g. a recording URL;
  - `datetime`: an ISO date or a Unix timestamp (seconds or milliseconds) in
    the viewer's local time, with local and UTC time on hover;
  - `number`: a number with digit grouping, e.g. `1,234,567.5`;
  - `duration`: a number of seconds, e.g. `135` becomes `2m 15s`;
  - `badge`: a coloured badge; the same value always gets the same colour,
    and the override colours of the score badges apply.

  A value that does not fit the format (say text in a number column) is shown
  as plain text, and the raw value is always in the tooltip. Columns can be
  reordered by dragging, up to 20 per queue. The list is stored in
  `annotation_queues.display_columns` and validated by
  `AnnotationQueueDisplayColumn` in
  `packages/shared/src/features/annotation/types.ts`; reading and formatting
  live in `web/src/features/annotation-queues/lib/queueTraceColumns.ts`.
  Queues without columns look exactly as before.
- **Filters**: the "Filters" menu offers the queue's trace columns first,
  then Status, User ID and every score config. Trace columns in `number` or
  `duration` format get number comparisons, `datetime` columns date
  comparisons, and all other columns text operators that match the raw or the
  formatted value (a phone filter finds `+1310…` as well as `(310) …`). Score
  configs get any of / none of for categories, comparisons for numbers and
  text operators for text. Score filters match the value the cell shows, so
  an unreviewed source value counts until a reviewer changes it. Filters are
  kept per queue for the browser tab. The definitions and matching live in
  `web/src/features/annotation-queues/lib/queueItemFilters.ts`.
- **Badge colours** come from a fixed palette by the category's position in
  the score config. A small override map gives well-known labels fixed
  colours: high/fail/`not_*` red, medium amber, low/transferred blue,
  pass/booked/answered green. Both live in
  `web/src/features/annotation-queues/lib/queueItemScores.ts`.
- **Queue item page**: a read-only strip above the trace shows the trace's
  user id, its timestamp in local time (UTC on hover), its tags, the queue's
  trace columns in their formats (a recording link is clickable there too),
  and the current value of every queue score config. Edits made in the annotation form
  show up in the strip immediately.
- **Server**: `annotationQueueItems.itemsByQueueId` returns each item's
  scores from every source and, for trace items, a trace summary (user id,
  tags, timestamp and the other trace fields) plus `traceFields`, the values
  of the queue's trace columns. Only the metadata keys those columns use are
  read from ClickHouse. Each object type on the page costs one batched read, so a
  queue that only holds traces runs one scores query and one trace query per
  page. With a `filter`, scores live in ClickHouse and items in Postgres, so it
  loads the whole queue, filters in memory and then paginates. ClickHouse reads
  go in chunks of 1,000 ids, and queues over 20,000 items return an error
  instead of filtering.
  The trace summary helper is `getTraceSummariesByIds` in `packages/shared`,
  which reads the events table or the legacy traces table depending on
  `LANGFUSE_MIGRATION_V4_WRITE_MODE`.

Files touched: `web/src/features/annotation-queues/**`,
`packages/shared/src/server/repositories/{events,traces}.ts`,
`packages/shared/src/features/annotation/types.ts`, the Prisma schema and the
migration `20261027120000_add_annotation_queue_display_columns`, the queue
items server test, `.github/workflows/lyratalk-web-image.yml` and this file. The
queue item page client test (`AnnotationQueuesItem.clienttest.tsx`) only gains
a `useMergedScores` entry in its scores mock.

## Adding a column to a queue

1. Open Human Annotation → the queue → "Queue setup" → "Table columns".
2. Click "Add column", pick the source (Trace field, Metadata key or Tag
   prefix) and enter the key, a label and the format.
3. Click "Save changes". The column shows in the table and as a filter.

Queues created from code can set the same list through the public API:

```bash
# create a queue with columns
curl -u "$PK:$SK" -H 'Content-Type: application/json'   -X POST "$LANGFUSE_HOST/api/public/annotation-queues" -d '{
    "name": "calls 2026-10-27",
    "scoreConfigIds": ["<configId>"],
    "displayColumns": [
      { "source": "trace", "key": "userId", "label": "Phone", "format": "phone" },
      { "source": "metadata", "key": "location_name", "label": "Location", "format": "text" },
      { "source": "metadata", "key": "recording_url", "label": "Recording", "format": "link" }
    ]
  }'

# change them later; the list is replaced, other fields are kept
curl -u "$PK:$SK" -H 'Content-Type: application/json'   -X PATCH "$LANGFUSE_HOST/api/public/annotation-queues/<queueId>"   -d '{ "displayColumns": [] }'
```

`GET /api/public/annotation-queues` and `GET .../{queueId}` return
`displayColumns` too. `PATCH /api/public/annotation-queues/{queueId}` is a new
endpoint; it also accepts `name`, `description` and `scoreConfigIds`. The
contract is in `fern/apis/server/definition/annotation-queues.yml` and the
exported `web/public/generated/api/openapi.yml`.

No code change or redeploy is needed. To offer a new kind of source or
format, extend `AnnotationQueueDisplayColumn` (shared) and
`readQueueTraceField` / `formatQueueTraceField` (web).

## Build and release

Push a tag of the form `v<upstream-version>-lyratalk.<n>`, for example
`v4.70.0-lyratalk.1`. The `Lyratalk web image` workflow then builds
`web/Dockerfile` and pushes `<image>:4.70.0-lyratalk.1`.

- The image name defaults to `ghcr.io/<owner>/langfuse-web`. Set the
  repository variable `LYRATALK_WEB_IMAGE` (and `LYRATALK_REGISTRY`, plus the
  secrets `LYRATALK_REGISTRY_USERNAME` and `LYRATALK_REGISTRY_PASSWORD`) to push
  somewhere else.
- Upstream workflows such as `pipeline.yml` and `codespell.yml` also trigger on
  `v*` tags and need secrets the fork does not have. Disable them in the fork's
  Actions settings, or expect them to fail on release tags.

To build locally:

```bash
docker build -f web/Dockerfile -t <registry>/langfuse-web:4.70.0-lyratalk.1 .
```

## Rebasing onto a new upstream tag

```bash
git fetch https://github.com/langfuse/langfuse.git 'refs/tags/v4.71.0:refs/tags/v4.71.0'
git checkout -b lyratalk-queue-columns-4.71 lyratalk-queue-columns
git rebase --onto v4.71.0 v4.70.0
pnpm install && pnpm run typecheck && pnpm run lint
pnpm --filter web run test-client queueItemScores queueTraceColumns
pnpm --filter web run test annotation-queue-items-trpc
git tag v4.71.0-lyratalk.1 && git push origin lyratalk-queue-columns-4.71 v4.71.0-lyratalk.1
```

Conflicts, if any, are in `AnnotationQueueItemsTable.tsx`,
`annotationQueueItemsRouter.ts` or `TraceAnnotationProcessor.tsx`. If upstream
merges the queue items sort/filter work (langfuse/langfuse PR 15915), keep both
sides of the column list.

## Rolling back

Point the web deployment back at the official image of the same version, e.g.
`langfuse/langfuse:4.70.0`, and redeploy. The `display_columns` column can stay:
it is additive with a default, and the official image ignores it. To remove
it as well, run
`ALTER TABLE annotation_queues DROP COLUMN display_columns;` and delete the row
for `20261027120000_add_annotation_queue_display_columns` from
`_prisma_migrations`. Hidden or reordered columns are stored only in the
browser's local storage.

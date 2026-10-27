# Lyratalk fork: annotation queue score columns

This fork carries one small patch on top of an upstream Langfuse v4 tag. Only
the **web** image changes; the worker runs the official image of the same
version. There are no Prisma or ClickHouse migrations.

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
- **Filters**: the "Filters" menu filters on Status, User ID and every score
  config (any of / none of for categories, comparisons for numbers, text
  operators for text). Score filters match the value the cell shows, so an
  unreviewed source value counts until a reviewer changes it. Filters are kept
  per queue for the browser tab. The definitions and matching live in
  `web/src/features/annotation-queues/lib/queueItemFilters.ts`.
- **Badge colours** come from a fixed palette by the category's position in
  the score config. A small override map gives well-known labels fixed
  colours: high/fail/`not_*` red, medium amber, low/transferred blue,
  pass/booked/answered green. Both live in
  `web/src/features/annotation-queues/lib/queueItemScores.ts`.
- **Queue item page**: a read-only strip above the trace shows the trace's
  user id, its timestamp in local time (UTC on hover), its tags, and the
  current value of every queue score config. Edits made in the annotation form
  show up in the strip immediately.
- **Server**: `annotationQueueItems.itemsByQueueId` returns each item's
  scores from every source and, for trace items, a trace summary (user id,
  tags, timestamp). Each object type on the page costs one batched read, so a
  queue that only holds traces runs one scores query and one trace query per
  page. With a `filter`, scores live in ClickHouse and items in Postgres, so it
  loads the whole queue, filters in memory and then paginates. ClickHouse reads
  go in chunks of 1,000 ids, and queues over 20,000 items return an error
  instead of filtering.
  The trace summary helper is `getTraceSummariesByIds` in `packages/shared`,
  which reads the events table or the legacy traces table depending on
  `LANGFUSE_MIGRATION_V4_WRITE_MODE`.

Files touched: `web/src/features/annotation-queues/**`,
`packages/shared/src/server/repositories/{events,traces}.ts`, the queue items
server test, `.github/workflows/lyratalk-web-image.yml` and this file. The
queue item page client test (`AnnotationQueuesItem.clienttest.tsx`) only gains
a `useMergedScores` entry in its scores mock.

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
pnpm --filter web run test-client queueItemScores
pnpm --filter web run test annotation-queue-items-trpc
git tag v4.71.0-lyratalk.1 && git push origin lyratalk-queue-columns-4.71 v4.71.0-lyratalk.1
```

Conflicts, if any, are in `AnnotationQueueItemsTable.tsx`,
`annotationQueueItemsRouter.ts` or `TraceAnnotationProcessor.tsx`. If upstream
merges the queue items sort/filter work (langfuse/langfuse PR 15915), keep both
sides of the column list.

## Rolling back

Point the web deployment back at the official image of the same version, e.g.
`langfuse/langfuse:4.70.0`, and redeploy. Nothing else is needed: the patch
adds no migrations and writes no new data. Hidden or reordered columns are
stored only in the browser's local storage.

# Dubbing Worker Migration Design

## Decision
Keep the current SSE routes for now, but make the next architecture step a worker-backed pipeline. The service extraction now gives the worker stable boundaries for provider selection, segment audio generation, storage transfer, and finalization.

## Target Flow
1. `POST /api/dubbing/start` validates input, reserves usage, creates a `DubbingJob`, stores the upload reference, and returns/streams the created job id.
2. A queue job receives `{ jobId, userId, input }`.
3. The worker runs the existing pipeline services and writes status/progress snapshots to `DubbingJob`.
4. The client continues to use SSE or polling, but progress is read from durable job state instead of depending on one request lifetime.

## Queue Choice
BullMQ is already installed in the backend dependencies, so Redis-backed BullMQ is the preferred production option if Redis is available. If avoiding new infrastructure is more important, a Mongo-backed queue can be added later, but it will need explicit locking and stale-job recovery.

## Migration Steps
1. Extract `runDubbingJob(jobId, input, progressReporter)` from the controller after the current service boundaries settle.
2. Add a `dubbingProgress` field or small progress event collection for durable stage/message/progress state.
3. Add a BullMQ processor under `backend/workers/` that calls `runDubbingJob`.
4. Change the controller to enqueue and stream progress snapshots until completion.
5. Add recovery for jobs stuck in active states past a timeout.

## Compatibility
The route paths and response shape should remain stable. The first worker-backed version should preserve current SSE events and only change where the long-running work executes.

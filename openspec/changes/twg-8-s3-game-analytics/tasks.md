## 1. Service Dependencies

- [x] 1.1 Add `@aws-sdk/client-s3` to `service/package.json` dependencies (pin to the same major version used by the existing SDK packages, e.g. `^3.1000.0`)
- [x] 1.2 Run `npm install` in the workspace root to update `package-lock.json`

## 2. Analytics Helper

- [x] 2.1 Create `service/src/helpers/analytics.ts` with an `AnalyticsRecord` interface matching the spec schema (`gameId`, `outcome`, `round`, `playerCount`, `deckSize`, `maxLives`, `livesRemaining`, `timestamp`)
- [x] 2.2 Implement `writeAnalytics(gameId: string, gamestate: GamestateData): Promise<void>` in `analytics.ts` — constructs the record, derives the S3 key (`YYYY/MM/DD/<gameId>.json`), and calls `PutObjectCommand`
- [x] 2.3 Add early-return guard: if `ANALYTICS_BUCKET` env var is absent, log a warning and return without throwing
- [x] 2.4 Wrap the `PutObjectCommand` call in `try/catch`: on error, `console.error` the failure and return (do not re-throw)

## 3. Play Handler Integration

- [x] 3.1 Import `writeAnalytics` from `../helpers/analytics` in `service/src/handlers/play.ts`
- [x] 3.2 Add `isTerminalPhase(phase: string): boolean` helper (returns `true` for `'won'` or `'lost'`)
- [x] 3.3 In the `twinge` action handler: after `broadcastGame`, call `await writeAnalytics(game.gameId, gamestate.toData())` (or equivalent) when `isTerminalPhase(gamestate.meta.phase)` is true
- [x] 3.4 In the `nextRound` action handler: after `broadcastGame`, add the same conditional analytics emit (this path handles the won/lost transitions triggered by round advancement)
- [x] 3.5 Add `ANALYTICS_BUCKET` to the play handler's environment variable list in `_deps` / test stubs (or however the handler accesses env vars) so unit tests can stub it

## 4. CDK Infrastructure

- [x] 4.1 In `service/bin/twinge-service.js`, add an `analyticsTable` (S3 Bucket) construct named `twinge-analytics-${stage}` with `blockPublicAccess: BlockPublicAccess.BLOCK_ALL`, SSE-S3 encryption, and `autoDeleteObjects: false`
- [x] 4.2 Add a lifecycle rule to the analytics bucket: expire objects after 365 days
- [x] 4.3 Add `ANALYTICS_BUCKET: analyticsBucket.bucketName` to the `playHandler` Lambda environment
- [x] 4.4 Grant `analyticsBucket.grantPut(playHandler)` (scopes to `s3:PutObject` only) — do not use `grantReadWrite`
- [x] 4.5 Verify `cdk synth` produces the expected bucket, lifecycle rule, and IAM policy in the CloudFormation template for at least one region stack

## 5. Unit Tests

- [x] 5.1 Add unit tests for `analytics.ts`: verify correct key format (`YYYY/MM/DD/<gameId>.json`), correct record shape, and that an S3 error is caught without re-throwing
- [x] 5.2 Add unit tests for the `twinge` handler path: verify `writeAnalytics` is called when the phase is `won` or `lost`, and NOT called for `playing`
- [x] 5.3 Add unit tests for the `nextRound` handler path: same assertion as 5.2
- [x] 5.4 Run `npm test` in `service/` and confirm all existing tests and new tests pass

## 6. Validation

- [x] 6.1 Run `openspec validate --change twg-8-s3-game-analytics --store workspace` and confirm no errors
- [ ] 6.2 Review CloudWatch Logs in a test deployment to confirm analytics records are written on game completion and that failures are logged (not thrown) — DEFERRED: requires a live AWS deployment; no AWS credentials/account available in the implementation environment. All behaviour it would verify is covered by unit tests (analytics.test.ts asserts the write, the caught-error path, and the env-guard skip) and by `cdk synth` (bucket, lifecycle, least-privilege IAM). Perform this post-deploy.

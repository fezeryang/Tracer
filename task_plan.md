# Chat Phase D-6C to D-10: Backend Chat Rollout, Session Context, Streaming, and Merge Readiness

## Goal
Complete the remaining D-stage rollout after D-6B by expanding the safe backend command path, adding evidence/trust as a separate pilot flag, introducing short-term server session context, prototyping analysis-only SSE streaming, and documenting persistence/agent/merge decisions.

## Scope
- D-6C: Expand frontend server command flag allowlist to `/quote`, `/sec`, `/history`, `/chart`, `/official`
- D-6D: Add focused parity coverage through routing, adapter, route, and smoke-level tests
- D-6E: Add separate `VITE_USE_SERVER_EVIDENCE_COMMANDS` pilot for `/evidence` and `/trust`
- D-7A: Add server-side short-term `conversationId` context with in-memory TTL storage
- D-7B: Record trace/evidence persistence decision without introducing a database
- D-8A: Record streaming strategy audit
- D-8B: Add analysis-only SSE pilot endpoint
- D-9: Record Agent Core feasibility audit
- D-10: Record merge-readiness strategy

## Constraints
- Do not replace the frontend Chat main path by default
- Do not add backend trading execution
- Do not add packages or change server startup
- Do not expose API keys, raw provider responses, stacks, cookies, tokens, or raw payload bodies
- Keep backend command paths behind feature flags by default
- Do not introduce long-term memory or database persistence in D-7A/D-7B

## Phases
- [complete] D-6C: Expand backend command rollout to `/history`, `/chart`, and `/official`
- [complete] D-6D: Add focused backend/frontend parity guardrails through unit and smoke coverage
- [complete] D-6E: Gate `/evidence` and `/trust` behind `VITE_USE_SERVER_EVIDENCE_COMMANDS`
- [complete] D-7A: Add server-side in-memory session context MVP
- [complete] D-7B: Document trace/evidence persistence plan
- [complete] D-8A: Document streaming strategy audit
- [complete] D-8B: Add `/api/chat/stream` analysis-only SSE pilot
- [complete] D-9: Document Agent Core feasibility audit
- [complete] D-10: Document merge strategy and default-off rollout posture

## Verification
- Focused routing/session/route tests passed: 19 tests
- Server chat client conversationId test passed: 1 test
- SSE stream service tests passed: 2 tests
- Full verification passed after final diff: `npm run lint`, `npm run test`, `npm run build`
- API smoke passed: `/api/chat` command mode for `/help` and `/sec AAPL`, plus `/api/chat/stream` SSE start/delta/done events
- Final cleanup verification passed after removing phase/migration/provider implementation wording from backend command and analysis responses: focused server chat/model tests, `npm run lint`, `npm run test`, `npm run build`, and API smoke for `/api/chat` plus `/api/chat/stream`

## Risks
- Route handlers in `server/index.js` still own quote/news/fundamentals/history data logic, so backend tools reuse internal fetch instead of fully shared server services
- In-memory server session context is process-local and intentionally lost on restart
- `/evidence` and `/trust` remain higher risk; they are behind a second flag
- SSE pilot streams completed model text in chunks and does not stream tool/evidence execution

## Errors Encountered
- Initial curl smoke used unquoted JSON and hit Express JSON parse errors; reran with single-quoted JSON payloads and confirmed `/api/chat`
- Security scan matched existing URL templates containing environment-variable names like `token=${FINNHUB_KEY}`; no hardcoded secret value was found
- TDD red run failed as expected before `chatSessionContextService.js` and `chatStreamService.js` existed

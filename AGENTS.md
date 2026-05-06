# Repository Guidelines

## Project Structure & Module Organization

NUX Terminal is a Vite + React + TypeScript app with an Express API gateway.

- `App.tsx`, `index.tsx`, `index.html`: SPA entrypoints.
- `components/`: view and UI components such as `ReportView.tsx`, `OptionsChainView.tsx`, and trust panels.
- `services/`: frontend data and AI service wrappers, for example `marketDataService.ts`, `reportService.ts`, and `sourceTrustService.ts`.
- `server/`: Express backend routes and server-only integrations such as SEC EDGAR, DeepSeek review, trading, auth, and SQLite/BigQuery logging.
- `types.ts`: shared TypeScript interfaces and unions.
- `i18n.ts`: Chinese/English copy. Add user-facing strings here, not inline.
- `e2e/`: Playwright visual and flow tests.

## Build, Test, and Development Commands

- `npm run dev`: start the Express server with Vite middleware on port 3000.
- `npm run server`: run the Express backend only.
- `npm run build`: run `tsc` and produce a Vite production build.
- `npm run lint`: type-check with `tsc --noEmit`.
- `npm run test:e2e`: run Playwright tests.
- `npm run test:e2e:ui`: open the Playwright UI runner.

## Coding Style & Naming Conventions

Use TypeScript for frontend code and ES modules throughout. Prefer focused React components, typed props, and immutable updates. Component files use `PascalCase.tsx`; services use `camelCaseService.ts`; shared types stay in `types.ts`. Keep user-visible text in `i18n.ts`. Preserve the NUX deep navy dashboard style and avoid reintroducing VOLT branding in visible UI.

## Testing Guidelines

Run `npm run lint` and `npm run build` before handoff. Use Playwright specs in `e2e/` for visual or browser-flow regressions; name specs by feature, for example `source-trust-focused.spec.ts`. For no-key scenarios, verify pages render without Gemini, DeepSeek, SEC, or market-data credentials.

## Commit & Pull Request Guidelines

History uses concise conventional-style commits such as `feat: ...` and `chore: ...`. Prefer `<type>: <summary>` with `feat`, `fix`, `chore`, `docs`, or `refactor`. PRs should include a short summary, affected areas, test results, screenshots for UI changes, and any known limitations.

## Security & Configuration Tips

Never expose server-only keys with a `VITE_` prefix. DeepSeek keys stay backend-only as `DEEPSEEK_API_KEY`. Keep `.env`, local databases, `dist/`, and `node_modules/` out of commits. Do not rename database IDs or legacy local state unless explicitly requested.

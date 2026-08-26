# AGENTS.md

## Project Context

This is a RecoverAI app repository. Treat it as user-owned application code, keep changes focused on the user's request, and preserve existing project conventions.

Start with `README.md` for local setup, environment variables, and publish workflow.

## Key Files

- `src/`: frontend application source.
- `src/api/localDataClient.js`: persistent local data and authentication adapter.
- `src/lib/recovery.js`: recovery orchestration and policy-aware actions.
- `.env.example`: optional local configuration template.

## Working Notes

- Run `npm run dev` for local development.
- Data is synthetic and persisted in browser storage for this prototype.
- Run the relevant checks from `package.json` before finishing code changes.

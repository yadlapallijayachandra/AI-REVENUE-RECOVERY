# RecoverAI - Revenue Recovery Intelligence
> Turning failed payments into intelligent recovery opportunities.

RecoverAI analyzes failed payments and decides what should happen next instead of blindly retrying every failure. It combines failure classification, recovery scoring, expected value, strategy comparison, merchant policy checks, simulated execution, and outcome analytics.

This is a local-first demonstration. Authentication uses the local API and SQLite. Operational data uses browser-scoped storage. No real payment processor is contacted and no real money is transferred.

## Why RecoverAI?
A timeout, insufficient-funds failure, invalid card, or permanent failure should not receive the same retry strategy. RecoverAI makes failure context, recovery opportunity, economic value, and safe next actions visible to operators.

## Core Decision Flow
```text
Payment Failed -> Understand Failure -> Determine Recoverability
-> Estimate Probability -> Calculate Expected Value -> Compare Strategies
-> Apply Policy -> Select Action -> Simulate Safely -> Track Outcome
```

## Implemented Features
- **Decision engine:** `src/lib/aiEngine.js` classifies failures and calculates deterministic probability, confidence, timing, priority, and ranked strategies from transaction and customer signals. It is explainable scoring, not trained ML.
- **Expected value:** `amount * recovery probability - estimated recovery cost`; values are stored on cases and compared across strategies.
- **Recovery actions:** retry now, retry later, change payment method, send payment link or reminder, request customer action, escalate, and do not retry.
- **Explainability:** cases show failure category, decision factors, policy factors, confidence, recommendation, timing, and alternative probability/value/risk comparisons.
- **Operations:** the Recovery Queue supports cases, policy decisions, manual overrides, alternative methods, simulated retries, scheduling records, escalation, closure, notifications, and audit history.
- **Intelligence:** failure fingerprints, leakage signals, failure-reason breakdowns, and payment-method performance.
- **Analytics:** dynamic revenue at risk, recovered revenue, revenue lost, recoverable revenue, expected recovery, recovery rate, health, recovery time, and trends.
- **Simulators:** synthetic payment scenarios and recovery strategy comparisons using the same decision libraries.
- **Rules:** create, edit, enable, disable, and delete recovery rules; automatic background execution is not implemented.

## Recovery Command Center
The Dashboard summarizes transaction volume, outcomes, revenue exposure, recovery opportunities, health, failure reasons, payment-method performance, trends, and generated insights. Values are calculated from current local transaction and customer records.

## Example Recovery Flow
```text
Synthetic transaction: INR 18,500 | Credit Card | Failed
Reason: Network Timeout | Attempts: 1
  -> classify -> score -> calculate value -> evaluate policy
  -> recommend delayed retry -> simulate outcome -> audit
```

## Safety and Reliability
Implemented safeguards include bcrypt passwords, expiring single-use email tokens, signed JWT sessions in HTTP-only cookies, protected routes, auth rate limiting, retry limits, local idempotency checks, terminal-case protection, high-value policy gates, manual overrides, and audit events. These safeguards support local demonstration use; browser-local data is not a production authorization boundary.

## Authentication and Email
Registration creates a SQLite user, workspace, and membership. Verified email/password users receive a seven-day JWT in an HTTP-only `SameSite=Lax` cookie. Login, logout, verification, password reset, and protected session lookup are implemented.

Nodemailer sends verification and reset messages when SMTP is configured. Without SMTP, messages become development previews in `data/email-outbox`. Recovery reminders are not connected to external email or SMS providers.

## Data and Storage
```text
Authentication: backend/db.js -> SQLite
users, workspaces, memberships, and email tokens
Operations: src/api/localDataClient.js -> browser localStorage
transactions, customers, cases, attempts, rules, settings, notifications,
insights, and audit records
Seed data: src/lib/seeData.js -> src/hooks/useSeedData.js
```
Demo records are synthetic and isolated under a demo workspace scope. Metrics, recommendations, and states are dynamically calculated from stored records.

## Architecture
```text
React pages and shared UI
          |
          v
src/api/localDataClient.js
          |
          +--> src/lib/aiEngine.js  scoring
          +--> src/lib/recovery.js  actions and audit
          +--> src/lib/analytics.js metrics
          +--> Express API :8787 -> SQLite authentication
```

## Technology Stack
| Area | Technologies |
| --- | --- |
| Frontend | React 18, React Router 6, Vite 6 |
| Backend | Node.js, Express 5 |
| Database | SQLite, `better-sqlite3`, WAL mode |
| UI | Tailwind CSS, PostCSS, Radix UI, Lucide React |
| Charts | Recharts |
| Auth | JWT, bcryptjs, cookie-parser, CORS, express-rate-limit |
| Email | Nodemailer and local previews |
| Testing | Node.js test runner and ESLint |

## Project Structure
```text
backend/                 server.js, authRoutes.js, db.js, emailService.js
src/App.jsx              routes and providers
src/api/                 local entity adapter and auth client
src/components/          layout and UI primitives
src/hooks/                demo seeding and responsive hooks
src/lib/                 AI engine, analytics, recovery, seed data
src/pages/               dashboard, operations, simulator, settings, auth
tests/engine.test.js     decision-engine tests
.env.example             local server and SMTP template
package.json             scripts and dependencies
vite.config.js           frontend alias and API proxy
```

## Local Development
Requirements: Node.js 20+ and npm.
```bash
npm install
copy .env.example .env
npm run dev:full
```
Open `http://localhost:5173`. The API runs at `http://localhost:8787`; health is `/api/health`. Run separately with `npm run server` and `npm run dev`.
```bash
npm run build
npm run lint
npm run typecheck
npm test
npm run preview
```

## Environment Variables
Required outside local development: `SESSION_SECRET` (long random value for signed sessions).
Optional server variables: `API_PORT`, `PUBLIC_APP_URL`, `FRONTEND_ORIGIN`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`.
Optional client variables: `VITE_APP_NAME`, `VITE_SYNTHETIC_DATA_ONLY`. Keep secrets in `.env`, never in frontend source code.

## Demo Walkthrough
1. Select `Explore Demo` on the login page.
2. Inspect Dashboard metrics and recovery health.
3. Select a failed payment in Transactions.
4. Review failure analysis, probability, value, timing, and recommendation.
5. Compare strategies in case detail or the simulator.
6. Execute a simulated action and inspect metrics, notifications, and audit history.
Demo Mode marks the synthetic workspace. `Reset Demo Data` clears its browser-local records.

## Current Implementation vs Future Work
**Current:** React operations console, SQLite-backed email/password auth, synthetic data, browser-local CRUD, deterministic scoring, cases, policies, simulated payments, analytics, simulators, rules, notifications, and audit history.

**Future:** server-side repositories, durable workspace authorization, payment gateways, webhooks, background workers, provider-backed recovery email/SMS, trained ML models, calibration, retraining, anomaly detection, segmentation, learning feedback loops, and production deployment controls.

## Limitations and Safety Notes
This is a demonstration and portfolio prototype. Operational records are browser-local and can be changed or removed by the browser owner. Payment execution and outcomes are simulated. Rules are not automatically evaluated by a worker. The scoring engine is deterministic and reports no production accuracy. Do not use real card data, payment credentials, customer data, or production secrets.
## Differentiation
RecoverAI is not simply:
```text
Failed Payment -> Retry
```
It is:
```text
Failed Payment -> Understand -> Predict -> Evaluate
                -> Decide -> Safely Recover -> Measure
```
The product focuses on choosing the right recovery action at the right time rather than blindly increasing retry volume.

**Recover the right payment.**  
**At the right time.**  
**With the right strategy.**

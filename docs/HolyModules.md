# Holy Modules

---

## Web: Framework frontend and backend — Major (2pts)

Web: Framework frontend and backend  major 2
  Use a framework for both the frontend and backend
  Use a frontend framework (React, Vue, Angular, Svelte, etc.).
  Use a backend framework (Express, NestJS, Django, Flask, Ruby on Rails,
    etc.).
  Full-stack frameworks (Next.js, Nuxt.js, SvelteKit) count as both if you use
    both their frontend and backend capabilities.

**Responsible:** Pawel (Frontend), Balint(Backend)

**Brief description of functionality:**

> Backend: The Backend server is implemented with Express, organized into route modules, controllers, middleware, services, and Sequelize models. It exposes REST endpoints under `/api`, runs HTTPS, and shares infrastructure with a websocket server.

**Justification of subject compliance:**

> Backend compliance: We use a backend framework (Express) with framework-native routing/middleware/controller patterns, satisfying the requirement to use a backend framework.

---

## Web: ORM for db — Minor (1pt)

Web: ORM for db minor 1
  Use an ORM for the database.

**Responsible:** Marian

**Brief description of functionality:**

> _Fill in here_

**Justification of subject compliance:**

> _Fill in here_

---

## Web: Websocket — Major (2pts)

Web: Websocket Major 2
  Implement real-time features using WebSockets or similar technology.
  Real-time updates across clients.
  Handle connection/disconnection gracefully.
  Efficient message broadcasting.

**Responsible:** Dongjun

**Brief description of functionality:**

> _Fill in here_

**Justification of subject compliance:**

> _Fill in here_

---

## Web: Public API — Major (2pts)

Web: Public API  Major 2
  A public API to interact with the database with a secured API key, rate
    limiting, documentation, and at least 5 endpoints:
  GET /api/{something}
  POST /api/{something}
  PUT /api/{something}
  DELETE /api/{something}

**Responsible:** Marian

**Brief description of functionality:**

> _Fill in here_

**Justification of subject compliance:**

> _Fill in here_

---

## Web: Advanced search — Minor (1pt)

Web: Advanced search minor 1
  Implement advanced search functionality with filters, sorting, and pagination.

**Responsible:** Dongjun

**Brief description of functionality:**

> _Fill in here_

**Justification of subject compliance:**

> _Fill in here_

---

## Data & Analytics: GDPR compliance — Minor (1pt)

Data & Analytics: GDPR compliance minor 1
  GDPR compliance features.
  Allow users to request their data.
  Data deletion with confirmation.
  Export user data in a readable format.
  Confirmation emails for data operations.

**Responsible:** Balint

**Brief description of functionality:**

> GDPR endpoints are implemented in authenticated account settings under `/api/auth`:
> `POST /me/data-request`, `GET /me/data-export`, `GET /me/data-export/csv`, `POST /me/data-deletion/request`, and `POST /me/data-deletion/confirm`.
>
> Users can request their data, download exports in readable formats (JSON and CSV), and perform account/data deletion with an explicit confirmation step (email one-time code). GDPR operations are audited and trigger confirmation emails.

**Justification of subject compliance:**

> Allow users to request their data: implemented via `POST /me/data-request`.
>
> Data deletion with confirmation: implemented as a two-step flow (`/me/data-deletion/request` then `/me/data-deletion/confirm`) with a one-time email code.
>
> Export user data in a readable format: implemented through downloadable JSON and CSV exports (`/me/data-export`, `/me/data-export/csv`).
>
> Confirmation emails for data operations: implemented through the GDPR notification service for request, export, and deletion operations.

---

## Data & Analytics: Support for additional browsers — Minor (1pt)

Data & Analytics: Support for additional browsers minor 1
  Full compatibility with at least 2 additional browsers (Firefox, Safari, Edge,
    etc.).
  Test and fix all features in each browser.
  Document any browser-specific limitations.
  Consistent UI/UX across all supported browsers.

**Responsible:** Pawel

**Brief description of functionality:**

> _Fill in here_

**Justification of subject compliance:**

> _Fill in here_

---

## Data & Analytics: Advanced analytics dashboard with data visualization — Major (2pts)

Data & Analytics: Advanced analytics dashboard with data visualization Major 2
  Interactive charts and graphs (line, bar, pie, etc.).
  Real-time data updates.
  Export functionality (PDF, CSV, etc.).
  Customizable date ranges and filters.

**Responsible:** Dongjun

**Brief description of functionality:**

> _Fill in here_

**Justification of subject compliance:**

> _Fill in here_

---

## Cybersecurity: WAF/ModSecurity (hardened) + HashiCorp Vault — Major (2pts)

Cybersecurity: WAF/ModSecurity (hardened) + HashiCorp Vault Major 2
  Implement WAF/ModSecurity (hardened) + HashiCorp Vault for secrets:
  Configure strict ModSecurity/WAF.
  Manage secrets in Vault (API keys, credentials, environment variables), en-
    crypted and isolated.

**Responsible:** Darius

**Brief description of functionality:**

> _Fill in here_

**Justification of subject compliance:**

> _Fill in here_

---

## User management: 2FA authentication — Minor (1pt)

User management: 2FA authentication minor 1
Implement a complete 2FA (Two-Factor Authentication) system for the
users.

**Responsible:** Balint

**Brief description of functionality:**

> The project uses a complete challenge/confirmation 2FA flow based on one-time email codes. Login is split into two steps: credential check (`POST /login`) and verification (`POST /login/confirm`) before issuing an authenticated session.
>
> The same one-time-code infrastructure is also used for sensitive account actions (password reset confirmation, profile update confirmation, and GDPR deletion confirmation), giving consistent second-factor protection.

**Justification of subject compliance:**

> Complete 2FA system: implemented with challenge issuance, secure code hashing, TTL expiration, limited attempts, and server-side verification before granting access.
>
> Delivery and user flow: verification codes are sent by email and consumed in dedicated confirmation endpoints.
>
> Security completeness: route-level rate limiting is applied to challenge issuance and verification endpoints, and invalid/expired challenges are rejected, which makes the 2FA flow production-grade rather than partial.

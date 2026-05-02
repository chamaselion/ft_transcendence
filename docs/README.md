*This project has been created as part of the 42 curriculum by dpaluszk, dongjule, mkijewsk, bszikora.*

# ft_transcedence

## Description

ft_transcedence is a student project to build a single place where users can register and track their financial assets. The project goal is to provide a secure, multi-platform web application that aggregates different asset types and presents analytics and exportable reports.

Key planned features (high level):
- Advanced analytics dashboard with data visualization (Major)
- WAF/ModSecurity hardening and HashiCorp Vault for secrets (Major)
- Fullstack framework usage (frontend + backend) (Major)
- Real-time features via WebSockets (Major)
- Multi-language support (>=3 languages) (Minor)
- Advanced search with filters, sorting, pagination (Minor)
- ORM-based database access (Minor)
- GDPR compliance features (Minor)
- Data import/export (Minor)
- Cross-browser support (Minor)

## Instructions

> Note: This project is in early development. Fill the environment and command details below as development progresses.

Prerequisites
- Git
- Node.js (recommended version: enter exact version here)
- npm or yarn
- Docker & Docker Compose

Local development (suggested)
1. Frontend
	- cd srcs/frontend
	- npm install
	- npm run dev

2. Using Docker Compose (if available)
	- docker compose up --build
	- Visit http://localhost:80 or the configured port

Environment variables (.env)
- Create a `.env` file at the repository root or in each service folder as needed.
- Example variables to include (replace values):
```
# Example .env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgres://user:pass@localhost:5432/ft_transcedence
JWT_SECRET=change_this_to_a_strong_secret
```

## Resources

List here useful documentation, tutorials, and references for the tech you used. Also document how AI was used in the project.

Examples to include:
- Framework docs (React, Vite, Express, etc.)
- Tutorials or articles referenced
- Security references (OWASP, ModSecurity docs)

AI usage (REQUIRED):
- Describe if/where AI assisted: e.g., code scaffolding, documentation drafting, test generation. Be explicit about which tasks were assisted and which parts are original student work.

## Team Information

The following people are listed at the top of this README. For each person their current assigned role is given;

- dpaluszk — Dariusz Paluszkiewicz — PO — defines product vision, prioritizes features.
- dongjule — Dongjun Lee — Tech Lead — leads architecture decisions and technical reviews.
- mkijewsk — Marian Kijewski — Developer — implements features, writes tests.
- bszikora — Balint Szikora — PM — coordinates tasks, maintains the project board, CI and release coordination.

(Please fill in detailed responsibilities, sprint assignments, and exact contributions per person in the "Individual Contributions" section below.)

## Project Management

- We distributed tasks via weekly meetings and documented them in github issues.
- Tools used: GitHub Issues
- Communication channels: Whatsapp Google Meets

## Technical Stack

- Frontend: (framework + version) — e.g., React + Vite (fill exact versions)
- Backend: (framework + version) — e.g., Express / NestJS (fill exact)
- Database: (system + version) — e.g., PostgreSQL (fill exact) and reason for choice
- ORM: (e.g., Prisma, TypeORM, Sequelize) — fill in
- Security and infra: WAF / ModSecurity, HashiCorp Vault — fill in implementation notes
- Real-time: WebSockets (e.g., socket.io) — fill in when used

Justification for major choices
- Provide short reasons for choosing core technologies (scalability, familiarity, ecosystem, security, etc.)

## Database Schema

Provide a visual or textual description of the database structure. Example placeholder layout:

- users (id, login, email, password_hash, created_at)
- assets (id, user_id -> users.id, type, amount, currency, metadata)
- transactions (id, asset_id -> assets.id, amount, timestamp, type)
- sessions, tokens, audit_logs, etc.

Explain relationships (one-to-many, many-to-many) and key fields and types. Replace with an ER diagram or SQL schema dump when available.

## Features List

- Planned features: list each feature and mark status (Planned / In Progress / Done)
- For each feature, add the team member(s) responsible

Example table (fill in):
- Advanced analytics dashboard — Status: Planned — Owner(s): 
- Real-time notifications — Status: Planned — Owner(s): 

## Modules (Major/Minor)

### Point Calculation Summary

| Type | Count | Points |
|------|-------|--------|
| Major Modules | 4 | 8 pts |
| Minor Modules | 6 | 6 pts |
| **Total** | **10** | **14 pts** |

### Module Breakdown

#### Major Modules (2 pts each)

1. **Web: Use a framework for both frontend and backend**
   - Category: Web (IV.1)
   - Points: 2
   - Justification: Core requirement for scalable architecture. Frontend uses a modern framework (React/Vue/etc.), backend uses a comprehensive framework (Express/NestJS/Django/etc.).
   - Implementation: (framework + version to be specified)
   - Owner(s): Tech Lead + Developers
   - Status: Planned

2. **Web: Implement real-time features using WebSockets**
   - Category: Web (IV.1)
   - Points: 2
   - Justification: Essential for users to see live asset value updates and real-time notifications without page refresh.
   - Implementation: WebSockets (socket.io or similar), real-time data synchronization, connection/reconnection handling.
   - Owner(s): (to be assigned)
   - Status: Planned
   - Dependencies: Requires framework module above.

3. **Data & Analytics: Advanced analytics dashboard with data visualization**
   - Category: Data and Analytics (IV.8)
   - Points: 2
   - Justification: Core feature for a financial asset tracker. Users need interactive charts, real-time data updates, custom date ranges, and export capabilities to analyze their portfolio.
   - Implementation: Charts library (Chart.js, D3.js, or similar), filtering/date range controls, export to PDF/CSV.
   - Owner(s): (to be assigned)
   - Status: Planned

4. **Cybersecurity: WAF/ModSecurity + HashiCorp Vault for secrets**
   - Category: Cybersecurity (IV.5)
   - Points: 2
   - Justification: Financial data is sensitive; hardened WAF and secure secret management are critical for compliance and security.
   - Implementation: ModSecurity configured with strict rules, HashiCorp Vault for API keys and database credentials (encrypted and isolated).
   - Owner(s): Tech Lead
   - Status: Planned

#### Minor Modules (1 pt each)

5. **Web: Use an ORM for the database**
   - Category: Web (IV.1)
   - Points: 1
   - Justification: ORM improves database abstraction, type safety (with TypeScript), and reduces SQL injection risks.
   - Implementation: Prisma, TypeORM, Sequelize, or equivalent.
   - Owner(s): (to be assigned)
   - Status: Planned
   - Dependencies: Requires database and framework modules.

6. **Accessibility & Internationalization: Support for multiple languages (>=3)**
   - Category: Accessibility and Internationalization (IV.2)
   - Points: 1
   - Justification: Increases accessibility and user base. i18n system with at least 3 language translations and UI language switcher.
   - Implementation: i18n library (react-i18next, Vue i18n, etc.), translation files for EN, FR, and one additional language.
   - Owner(s): (to be assigned)
   - Status: Planned

7. **Web: Advanced search with filters, sorting, and pagination**
   - Category: Web (IV.1)
   - Points: 1
   - Justification: Users need to search assets by type, amount, date range, etc., with efficient pagination for large portfolios.
   - Implementation: Full-text search backend, filter UI, sorting controls, pagination with configurable page size.
   - Owner(s): (to be assigned)
   - Status: Planned

8. **Data & Analytics: GDPR compliance features**
   - Category: Data and Analytics (IV.8)
   - Points: 1
   - Justification: Financial data is regulated under GDPR in EU. Must allow users to request, export, and delete their data.
   - Implementation: Data export endpoint (JSON/CSV), data deletion with confirmation, audit logs, consent management.
   - Owner(s): (to be assigned)
   - Status: Planned

9. **Data & Analytics: Data export and import functionality**
   - Category: Data and Analytics (IV.8)
   - Points: 1
   - Justification: Users can backup, transfer, or bulk-manage their asset data. Export to JSON/CSV/XML; import with validation.
   - Implementation: Export endpoints, import upload handler with format validation, bulk operation support.
   - Owner(s): (to be assigned)
   - Status: Planned
   - Dependencies: Requires database module.

10. **Accessibility & Internationalization: Support for additional browsers**
    - Category: Accessibility and Internationalization (IV.2)
    - Points: 1
    - Justification: Full compatibility with Firefox, Safari, and Edge ensures broad user reach.
    - Implementation: Test and fix all features in Firefox, Safari, Edge; document any browser-specific CSS or polyfills needed.
    - Owner(s): (to be assigned)
    - Status: Planned

### Module Interaction & Coherence

- **Financial Asset Tracking Core**: Frameworks + WebSockets + Analytics Dashboard form the heart of the application.
- **Data Privacy & Security**: WAF/Vault + GDPR + Export/Import work together to meet compliance and user control requirements.
- **Accessibility**: Multi-language + cross-browser support make the app usable globally.
- **Technical Foundation**: ORM + Advanced Search provide efficient data handling and retrieval.

All modules work together cohesively to deliver a secure, scalable, multi-user financial asset tracking platform.

## Mandatory Requirements Checklist

Before evaluation, ensure these mandatory parts are complete. **Failure to implement these will result in project rejection.**

- [ ] **Web Application Structure**: Frontend, backend, and database implemented.
- [ ] **Git Usage**: Clear commit messages from all team members; visible work distribution.
- [ ] **Containerization**: Docker/Podman setup; runs with `docker compose up --build`.
- [ ] **Browser Compatibility**: Latest stable Chrome version; no console errors/warnings.
- [ ] **Privacy & Legal**: Accessible Privacy Policy and Terms of Service pages (substantive, not placeholder).
- [ ] **Multi-user Support**: Multiple concurrent users, no data corruption, real-time updates where applicable.
- [ ] **Responsive Design**: Clear, responsive frontend across all devices; CSS framework used (Tailwind, Bootstrap, etc.).
- [ ] **Environment Configuration**: `.env` file for secrets (ignored by Git); `.env.example` provided.
- [ ] **Database Schema**: Clear schema with defined relationships.
- [ ] **User Management**: Sign up, login, secure password handling (hashed + salted).
- [ ] **Form Validation**: Frontend and backend validation for all inputs.
- [ ] **HTTPS**: Enforced for all backend communication.
- [ ] **README.md**: Complete with all required sections (Description, Instructions, Resources, Team Info, Technical Stack, Database Schema, Features List, Modules, Individual Contributions).

## Individual Contributions

For each team member, provide a detailed breakdown of implemented features, modules, or components; tests written; infra work; CI; and any notable challenges and resolutions.

(Placeholders: fill these sections after completing work.)

## Known Limitations

Document any known bugs, incomplete features, or security/compatibility issues.

## How to Contribute

- Follow the branch naming and PR rules in `docs/GIT_WORKFLOW.md`.
- Create a branch using the required prefix (e.g., `feature/`, `fix/`, `docs/`).
- Open a PR with a clear description and link to the issue.
- Ensure at least one review before merging.

## License & Credits

- Add license information here.
- https://swagger.io/specification/ - API
- https://spec.openapis.org/oas/v3.1.0.html - API
- https://www.youtube.com/watch?v=-MTSQjw5DrM - API
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods - API
---

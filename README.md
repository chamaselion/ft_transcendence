# Trans Edit

![image](srcs/frontend/transcendence-spa/public/pwa-192x192.png)

## Description

Trans Edit is an web application, that **trans**lates and **edit**s. Since multiple Users can edit the same File at the same time, it **trans**encends so language and space.

## Instructions

### Quick Start
you need
'''
docker & docker compose (version 20.10 +)
make
openssl
'''

1. clone the project
2. run 'cp .env.example .env'
3. change the keys JWT_SECRET, POSTGRES_PASSWORD, DATABASE_URL (with the POSTGRES_PASSWORD) in the new .env file.
4. run 'make'

docker will the proceed with the dev build, serving it on the configured HTTPS_HOST_PORT, standard [https://localhost:8443](https://localhost:8443)

### Enviroment options

  - `JWT_SECRET`: Secret key used to sign and verify JWT session cookies (generate with `openssl rand -hex 32`).
  - `JWT_EXPIRES_IN`: Session token lifetime (e.g., `7d`).
  - `BCRYPT_SALT_ROUNDS`: Cost factor for bcrypt password and OTP hashing (default `10`).
  - `ADMIN_EMAIL`: Email address automatically granted the `admin` role upon registration.
  - `NODE_ENV`: Runtime mode (`development` or `production`).

  - `HTTPS_HOST_PORT` / `HTTP_HOST_PORT`: Host ports exposed by Nginx in development mode (defaults `8443` / `8080`).
  - `PROD_HTTPS_HOST_PORT` / `PROD_HTTP_HOST_PORT`: Host ports exposed by Nginx in production mode (defaults `443` / `80`).
  - `PORT` / `BACKEND_HOST_PORT`: Internal and host port for the Express backend (default `3001`).
  - `DB_HOST_PORT`: Host port mapped to the PostgreSQL container (default `5433`).

  - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_PORT`: PostgreSQL container credentials and connection parameters.
  - `DATABASE_URL`: Full PostgreSQL connection string used by Sequelize (`postgres://<user>:<password>@db:5432/<db>`).
  - `DB_RETRY_LIMIT` / `DB_RETRY_DELAY_MS`: Startup connection retry attempts and delay in milliseconds.

  - `EMAIL_TRANSPORT`: Delivery mode for 2FA and GDPR emails (`console` logs OTP codes to backend stdout; `smtp` sends real emails via Nodemailer).
  - `EMAIL_FROM`: Sender address for outgoing emails.
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`: SMTP server configuration and credentials when `EMAIL_TRANSPORT=smtp`.
  - `ONE_TIME_CODE_LENGTH`, `ONE_TIME_CODE_MAX_ATTEMPTS`, `ONE_TIME_CODE_TTL_MS`: OTP length (default `6`), max verification tries (`3`), and expiration time in ms (`600000` = 10 min).

  - `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET`, `OAUTH_GITHUB_REDIRECT_URI`: GitHub OAuth app credentials and callback URL.
  - `OAUTH_GITHUB_AUTHORIZE_URL`, `OAUTH_GITHUB_TOKEN_URL`, `OAUTH_GITHUB_USERINFO_URL`: GitHub OAuth endpoints.
  - `OAUTH_42_CLIENT_ID`, `OAUTH_42_CLIENT_SECRET`, `OAUTH_42_REDIRECT_URI`: 42 Intra OAuth app credentials and callback URL.
  - `OAUTH_42_AUTHORIZE_URL`, `OAUTH_42_TOKEN_URL`, `OAUTH_42_USERINFO_URL`: 42 Intra OAuth endpoints.

  - `RUSTFS_ADMIN_ACCESS_KEY`, `RUSTFS_ADMIN_SECRET_KEY`: Root credentials for the RustFS container.
  - `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`: S3 client configuration used by the backend and `obj-storage-init` to store user avatars (default bucket `user-icons`).

  - `AI_PROVIDER`: Active LLM backend (`openai`, `deepseek`, `anthropic`, or `mock` for offline/keyless testing).
  - `AI_MODEL`: Model identifier passed to the provider (e.g., `gpt-4o-mini`, `deepseek-chat`, `claude-sonnet-4-6`).
  - `AI_API_KEY`: API key for the selected cloud LLM provider (not required when `AI_PROVIDER=mock`).
  - `AI_BASE_URL`: Optional custom base URL override for OpenAI-compatible endpoints.
  - `AI_TIMEOUT_MS`: Request timeout in milliseconds for AI calls (default `30000`).

## Team Information

| Member | Assigned Role | Responsibilities |
|---|---|---|
| **bszikora** (Balint Szikora) | Tech Lead / Architect + Developer | Backend architecture and stack decisions. Database architecture, authentication, GDPR compliance. |
| **mandre** (Mateo Andre) | PM + Developer | Mateo set up the meetings. Frontend SPA shell, authentication, user settings, object storage, admin interface, WYSIWYG PDF export, and PWA setup |
| **afelger** (Alain Felger) | PO + Developer | Product vision, feature backlog prioritization. The block editor, frontend components, translation/elaboration. |
| **blohrer** (Benjamin Lohrer) | Developer / Documentation Lead | API endpoints for USER, DOCUMENTS, searches. Websocket communication. Created the API reference |

## Project Management

Since we are a busy team, good communications and documenting issues as well as progress was important and we had one or the other switch-up.

We organized using:
 - WhatsApp (text communication)
 - Discord (team meetings, joint work sessions)
 - GitHub (Issues, PRs, Git)

No pushes to main were allowed, each feature had to go through a seperate branch, a Pull Request and a team member review. Tasks were distributed in a weekly or bi-weekly call. Since the frontend / backend could be cleanly split (except for the websockets), features were talked about in the meeting, using a list of modules we wanted to implement.
Nontheless, feature-creep took place, and we added some features like **ai-tranlations**, **profile pictures** since they made sense at the time of implemtation

## Technical Stack

#### Frontend
- vue, tailwind, pinia, tabler icons
#### Backend
- express, bcrypt, websockets, nodemailer, pg & sequlize
#### Database
- postgres 16, since it offers native uuid primary keys, enum types and jsonb columns. There is also row locking, to avoid race conditions
#### Object Storage
- rustfs is used as an aditional object storage, to save user provided content, e.g. the profile pictures. A possible enhancement could be Images or videos inside the documents.

## Database Schema

```mermaid
erDiagram
    users ||--o{ documents : owns
    users ||--o{ document_shares : "is granted"
    documents ||--o{ document_shares : "shared via"
    users ||--o{ auth_sessions : has
    users ||--o{ user_oauth_accounts : links
    users ||--o{ oauth_state_intents : starts
    users ||--o{ one_time_challenges : requests
    users ||--o{ gdpr_audit_events : logs
    users ||--|| gdpr_export_quotas : limits

    users {
        uuid id PK
        varchar login UK
        varchar email UK
        varchar password_hash "nullable for OAuth-only"
        enum role "admin | user"
    }
    documents {
        uuid id PK
        varchar title "default Untitled"
        text content "JSON array of blocks"
        uuid owner_id FK
    }
    document_shares {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        enum permission "viewer | editor"
    }
    auth_sessions {
        text token PK
        uuid user_id FK
        timestamp login_at
        timestamp last_seen_at
        timestamp expires_at
    }
    user_oauth_accounts {
        serial id PK
        uuid user_id FK
        enum provider "github | 42"
        varchar provider_user_id
        boolean email_verified
        text avatar_url
    }
    oauth_state_intents {
        uuid state_id PK
        uuid user_id FK
        enum provider "github | 42"
        enum mode "login | link"
        timestamp expires_at
    }
    one_time_challenges {
        uuid challenge_id PK
        uuid user_id FK
        varchar purpose
        varchar recipient
        varchar code_hash "bcrypt hash, never plain text"
        jsonb payload
        integer attempts_remaining
        timestamp expires_at
    }
    gdpr_audit_events {
        uuid id PK
        uuid user_id FK
        varchar action_type
        varchar status
        jsonb metadata
        timestamp event_at
    }
    gdpr_export_quotas {
        uuid user_id PK
        timestamp window_start_at
        integer export_count
    }
```
## Feature List

1. **Auth & OAuth**, registering and gdpr data access. Has an administrative mode
2. **Document system**, create, delete, share the documents. Keep as an owner track of persons that can access it. Export the files to pdf
3. **User Roles per Document** - as an *owner* you can assign *viewers* and *editors* or revoke their access.
4. **Live and Collaborative Editing** 
5. **Translation & AI-Elaboration** lets you work with people, that can write better in different languages or lets make your work in a specific style

## Modules

- **Use a framework for both the frontend and backend** (Major, IV.1 Web, Everyone):
  - **Justification:** Both frameworks take out a lot of work: Vue3 for building a Single Page Application, express for the network operation and routing in the backend. 
  - **Implementation:** Built the frontend SPA with Vue 3 and the backend REST API with Express.

- **Implement real-time features using WebSockets** (Major, Web, Benjamin, Alain):
  - **Justification:** Live multi-user editing requires continous low-latency server connection.
  - **Implementation:** Implemented via `ws` in `noServer` mode (`documentSocket.js`) with cookie-authenticated HTTP upgrades, per-document broadcast rooms, 30s heart beat and a chat-room like entry.

- **Advanced permissions system** (Major, User Management, Benjamin, Mateo):
  - **Justification:** Collaborative document management requires local access managment. A multiple user enviroment with a lot of user generated content requires an admin access.
  - **Implementation:** Combined global access control (`admin` vs. `user` via `requireRole('admin')` and `/admin` UI) with editor-level local access control (`owner`, `editor`, `viewer`).

- **Implement a complete LLM system interface** (Major, Artificial Intelligence, Balint, Alain):
  - **Justification:** Elaborate, test or check your written notes and tools. Context aware, so that the block surrounding it do not get lost.
  - **Implementation:** Request Block with Context on backend route, Backend requests from ai api endpoint (e.g. OpenAI). Response is streamed, since its slow, to the user for more feedback.

- **Use an ORM for the database** (Minor, Web, Balint):
  - **Justification:** An ORM guarantees database integrity between backend and frontend.
  - **Implementation:** Used Sequelize to define all PostgreSQL tables and is used for requests to the DB.

- **Real-time collaborative features** (Minor, Web, Alain, Benjamin):
  - **Justification:** Multiple users can access the same document at the same time. Avoid data races.
  - **Implementation:** Documents are structured as Blocks, which have to be locked before the are altered. Changes are debounced, to lower network traffic (DOS through your cat sitting on the keyboard)

- **Custom-made design system (min. 10 components)** (Minor, Web, Alain):
  - **Justification:** Unified display on all frontend pages. Looks professional
  - **Implementation:** Created 20 custom Vue components styled with semantic CSS, showcased at `/test`.

- **Implement advanced search functionality with filters, sorting, and pagination** (Minor, Web, Benjamin, Alain, Mateo):
  - **Justification:** Ever searched in a large libary (e.g. your 340 not-played Steam games?) without knowing the name of the game?
  - **Implementation:** Created a query parser (`listQuery.js`) with escaped search using `ILIKE` of PostGREs. Filterable and Sortable

- **Progressive Web App (PWA) with offline support and installability** (Minor, Web, Alain):
  - **Justification:** Users should be able to install TransEdit as a standalone desktop/mobile app and load the application shell offline.
  - **Implementation:** Configured `vite-plugin-pwa` with a service worker that caches statics.

- **Support for multiple languages (at least 3 languages)** (Minor, Accessibility & i18n, Everyone):
  - **Justification:** As a cross-language team, multiple languages and editing in more then one language seemed like the next step for browser-based webeditors
  - **Implementation:** Used `vue-i18n`, created a list of words from already existing frontend code, translated it. Replaced any writen word with a call to the dictionary.

- **Support for additional browsers** (Minor, Accessibility & i18n, Everyone):
  - **Justification:** 2 Persons on Linux, on Person on Mac, one Person working from windows, multi-browser support was natural. Also, industry standard (exept for certain google-features)
  - **Implementation:** Built using standard ES2022 and CSS custom properties, with tailwind helping lots! verified across Google Chrome, Mozilla Firefox, Microsoft Edge, and Apple Safari.

- **Implement remote authentication with OAuth 2.0** (Minor, User Management, Balint, Mateo):
  - **Justification:** Faster Authentification, secrets and responsibility for the auth process lie somewhere else. De-facto industry standard
  - **Implementation:** Implemented the full server-side OAuth 2.0 authorization-code flow for GitHub and 42.

- **Implement a complete 2FA system** (Minor, User Management, Balint, Mateo):
  - **Justification:** Sensitive account actions and logins require a second verification factor. See the event platform of 42, GitHub, Google
  - **Implementation:** On login, password reset, profile updates, and account deletion a 10-minute-valid One Time Password is created and sent by mail.

- **GDPR compliance features** (Minor, Data and Analytics, Balint, Mateo):
  - **Justification:** We are all citizens of europe, App runs in Web.
  - **Implementation:** Implemented a data request form, a data deletion system for account deletion.

- **Module of Choice: Canonical Cross-Language Collaborative Editing & S3 Media Pipeline** (Minor, Modules of choice, Everyone):
  - **Justification:** Editing a document over multiple languages was the whole idea of the project
  - **Implementation:** AI-Translation in Frontend, with only the english representation being saved, spared code- and citation-blocks for consistency and retained meaning of the words, as citations often contain a hidden meaning, that can be lost in translation.


## Individual Contributions

##### Balint

- architecture
- backend auth & OAuth
- services for backend

Designing the OTP mechanism was interesting and had a lot of error sources, since the smtp protocol and partners are sometimes out of our control. Finding the right tech stack for the backend was a challenge as well.

##### Benjamin
- Backend document endpoints (CRUD & sharing)
- Websocket construct (rooms, messages, wss)
- Advanced search
- API documentation
- integration test scripts

The new websocket connection protocol was new for me. Having data integrety over the backend and database was sometimes challenging, especially with so many new technologies beeing used.

##### Mateo

- frontend auth
- settings
- object storage
- pdf export of files

Implementing the pdf export was one of the more error-prone elements. I sourced a libary providing automatic translations, but Alain nagged at me: Wrong distance to the document sides, wrong shape, false formated. On the other hand, I found there some problems with his Editor code, like non-wrapping lines.

##### Alain 
- mostly Editor part
- PWA
- AI-Translation / Elaboration

The most difficult part was to align data-states across multiple users. The Translation-feature increased friction there. PWA was hindering webserver deployment, as certain routes were redirected. Since this is overlapping with an old project of mine (purely in localstorage, no multiuser, no ai), the part with the editor blocks was a simple go-to solution, which fitted good to problems.

---

## Known Limitations

- **Self-Signed TLS Certificates in Development:** Because the stack enforces HTTPS everywhere (`SameSite=Strict; Secure` cookies), PWA does not work there. Create certs with a `make cert-trusted` (uses and requires certbot) or use the online version.
- **Safari Private Browsing & `localStorage`:** In strict privacy modes where `localStorage` throws `QuotaExceededError` or `SecurityError` `useTheme.ts`, and `CookieBanner.vue` catch storage exceptions and fall back to in-memory session state and `navigator.language`.
- Document Language:** Document titles remain in their original language and code/citation blocks are intentionally excluded from automatic AI translation, so source code and direct quotes are never changed by translation.

---

## Resources

- [MDN — WebSockets API](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [MDN — Using Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Vue 3 Documentation](https://vuejs.org/guide/introduction.html) & [Pinia Documentation](https://pinia.vuejs.org/)
- [Vue I18n Guide](https://vue-i18n.intlify.dev/)
- [Tailwind CSS v4 Documentation](https://tailwindcss.com/docs)
- [Sequelize v6 Documentation](https://sequelize.org/docs/v6/)
- [RFC 6749 — The OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)
- [OWASP — Authentication & Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/)
- [Sharp High-Performance Node.js Image Processing](https://sharp.pixelplumbing.com/)
- [Vite PWA Plugin Documentation](https://vite-pwa-org.netlify.app/)
- [Google SMTP setup](https://dev.to/likhit/i-tried-to-send-emails-using-gmail-smtp-heres-what-actually-worked-2ec1)

## Things that could be added

- more OAuth providers
- more languages
- stylized code depending on flavour
- images in text

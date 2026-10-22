# Privacy Policy

**Version 1.0 · Last updated: 21.10.2026**

## 1. Data Controller

**Trans Edit** ("the Service", "we", "us") is operated by **a 42 Team Lead by bszikora**, located at **Weipertstraße 8-10, 74076 Heilbronn, Germany**. For all privacy and data-protection inquiries, contact us at **afelger@student.42heilbronn.de**.

## 2. Personal Data We Collect

We collect and process only the data strictly required to provide our collaborative document editor:

- **Account Information:** Username (`login`), email address, salted and hashed password (`bcryptjs`), and assigned user role (`user` or `admin`).
- **OAuth 2.0 Identities:** When you sign in or link an account via GitHub or 42, we store the provider name, provider user ID, email verification status, and profile avatar URL.
- **Profile Icon:** Optional avatar image uploaded by you, normalized to a 256×256 WebP image with EXIF metadata stripped, stored in our isolated S3-compatible object storage (`user-icons`).
- **Documents & Collaboration Data:** Document titles, block-structured content, ownership, collaborator share grants (`viewer` or `editor`), and ephemeral real-time block locks.
- **Authentication & Security Records:** Active session tokens (`auth_sessions`) with login/expiry timestamps, hashed one-time verification codes (`one_time_challenges`), OAuth CSRF state tokens (`oauth_state_intents`), and GDPR audit logs (`gdpr_audit_events`).

## 3. How and Why We Process Your Data (Legal Bases)

Under Art. 6(1) of the EU General Data Protection Regulation (GDPR), we process your data on the following bases:

- **Performance of a Contract (Art. 6(1)(b) GDPR):** To register and authenticate your account, deliver 2FA verification codes, store and synchronize your documents in real time, manage collaborator permissions, and process AI elaboration or translation requests initiated by you.
- **Legitimate Interests (Art. 6(1)(f) GDPR):** To secure our infrastructure, enforce rate limits, prevent unauthorized access or abuse, and maintain session integrity.
- **Legal Obligations (Art. 6(1)(c) GDPR):** To fulfill statutory data-subject rights (access, portability, erasure) and maintain an audit trail of GDPR operations.

## 4. What We Do Not Do

- We do **not** sell, rent, or trade your personal data.
- We do **not** use your personal data or document content to train AI models.
- We do **not** use third-party advertising, analytics, or behavioral tracking cookies.

## 5. Cookies and Local Storage

In accordance with EU Directive 2002/58/EC (ePrivacy) and GDPR Art. 6, we use only strictly necessary first-party storage:

- **`token` (HTTP-only, Secure, SameSite=Strict Cookie):** Stores your authenticated JWT session for up to 7 days.
- **`app-theme` (Local Storage):** Remembers your light/dark mode preference.
- **`app-locale` (Local Storage):** Remembers your selected interface and translation language (`en`, `de`, `hu`).
- **`cookie-consent` (Local Storage):** Remembers your acknowledgment of the cookie notice.

## 6. Data Sharing and Processors

Your data is hosted within our containerized stack (PostgreSQL database and RustFS S3 object storage). External processors are used only when explicitly configured and triggered:

- **SMTP Email Provider:** Delivers one-time authentication, password reset, and GDPR confirmation codes.
- **OAuth 2.0 Providers (GitHub, 42):** Used only when you choose to authenticate or link your account with those providers.
- **AI Inference Provider (OpenAI, DeepSeek, or Anthropic):** When you trigger AI block elaboration or language translation, the relevant block text is sent to the configured provider solely to return the generated response.

## 7. Data Retention and Deletion

We retain your personal data for the duration of your active account. When you delete your account via **User Settings → Delete Account** (confirmed by email OTP), your user record, documents, shares, sessions, OAuth links, and uploaded profile icon are permanently purged via database `ON DELETE CASCADE` constraints and S3 object deletion.

## 8. Your Rights Under GDPR (Articles 15–22)

You have the right to:

- **Access & Portability (Art. 15 & 20):** Export a complete machine-readable copy of your personal data in **JSON** or **CSV** format directly from **User Settings → Privacy & GDPR**.
- **Rectification (Art. 16):** Update your username, email address, password, or profile icon at any time in **User Settings**.
- **Erasure / "Right to be Forgotten" (Art. 17):** Permanently delete your account and all associated data from **User Settings**.
- **Restriction, Objection & Complaint (Art. 18, 21, 77):** Contact us at **afelger@student.42heilbronn.de** or lodge a complaint with your national data-protection supervisory authority.


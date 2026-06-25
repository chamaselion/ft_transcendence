# API Documentation

Base URL through the WAF: `https://localhost:9443`

## Authentication APIs

- [auth-register.md](auth-register.md)
- [auth-login.md](auth-login.md)
- [auth-password-reset.md](auth-password-reset.md)
- [auth-profile.md](auth-profile.md)
- [auth-logout.md](auth-logout.md)

## Other API docs

- [gdpr-api.md](gdpr-api.md)
- [portfolio-api.md](portfolio-api.md)
- [market-data-api.md](market-data-api.md)

## Shared notes

- Auth and GDPR endpoints live under `/api/auth`.
- Portfolio endpoints live under `/api/portfolio`.
- Market-data endpoints live under `/api/symbols`, `/api/assets`, and `/ws`.
- Auth uses an httpOnly JWT cookie plus an active server-side session.
- Login, password reset, profile update, and data deletion use challenge/confirm flows.
- Sensitive auth endpoints are rate-limited.
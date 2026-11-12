# Authentication and rate limits

Supabase Auth identifies customers. PostgreSQL stores profiles, businesses, and memberships, never passwords or tokens.

```text
POST /auth/login → IP bucket → validate body → account bucket → Supabase → access_token
Private route → IP bucket → verify Supabase token → user bucket → authorized operation
/health → IP bucket → service checks
```

## Implemented
- Public POST /auth/login accepts email, password, and optional captchaToken; returns access token and expiration.
- POST /auth/web/signup requires the web server secret, a valid email, an 8–1024 character password, and optional CAPTCHA. It uses Supabase signup and an independent account bucket, returns only signup_requested, and never authenticates the browser. Confirm email if required, then sign in. Allow WEB_ORIGIN/login in Supabase redirect settings.
- SDK clients are operation-scoped. Renewal and logout use time-limited HTTP requests.
- Account limits use normalized email addresses. Password characters remain unchanged.
- Routes are private by default. GET /identity/me synchronizes the local profile.
- POST /businesses creates a business and its owner membership. Business queries are restricted to the current user's memberships.
- Atomic Redis buckets expire and refill: IP 120, user 60, login account 5 per 60-second window; initial burst equals capacity. Limits are configurable.
- Exceeded limits return 429 and Retry-After, without permanent account locks. Incorrect credentials and nonexistent accounts receive the same message.
- Missing configuration/provider outages return 503. Login responses use Cache-Control: no-store.
- Forwarded headers are ignored unless the connection comes through configured trusted proxies.

The web server exchanges credentials with the API and keeps access and refresh tokens in HttpOnly cookies. Browser mutations require a matching origin. Sign-out clears browser cookies and requests revocation of the current provider session.

## Configuration
Set WEB_AUTH_SECRET (32+ random characters) on both servers; API_INTERNAL_URL and WEB_ORIGIN on Next. Production cookies require HTTPS. Locally, use root .env for Nest and apps/web/.env.local for Next; restart after changes.
SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must belong to the same project. Do not use service_role or secret keys.

HTTP_HOST defaults to 127.0.0.1. Container ingress can require 0.0.0.0 or ::; restrict API access to the ingress network. TRUSTED_PROXIES defaults to empty and accepts comma-separated proxy IPs/CIDRs, such as 10.20.0.5/32. Express selects the nearest untrusted address. The ingress must sanitize forwarded headers; prevent direct public access to the API. Verify the actual proxy chain, TLS termination, health checks, and distinct client IP limits before release. Hosting topology remains undecided.

Browser requests through Next share its upstream IP bucket. Account and user limits remain independent. Local limits do not cover direct Supabase requests. Configure authentication policies, CAPTCHA, and MFA there as well. When CAPTCHA is enabled, the caller must supply a valid captchaToken; the backend does not bypass it.

## Pending
Google sign-in and MFA requirements for sensitive actions. Password recovery uses the existing server-only proxy.

Billing and changes to phone numbers or permissions remain unavailable until their controls are defined.

Tests use a simulated provider with PostgreSQL and Redis; Swagger supports manual testing.

References: [login](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [user verification](https://supabase.com/docs/reference/javascript/auth-getuser), [rate limits](https://supabase.com/docs/guides/auth/rate-limits).

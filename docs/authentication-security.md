# Authentication and rate limits

Supabase Auth identifies SaaS customers. Local PostgreSQL stores profiles, businesses, and memberships. Our tables do not store passwords or tokens.

```text
POST /auth/login → IP bucket → validate body → account bucket → Supabase → access_token
Private route → IP bucket → verify Supabase token → user bucket → authorized operation
/health → IP bucket → service checks
```

## Implemented
- POST /auth/login accepts email, password, and an optional captchaToken. It returns an access token and expiration without requiring an existing token.
- The official SDK performs authentication. Each operation uses a client without session persistence or automatic refresh; sessions are not shared between users.
- Account limits use normalized email addresses. Password characters remain unchanged.
- Routes are private by default. GET /identity/me synchronizes the local profile.
- POST /businesses creates a business and its owner membership. Business queries are restricted to the current user's memberships.
- Atomic Redis buckets expire and refill: IP 120, user 60, and login account 5 per 60-second window. These configurable starting values allow an initial burst equal to capacity.
- Exceeded limits return 429 and Retry-After, without permanent account locks. Incorrect credentials and nonexistent accounts receive the same message.
- Missing authentication configuration or an unavailable provider returns 503. Login responses use Cache-Control: no-store.
- X-Forwarded-For is not trusted. Proxy configuration will be defined with hosting.

## Configuration
SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must belong to the same project. Do not use service_role or secret keys.

Local limits do not cover direct Supabase requests. Configure authentication policies, CAPTCHA, and MFA there as well. When CAPTCHA is enabled, the caller must supply a valid captchaToken; the backend does not bypass it.

## Pending
Frontend login and recovery, Google sign-in, API session refresh/sign-out, and MFA requirements for sensitive actions. A password-login token alone does not certify a second factor.

Hosting must provide additional DDoS protection. Billing and changes to phone numbers or permissions remain unavailable until their controls are defined.

Swagger supports manual testing. Automated tests use a simulated provider with real PostgreSQL and Redis.

References: [login](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [user verification](https://supabase.com/docs/reference/javascript/auth-getuser), [rate limits](https://supabase.com/docs/guides/auth/rate-limits).

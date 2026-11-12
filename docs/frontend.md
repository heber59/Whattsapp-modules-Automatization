# Frontend architecture

Next.js App Router and TypeScript. The current playground uses SVG; React Flow remains planned.

## Portal

The shared header provides English/Spanish labels and light/dark themes. Preferences persist locally. The landing page serves businesses worldwide, with separate paths to plans and personal consultation.

Visitors can leave an email or international phone number and explicit contact consent without an account. The footer credits Heber Santiago Alvarez Rincon and links to his contact form. No owner contact address is invented.

Plan choices come from the backend. Buy plan opens the account and purchase-details flow. Signed-in customers can save their details for later payment. The single full-access plan costs COP 50,000/month and includes personal assistance. Checkout remains unavailable; the interface never treats a request as payment. WhatsApp replies require separately configured Meta credentials and webhook setup. The sign-in dialog preserves the selected plan. Customers creating an account are guided to return to Plans.

/signup registers through a same-origin server proxy. Customers complete any provider email confirmation and sign in through the existing dialog or /login. /api/session verifies the profile. Provider tokens remain in HttpOnly cookies and are never exposed to browser code.

/flows requires a verified session. Select a business and create, load, name, or save its server drafts. Optimistic revisions reject conflicting saves without overwriting local edits. Owners/admins can publish a validated immutable version; operators can view and preview. Publication alone does not enable WhatsApp execution. Save status compares the exact submitted snapshot, preserving edits made during requests. Business/flow switches, page links, and tab closing warn about unsaved changes and have separate per-user/business/flow device recovery copies when storage works. Original browser drafts remain untouched and require explicit import. Graph validation and customer preview remain available; switching language does not change user content.

/whatsapp and each business detail expose channel readiness and published-flow assignment. Owners/admins assign the server-configured pilot phone; operators view only. The interface never collects credentials. A registered assignment does not claim Meta connectivity or delivery. Missing setup shows steps for creating the Meta app, configuring the server and public webhook, publishing a flow, and testing a conversation.

## Organization

```text
apps/web/src/
├── app/                       # Routes, layouts, and composition
│   ├── api/                   # Same-origin server proxies
│   ├── flows/                 # Current editor playground
│   ├── signup/                # Account creation
│   └── portal.tsx             # Shared session, preferences, sign-in
├── features/
│   └── commercial/            # Contact and plan-request UI
├── server/                    # Server-only API/session helpers
└── shared/                    # Reusable components and utilities
```

## Implementation rules

- Keep pages small; delegate behavior to focused features.
- Dependency direction is app → features → shared; avoid cycles.
- Default to server components. Use client components for interaction and keep secrets server-only.
- Separate interface state from remote state.
- Validate external input, sessions, and business access on the server.
- Keep focused unit tests next to relevant code and critical journeys in apps/web/e2e/.

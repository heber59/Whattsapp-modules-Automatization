# First WhatsApp pilot setup

Start with Meta's test number before configuring a customer's production number. An application, credentials, a reachable callback, and a real-device test are external prerequisites; the application cannot create these automatically.

1. Follow [Meta's Cloud API setup](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started). Create the application with WhatsApp enabled and obtain the test phone-number ID and an access token. Follow Meta's recipient verification instructions for your own test phone.
2. In this portal, create the pilot business, build its menu, save, and publish a version. Record the business UUID.
3. Configure the API and worker environment privately: `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`, `META_BUSINESS_ID`, and `META_GRAPH_VERSION`. The business ID must match the pilot business. Choose a supported Graph API version from Meta's configuration. Generate your own unpredictable verification token. Never paste these secrets into chat, frontend fields, Git, or screenshots.
4. Run migrations and restart API and worker. Open WhatsApp setup in the portal, choose the business, select a published flow version, and save its routing configuration. This does not verify Meta connectivity.
5. Provide an HTTPS callback that reaches the API's `/webhooks/whatsapp` endpoint and preserves the exact request body and signature header. Configure that callback and the matching verification token in Meta; subscribe the WhatsApp account/application to incoming message events using Meta's instructions. A development tunnel is temporary infrastructure, not production hosting.
6. From your approved test phone, send a greeting to the test number. Confirm the menu arrives, choose an option, try an invalid option, and complete the conversation. Confirm the next greeting starts a new conversation. Keep API and worker running.

Record the candidate version and results. An accepted webhook or saved channel alone is not evidence that a real WhatsApp reply reached the phone. Test safe restart/recovery before onboarding the paying customer.

Use server-side credentials with the appropriate permissions and lifetime before production. Test credentials can expire. The first pilot supports customer-initiated text menus; media handling, templates, billing, and full operator inbox are separate work.

Technical behavior and recovery: [WhatsApp integration](whatsapp.md). Request format: [Meta's official message collection](https://www.postman.com/meta/whatsapp-business-platform/request/8gvd47s/send-text-message).

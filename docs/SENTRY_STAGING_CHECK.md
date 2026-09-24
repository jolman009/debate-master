# Phase 0: deploy and verify Sentry

The staging test page previously returned 404 because the Sentry scaffolding was absent from the staging branch. This change packages the example page, API route, browser/server/edge initialization and Next.js configuration for Preview deployment. The earlier hydration error at `localhost:3000/sentry-example-page` proves local capture only. Deployed capture and alert acknowledgment remain to be checked.

## Include the setup in the staging deployment

Using your usual GitHub workflow, add the following existing local files to the `staging` branch, preserving their paths:

- `src/app/sentry-example-page/page.tsx`
- `src/app/api/sentry-example-api/route.ts`
- `src/instrumentation.ts`
- `src/instrumentation-client.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

Include the Sentry setup changes in `next.config.mjs` and `src/app/global-error.tsx`. Ensure the deployed package manifest and lockfile contain the installed Sentry dependency used by this setup. Do not upload `.env` files, `.env.sentry-build-plugin`, auth tokens or service-role keys. Do not commit unrelated workspace changes as part of this deployment.

Wait for Vercel's Preview deployment with source branch `staging` to become Ready. A redeploy of a commit without these files cannot add the route. No new Supabase migration is required.

## Check capture

1. Visit https://debate-master-git-staging-joel-guzmans-projects-f8aa100e.vercel.app/sentry-example-page and authenticate to Vercel if prompted.
2. Click **Throw Sample Error** once. The test deliberately calls a failing API and throws a browser error. An HTTP 500 from the example API is expected.
3. Open https://literatipro.sentry.io/issues/?project=4512113059102720 with all environments selected and a recent time range.
4. Look for a new occurrence of `SentryExampleAPIError` and `SentryExampleFrontendError`. Record their event IDs, timestamps, release and staging request/page URLs. The page's “Error sent” message alone does not prove Sentry received anything.
5. If only one arrives, keep the corresponding browser/server capture check open. If the page still returns 404, check the deployment's source commit includes the files above.

After capture works, verify an alert rule and its intended recipient, then test notification delivery and human acknowledgment. Staging capture alone does not close production monitoring evidence. Stripe payment evidence remains deferred.

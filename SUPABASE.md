# Supabase foundation

Project: `walmhfauqpxuysqwmtwd` (`lottovip-simulator`)

## Apply locally

The canonical schema is in `supabase/migrations/20260729090000_phase_1_foundation.sql`.

The browser uses only the public project URL and publishable key in `config.js`.
Never add a secret key, service-role key, database password, or access token to this repository.

## Auth URL configuration

Set the production Site URL and allowed redirect URL to:

`https://aodxx.github.io/LOTTOVIP/`

## Phase 1 scope

- Email/password authentication
- Automatic profile and simulation wallet creation
- Owner-only profile and wallet reads through RLS
- Authenticated read access to round catalog
- Root GitHub Pages login

Entry submission, ledger mutation, settlement, and administrative permissions are deferred to later server-side transaction phases.

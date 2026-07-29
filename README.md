# LOTTOVIP

LOTTOVIP is a mobile-first member platform currently under phased development.

## Project status

- Phase 0: UX/UI prototype
- Phase 1: Supabase Auth, profile and database foundation
- Phase 2: Core member dashboard, standard wallet, roles and wallet history
- Phase 3: Round-driven draft entry builder
- Primary documents: PRD v2.1 and UX/UI Blueprint

## Phase 3 boundary

- Rules are configured per round in `round_rules`.
- Members can create, edit and delete only their own draft entries.
- Draft totals are maintained by a database trigger.
- Phase 3 does not submit entries or mutate wallet balances.
- Submission and wallet debit require a later server-side transaction.

## Current architecture

- One Supabase Auth system for all members
- Roles: `member`, `agent`, `admin`
- Member-owned data protected by Row Level Security
- GitHub Pages frontend connected with a publishable Supabase key
- Schema changes tracked in `supabase/migrations/`

## Development workflow

- `main`: stable project baseline
- `agent/*`: development branches
- Changes are reviewed through Draft Pull Requests before merging

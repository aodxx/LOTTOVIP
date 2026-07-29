# LOTTOVIP

LOTTOVIP is a mobile-first member platform currently under phased development.

## Project status

- Phase 0: UX/UI prototype
- Phase 1: Supabase Auth, profile and database foundation
- Phase 2: Core member dashboard, standard wallet, roles and wallet history
- Primary documents: PRD v2.1 and UX/UI Blueprint

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

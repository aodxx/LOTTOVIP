# LOTTOVIP Simulator

เว็บแอปจำลองการเลือกตัวเลขสำหรับศึกษา UI, ฐานข้อมูล, RLS และธุรกรรมแบบอะตอมมิก
ระบบใช้เครดิตทดลองที่ไม่มีมูลค่า ไม่รองรับการฝาก ถอน หรือแลกเงินจริง

## สถานะล่าสุด

- Phase 1: บัญชีสมาชิกและโครงสร้างพื้นฐาน
- Phase 2: Dashboard และเครดิตทดลอง
- Phase 3: สร้างโพยแบบร่าง
- Phase 4: ศูนย์รวมหมวดหวยจำลอง, ยืนยันโพย, ตัดเครดิตแบบ Transaction, ประวัติโพย\n- Phase 5: ผลรางวัลจำลอง, ตรวจผู้ชนะ, จ่ายเครดิตแบบ idempotent และผลย้อนหลัง

## ตรวจสอบโค้ด

```bash
node --check auth-page.js
node --check entry-builder.js
node tests/phase4-static.mjs\nnode tests/phase5-static.mjs
```

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

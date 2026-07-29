# PRD: Lottery Operations Simulator v2.1

สถานะ: Baseline for implementation  
ภาษา UI: ไทย  
Timezone: Asia/Bangkok  
หน่วยมูลค่า: Simulation Credit  
เอกสาร UX: `LOTTOVIP-UX-UI-BLUEPRINT.md`

## 1. Product Definition

ระบบจำลองวงจรธุรกรรมตัวเลขเพื่อเรียนรู้ Full-Stack, Database, Security, Ledger, Workflow และ Payment Integration ผ่าน Sandbox ระบบไม่มีการรับเดิมพันเงินจริง เครดิตไม่มีมูลค่าเงินสดและแลกคืนไม่ได้

ระบบประกอบด้วย:

1. Customer Simulator
2. Operator Portal
3. Admin and Audit Portal
4. Payment Integration Lab (Sandbox)

## 2. Scope Decision

### In scope

- Authentication, MFA และ RBAC
- Simulation Wallet และ append-only Ledger
- Round lifecycle และ Round Template สำหรับรอบความถี่สูง
- Rule versioning และ rule snapshot
- Entry cart, confirmation, receipt และ history
- Mock Result, dual approval, Settlement และ Reconciliation
- Audit log, risk event และ incident workflow
- PromptPay-like QR UX, deposit intent, webhook, withdrawal และ payout ผ่าน Mock/Sandbox Provider
- Responsive Customer UI และ Admin UI

### Out of scope

- เงินจริง
- Production payment credential
- การรับฝาก/ถอนที่แลกเป็นเงินจริง
- การคัดลอก Brand, Asset หรือ Source Code ของเว็บไซต์อ้างอิง

## 3. Personas

- Customer/Learner
- Operator
- Agent Supervisor
- Round Manager
- Result Officer
- Result Approver
- Settlement Officer
- Support Officer
- Auditor
- Administrator
- Security Administrator

ใช้ separation of duties: ผู้สร้างห้ามอนุมัติรายการสำคัญของตนเอง

## 4. MVP

### Customer

- Register/Login/Recovery
- Dashboard
- Round Catalog
- Round Detail
- Number Entry แบบ manual และ number grid
- Cart, Confirm, Receipt
- History, Results, Wallet

### Admin

- Dashboard
- Round and Rule Manager
- Mock Result Draft/Approval
- Settlement
- Reconciliation
- Audit Explorer

### Platform

- Supabase Auth
- PostgreSQL + RLS
- Edge Functions/API
- Idempotency
- Server-time cutoff
- Append-only Ledger
- Automated tests

Payment Lab, Support และ Advanced Risk เป็น Phase 2

## 5. Round Model

สถานะ:

`draft → pending_approval → scheduled → open → closing → closed → result_pending → result_published → settling → reconciled → finalized`

ข้อมูลหลัก:

- `round_code`
- `round_group`
- `sequence_no`
- `title`
- `open_at`
- `close_at`
- `draw_at`
- `settlement_at`
- `rule_set_version_id`
- `timezone`
- `status`

Round Template ต้องสร้างรอบซ้ำ เช่น ทุก 15 นาที โดยแต่ละรอบเป็น row แยกและมี unique code

## 6. Rule Model

Rule Set ต้อง versioned และ immutable หลัง publish:

- entry type
- digit length
- valid pattern
- min/max credit per item
- max credit per number
- simulation multiplier
- enabled/disabled
- display order
- restriction label

Entry ต้องเก็บ Snapshot ของ Rule Version และ multiplier ที่ใช้ตอนยืนยัน

## 7. Entry Workflow

1. Customer เลือก Round ที่เปิด
2. เลือก manual input หรือ number grid
3. เลือก Entry Type
4. กรอก/เลือกเลขและราคา
5. Client ตรวจรูปแบบเบื้องต้น
6. Server โหลด Round และ Rule Version ปัจจุบัน
7. Server lock wallet row
8. ตรวจ cutoff จาก database time
9. ตรวจเครดิตและข้อจำกัด
10. สร้าง Entry + Items + Receipt
11. สร้าง Ledger `ENTRY_DEBIT`
12. Commit ใน transaction เดียว
13. Request ซ้ำด้วย idempotency key เดิมต้องคืน Receipt เดิม

สถานะ Entry:

`draft`, `confirmed`, `cancel_pending`, `cancelled`, `result_pending`, `settled`, `voided`

## 8. Result and Settlement

### Result

1. Result Officer สร้าง Draft
2. ระบบ Validate ตาม Round Type
3. Result Approver คนละบัญชีตรวจและอนุมัติ
4. Publish Result Version
5. ห้ามแก้ทับ; การแก้ใช้ Result Correction Version

### Settlement

1. สร้าง Settlement Batch
2. Lock Round
3. เลือก confirmed entry items
4. ประเมินผลด้วย Rule Snapshot
5. สร้าง Settlement Item
6. สร้าง `SETTLEMENT_CREDIT` เมื่อเข้าเงื่อนไข
7. Retry ได้โดยไม่เพิ่มซ้ำ
8. Reconcile Ledger, Wallet cache และ Settlement totals
9. Finalize เมื่อ mismatch เป็นศูนย์

## 9. Wallet and Ledger

Ledger เป็นหลักฐานจริง ส่วน `simulation_wallets.balance` เป็น cache

ประเภท:

- `OPENING_CREDIT`
- `ENTRY_DEBIT`
- `ENTRY_REVERSAL`
- `SETTLEMENT_CREDIT`
- `CORRECTION_DEBIT`
- `CORRECTION_CREDIT`
- `SIMULATION_TOPUP`
- `SIMULATION_RESET`

ทุก row ต้องมี owner, direction, amount, before/after, reference, idempotency key, actor, timestamp และ integrity hash

## 10. Payment Integration Lab

Payment Lab แยกจาก Lottery Simulator:

1. สร้าง Mock Deposit Intent
2. แสดง QR ใน Sandbox
3. รับ signed webhook
4. ตรวจ signature, amount, reference และ replay
5. เมื่อ success ให้ออก Simulation Credit หนึ่งครั้ง
6. Withdrawal Request ใช้ approval workflow
7. Mock payout มี `pending → processing → completed/failed`
8. Refund/Reversal สร้างรายการใหม่ ไม่แก้ทับ
9. Reconciliation เปรียบเทียบ Provider events กับ Internal Ledger

ทุกหน้าต้องติดป้าย `Sandbox / Simulation`

## 11. Core Database

### Identity

`profiles`, `roles`, `permissions`, `user_roles`, `user_sessions`, `security_events`

### Credit

`simulation_wallets`, `credit_ledger`, `mock_payment_intents`, `mock_payment_events`, `mock_withdrawal_requests`

### Rounds and rules

`round_templates`, `rounds`, `round_approvals`, `round_snapshots`, `rule_sets`, `rule_set_versions`, `rule_items`

### Entries

`entries`, `entry_items`, `entry_receipts`, `entry_status_history`, `cancellation_requests`

### Results

`result_versions`, `result_approvals`, `result_corrections`

### Settlement and control

`settlement_batches`, `settlement_items`, `reconciliation_runs`, `reconciliation_issues`, `audit_logs`, `risk_events`, `job_runs`, `dead_letter_jobs`

## 12. Critical Constraints

- unique normalized email
- unique wallet per user
- unique round code
- unique `(user_id, idempotency_key)` for entry writes
- unique settlement item per `(entry_item_id, result_version_id)`
- unique ledger reference by allowed type
- amount greater than zero
- no hard delete for transaction records
- RLS blocks cross-user reads
- published rules and results are immutable

## 13. API Baseline

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/recovery`

### Customer

- `GET /api/v1/me`
- `GET /api/v1/me/wallet`
- `GET /api/v1/rounds/open`
- `GET /api/v1/rounds/:id`
- `POST /api/v1/entries/validate`
- `POST /api/v1/entries`
- `GET /api/v1/entries`
- `GET /api/v1/entries/:reference`
- `POST /api/v1/entries/:reference/cancel`
- `GET /api/v1/results`

### Payment Lab

- `POST /api/v1/lab/deposits`
- `POST /api/v1/lab/webhooks/:provider`
- `POST /api/v1/lab/withdrawals`
- `GET /api/v1/lab/transactions`

### Admin

- round, rule, result, settlement, reconciliation, audit, user และ risk endpoints

ทุก write endpoint ต้องมี request ID; ธุรกรรมสำคัญต้องมี idempotency key

## 14. Error Contract

```json
{
  "success": false,
  "error": {
    "code": "ROUND_CLOSED",
    "message": "งวดนี้ปิดรับรายการแล้ว",
    "details": {},
    "requestId": "req_xxx"
  },
  "timestamp": "2026-07-29T07:00:00.000Z"
}
```

Error สำคัญ: `AUTH_REQUIRED`, `MFA_REQUIRED`, `ROUND_NOT_OPEN`, `ROUND_CLOSED`, `INSUFFICIENT_SIMULATION_CREDIT`, `INVALID_ENTRY_FORMAT`, `DUPLICATE_REQUEST`, `RULE_VERSION_MISMATCH`, `APPROVAL_CONFLICT`, `RECONCILIATION_REQUIRED`, `RATE_LIMITED`

## 15. Security

- HTTPS
- short-lived JWT และ refresh rotation
- MFA สำหรับ privileged roles
- RLS ทุกตารางที่มีข้อมูลส่วนบุคคลหรือธุรกรรม
- service key อยู่ server only
- rate limit และ abuse detection
- CSP และ output encoding
- append-only audit chain
- secrets แยกตาม environment
- backup และ recovery test

## 16. Testing

### Required automated scenarios

1. Request เดิม 5 ครั้งสร้าง Entry เดียว
2. Customer A อ่านข้อมูล Customer B ไม่ได้
3. Submit หลัง cutoff ถูกปฏิเสธ
4. เครดิตพอดีและยิงพร้อมกันไม่ติดลบ
5. Result creator อนุมัติผลตนเองไม่ได้
6. Settlement retry ไม่ credit ซ้ำ
7. Ledger sum ตรง wallet cache
8. Webhook ซ้ำไม่ออกเครดิตเพิ่ม
9. Correction สร้าง before/after และ audit event
10. Round Template ไม่สร้าง round code ซ้ำ

## 17. Implementation Plan

### Phase 0 - Product baseline

- ปิดชื่อ Brand
- Design tokens
- clickable mobile prototype
- threat model และ ERD

### Phase 1 - Foundation

- project scaffold
- Auth/Profile/Roles
- RLS
- Wallet/Ledger
- CI tests

### Phase 2 - Rounds and rules

- Round Template
- lifecycle/scheduler
- Rule versioning
- approval

### Phase 3 - Customer entry

- catalog
- number input/grid
- cart
- confirm/receipt/history
- concurrency and cutoff tests

### Phase 4 - Results and settlement

- Mock Result
- dual approval
- settlement batch
- reconciliation

### Phase 5 - Operator and admin

- delegated customer lookup
- operator entry
- cancellation/correction
- audit and risk dashboards

### Phase 6 - Payment Lab

- deposit intent
- QR sandbox
- webhook
- withdrawal/payout mock
- reconciliation

### Phase 7 - Hardening and demo

- security tests
- accessibility
- performance
- backup/recovery
- demo dataset
- deployment to `learning-demo`

## 18. Definition of Done

- Customer flow Login → Receipt ทำงานจริง
- Admin flow Round → Result → Settlement → Reconcile ทำงานจริง
- Critical tests ผ่าน
- RLS test ผ่าน
- no ledger mismatch
- no duplicate confirmed entry
- UX ผ่าน mobile width 360px
- ระบบแสดง Simulation/Sandbox อย่างชัดเจน
- ไม่มี production payment integration

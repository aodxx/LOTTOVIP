# Phase 0 — Mobile UI Prototype

ต้นแบบคลิกได้ 5 หน้าหลักสำหรับ NumberLab VIP:

1. Login
2. Dashboard
3. Round Catalog
4. Number Entry
5. Receipt

## Run locally

เปิด `index.html` โดยตรง หรือใช้ static server:

```bash
npx serve phase0
```

Prototype ใช้ข้อมูลและเครดิตจำลองทั้งหมด ไม่มี Backend, เงินจริง หรือ Production payment credential

## Acceptance coverage

- Mobile-first ที่ความกว้าง 360px
- Touch target สำคัญอย่างน้อย 44px
- Manual keypad และ number grid
- Countdown จำลอง
- Selection cart และ receipt flow
- Reduced-motion support
- สถานะ Simulation/Sandbox แสดงชัดเจน

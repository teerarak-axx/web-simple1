# เงาไม้ การ์เด้น

เว็บตัวอย่างของบริษัทสมมุติ ใช้ Node.js 24 กับ SQLite

```bash
npm install
npm run admin
npm run seed
npm start
```

- เว็บ: http://127.0.0.1:8090
- แอดมิน: http://127.0.0.1:8090/admin
- `npm run admin` สร้างหรือรีเซ็ตรหัสผ่านจาก `ADMIN_EMAIL` และ `ADMIN_PASSWORD` ใน `.env`
- `npm test` รันชุดทดสอบ
- ถ้าเพิ่มหรือเปลี่ยนตำแหน่งรูปในหน้าเว็บ ต้องแก้ทั้ง `src/site.mjs` และ `seed/seed.mjs`

ข้อมูลทั้งหมดอยู่ในโฟลเดอร์ `data/`: ฐานข้อมูล `site.db`, รูป `uploads/` และสำรองรายวัน `backups/`

ขึ้นเว็บจริง: ตั้ง `SITE_URL` เป็น `https://...`, ใช้ reverse proxy ที่เปิด HTTPS, เก็บ `data/` บนดิสก์ถาวร และตั้ง `SITE_INDEXABLE=1` เฉพาะเมื่อเป็นบริษัทจริง

ไอคอนแบรนด์ใน `src/icons` มาจาก simple-icons (CC0) และไอคอนหน้าแอดมินจาก lucide (ไฟล์ขึ้นต้น `lu-`, สัญญาอนุญาต ISC)

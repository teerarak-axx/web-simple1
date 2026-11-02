// Creates or resets the admin login from ADMIN_EMAIL and ADMIN_PASSWORD in .env: npm run admin
import { hashPassword, setAdminPassword } from '../src/auth.mjs'

const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env
if (!email || !password || password.length < 12) {
  console.error('ตั้ง ADMIN_EMAIL และ ADMIN_PASSWORD (อย่างน้อย 12 ตัวอักษร) ในไฟล์ .env')
  process.exit(1)
}
setAdminPassword(email, await hashPassword(password))
console.log(`saved admin ${email}`)

# ติวสอบ ป.3 — P.3 Exam Prep (Android APK)

แอปติวสอบ ป.3 (ไทย/EN) ห่อด้วย Capacitor เป็นแอป Android ทำงานออฟไลน์ 100%
เก็บความก้าวหน้า (ดาว/ข้อที่ทำ/ข้อที่ผิด/สถิติ) ถาวรในเครื่อง

## ฟีเจอร์ (v3.0 — ครอบคลุมทั้งเทอม 1)
- ข้อสอบปรนัย 394 ข้อ + เติมคำ 158 ข้อ + จับคู่ 106 คู่ (ระบบไม่ซ้ำ)
- โหมดอ่านเนื้อหา 10 วิชา ครอบคลุมทั้งเทอม 1 (สอบครั้งที่ 1 + ครึ่งหลัง) + กล่องเทคนิคจำ
- 📊 รายงานผลรายวิชา (สำหรับพ่อแม่) — ความแม่น % + วิชาที่ควรทบทวน
- 🔊 เสียงอ่าน (ไทย/อังกฤษ) ในการ์ด บทเรียน และข้อสอบ
- 🌙 โหมดกลางคืน
- เกมจับเวลา ข้อสอบเสมือน ทบทวนข้อผิด สำรอง/กู้คืนดาว

## โครงสร้าง
- `src/P3ReviewApp.jsx` — โค้ดแอปทั้งหมด (React)
- `src/main.jsx` — จุดเริ่ม + storage shim (IndexedDB + localStorage)
- `www/index.html` — หน้าเว็บที่โหลด `app.js` (bundle)
- `capacitor.config.json` — ตั้งค่าแอป (ชื่อ/appId)
- `.github/workflows/build-apk.yml` — บิลด์ .apk อัตโนมัติบน GitHub

## วิธีได้ไฟล์ .apk แบบไม่ต้องลงเครื่องมืออะไรเลย (แนะนำ)
1. สร้าง repo ใหม่บน GitHub แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (ยกเว้น node_modules/android)
2. ไปที่แท็บ **Actions** ของ repo → เปิดใช้งาน workflow
3. กด **Run workflow** (หรือ push เข้า main จะรันเอง)
4. รอสัก 3–5 นาที → เปิด run ที่เสร็จแล้ว → ดาวน์โหลด artifact **P3ReviewApp-debug-apk**
5. แตกไฟล์ zip จะได้ `app-debug.apk` → ส่งเข้ามือถือแล้วกดติดตั้ง
   (ต้องเปิด "อนุญาตติดตั้งจากแหล่งที่ไม่รู้จัก" สำหรับแอปที่ใช้เปิดไฟล์)

## วิธีบิลด์เองบนเครื่อง (ถ้ามี Android SDK + JDK 17 + Node)
```bash
npm install
npm run build:web       # bundle React -> www/app.js
npx cap add android     # ครั้งแรกครั้งเดียว
npx cap sync android
cd android && ./gradlew assembleDebug
# ได้ไฟล์ที่ android/app/build/outputs/apk/debug/app-debug.apk
```

## แก้เนื้อหา/เพิ่มข้อสอบ
แก้ที่ `src/P3ReviewApp.jsx` (ส่วน SUBJECTS / MORE / LESSONS / LESSONS_MORE)
แล้วรัน `npm run build:web` ใหม่ หรือ push ให้ GitHub บิลด์ให้

## เปลี่ยนไอคอน/ชื่อแอป
- ชื่อ + appId: แก้ `capacitor.config.json`
- ไอคอนแอป: หลัง `npx cap add android` วางไอคอนใน `android/app/src/main/res/mipmap-*`
  หรือใช้ `@capacitor/assets` สร้างจากรูปเดียว

## ขึ้น Play Store (ถ้าต้องการภายหลัง)
ต้องเปลี่ยนจาก assembleDebug เป็น bundleRelease (สร้าง .aab) + เซ็น keystore
และมีบัญชี Google Play Developer (ค่าสมัคร 25 USD ครั้งเดียว) — บอกได้ถ้าจะทำ

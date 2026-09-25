# เอกสารทดสอบระบบงาน UAT - BlinkCare

## TESTCASE SUMMARY

| No | Module Name | Test Scenario ID | Test Scenario Description |
|---:|---|---|---|
| 1 | Authentication (Website) | TS_AC_001 | ทดสอบการเข้าสู่ระบบ |
| 2 | OTP Verification (Website) | TS_AC_002 | ทดสอบการยืนยันตัวตนด้วย OTP |
| 3 | OTP Verification (Website) | TS_AC_003 | ทดสอบการขอส่ง OTP ใหม่ |
| 4 | Registration (Website) | TS_AC_004 | ทดสอบการลงทะเบียน |
| 5 | Authentication (Website) | TS_AC_005 | ทดสอบการออกจากระบบ |
| 6 | Authentication (Website) | TS_AC_006 | ทดสอบการต่ออายุ Access Token ด้วย Refresh Token |
| 7 | Access Control | TS_AES_001 | ทดสอบผู้ใช้ที่ยังไม่เข้าสู่ระบบเข้าหน้าสำหรับสมาชิก |
| 8 | Profile | TS_PF_001 | ทดสอบการแสดง Username ของผู้ใช้ที่เข้าสู่ระบบ |
| 9 | Profile | TS_PF_002 | ทดสอบการแก้ไขข้อมูลโปรไฟล์ |
| 10 | Blink Detection | TS_DET_001 | ทดสอบการอนุญาตและเปิดใช้งานกล้อง |
| 11 | Blink Detection | TS_DET_002 | ทดสอบการเริ่มตรวจจับการกะพริบตา |
| 12 | Blink Detection | TS_DET_003 | ทดสอบการตรวจจับและนับจำนวนการกะพริบตา |
| 13 | Blink Detection | TS_DET_004 | ทดสอบการแสดง Blink Rate แบบ Real-time |
| 14 | Face Detection | TS_DET_005 | ทดสอบการหยุดนับเวลาเมื่อไม่พบใบหน้า |
| 15 | Face Detection | TS_DET_006 | ทดสอบการนับเวลาต่อเมื่อกลับมาพบใบหน้า |
| 16 | Light Detection | TS_DET_007 | ทดสอบการตรวจพบแสงไม่เพียงพอ |
| 17 | Detection Session (Website) | TS_DET_008 | ทดสอบการหยุดชั่วคราวและดำเนินการตรวจจับต่อ |
| 18 | Detection Session (Website) | TS_DET_009 | ทดสอบการสิ้นสุด Detection Session |
| 19 | Detection Session (Website) | TS_DET_010 | ทดสอบการบันทึกจำนวนกะพริบและเวลาตรวจจับ |
| 20 | Detection Session (Website) | TS_DET_011 | ทดสอบการป้องกันการเริ่ม Session ซ้อนกัน |
| 21 | Detection Session (Website) | TS_DET_012 | ทดสอบการแสดง Error เมื่อเข้าถึงกล้องไม่ได้ |
| 22 | Blink Helper | TS_HLP_001 | ทดสอบสถานะเมื่อไม่พบ Blink Helper |
| 23 | Blink Helper | TS_HLP_002 | ทดสอบการเชื่อมต่อ Blink Helper สำเร็จ |
| 24 | Application Usage | TS_HLP_003 | ทดสอบการตรวจหา Application ที่กำลังใช้งาน |
| 25 | Application Usage | TS_HLP_004 | ทดสอบการเปลี่ยน Application ระหว่าง Session |
| 26 | Browser Extension | TS_EXT_001 | ทดสอบการทำงานของ Browser Extension |
| 27 | Notification | TS_NTI_001 | ทดสอบการแจ้งเตือน |
| 28 | Improvement Plan | TS_PLN_001 | ทดสอบการแสดงแผนดูแลสุขภาพตา |
| 29 | Dashboard | TS_DSH_001 | ทดสอบการแสดงข้อมูลสรุปบน Dashboard |
| 30 | History | TS_HIS_001 | ทดสอบดู Timeline เหตุการณ์ย้อนหลัง |

## TEST CASE DETAIL

### TS_AC_001 - ทดสอบการเข้าสู่ระบบ

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้มีบัญชีในระบบและเปิดหน้า BlinkCare Website |
| Test Data | Email/Password ที่ถูกต้อง และ Email/Password ที่ไม่ถูกต้อง |
| Test Steps | 1. เข้าหน้า Sign in<br>2. กรอก Email และ Password<br>3. กดปุ่ม Login<br>4. ตรวจสอบผลลัพธ์หลัง Login |
| Expected Result | กรณีข้อมูลถูกต้อง ระบบเข้าสู่ขั้นตอน OTP หรือเข้าสู่ระบบสำเร็จและกลับไปหน้าที่ต้องการ กรณีข้อมูลไม่ถูกต้อง ระบบแสดงข้อความ Error และไม่สร้าง session |
| Actual Result |  |
| Status |  |

### TS_AC_002 - ทดสอบการยืนยันตัวตนด้วย OTP

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้ Login สำเร็จและถูกนำมายังหน้า Verify OTP |
| Test Data | OTP 6 หลักที่ถูกต้อง และ OTP ที่ไม่ถูกต้อง |
| Test Steps | 1. ตรวจสอบ Email ที่แสดงบนหน้า Verify OTP<br>2. กรอก OTP 6 หลัก<br>3. กด Verify OTP<br>4. ตรวจสอบ Token และหน้าปลายทาง |
| Expected Result | เมื่อ OTP ถูกต้อง ระบบบันทึก accessToken/refreshToken และนำผู้ใช้ไปยังหน้าที่กำหนด เมื่อ OTP ไม่ถูกต้อง ระบบแสดง Error และยังอยู่หน้า Verify OTP |
| Actual Result |  |
| Status |  |

### TS_AC_003 - ทดสอบการขอส่ง OTP ใหม่

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้อยู่หน้า Verify OTP |
| Test Data | ผู้ใช้ที่ต้องยืนยัน OTP |
| Test Steps | 1. เข้าหน้า Verify OTP<br>2. ตรวจสอบว่ามีปุ่มหรือคำสั่ง Resend OTP หรือไม่<br>3. หากมี ให้กดขอ OTP ใหม่และตรวจสอบผลลัพธ์ |
| Expected Result | สถานะปัจจุบันของ Website ยังไม่พบปุ่ม Resend OTP บนหน้า Verify OTP จึงควรบันทึกว่า Feature นี้ยังไม่พร้อมทดสอบ หรือหากมีการเพิ่มภายหลัง ระบบต้องส่ง OTP ใหม่และแสดงข้อความยืนยัน |
| Actual Result |  |
| Status |  |

### TS_AC_004 - ทดสอบการลงทะเบียน

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้ยังไม่ได้เข้าสู่ระบบ |
| Test Data | user_name, email, password, confirm_password |
| Test Steps | 1. เข้าหน้า Register<br>2. กรอกชื่อผู้ใช้ อีเมล รหัสผ่าน และยืนยันรหัสผ่าน<br>3. กดสร้างบัญชี<br>4. ทดสอบกรณีรหัสผ่านน้อยกว่า 8 ตัวอักษร และกรณียืนยันรหัสผ่านไม่ตรงกัน |
| Expected Result | ระบบสร้างบัญชีสำเร็จและนำไปหน้า Login กรณีข้อมูลไม่ถูกต้องแสดงข้อความ Error เช่น รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร หรือรหัสผ่านยืนยันไม่ตรงกัน |
| Actual Result |  |
| Status |  |

### TS_AC_005 - ทดสอบการออกจากระบบ

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้เข้าสู่ระบบแล้ว |
| Test Data | บัญชีผู้ใช้ที่มี Token |
| Test Steps | 1. กดเมนู Logout จาก Sidebar<br>2. ตรวจสอบการเรียก API Logout<br>3. ตรวจสอบ Token ใน Browser Storage<br>4. เปิดหน้าสำหรับสมาชิกอีกครั้ง |
| Expected Result | ระบบลบ Token ออกจาก Browser Storage ผู้ใช้ถูกนำออกจากระบบ และเมื่อเข้า Protected Page จะถูกนำไปหน้า Auth/Login |
| Actual Result |  |
| Status |  |

### TS_AC_006 - ทดสอบการต่ออายุ Access Token ด้วย Refresh Token

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้มี refreshToken ที่ยังใช้งานได้ และ accessToken หมดอายุ |
| Test Data | Expired accessToken, valid refreshToken |
| Test Steps | 1. จำลอง accessToken หมดอายุ<br>2. เรียกหน้า/API ที่ต้องยืนยันตัวตน<br>3. ตรวจสอบการเรียก /auth/refresh<br>4. ตรวจสอบการเรียก API เดิมซ้ำหลังได้ Token ใหม่ |
| Expected Result | ระบบต่ออายุ accessToken สำเร็จ บันทึก Token ใหม่ และผู้ใช้ใช้งานต่อได้โดยไม่ต้อง Login ใหม่ หาก refreshToken ใช้ไม่ได้ ระบบนำผู้ใช้กลับไป Login |
| Actual Result |  |
| Status |  |

### TS_AES_001 - ทดสอบผู้ใช้ที่ยังไม่เข้าสู่ระบบเข้าหน้าสำหรับสมาชิก

| Field | Detail |
|---|---|
| Preconditions | Browser ไม่มี accessToken |
| Test Data | URL /dashboard, /realtime, /plans, /history, /notifications, /devices |
| Test Steps | 1. ลบ Token ออกจาก Browser Storage<br>2. เปิด URL หน้าสำหรับสมาชิกโดยตรง<br>3. ตรวจสอบหน้าที่ระบบนำทางไป |
| Expected Result | ระบบไม่อนุญาตให้เข้าหน้าสมาชิก และ Redirect ไปหน้า Auth พร้อมเก็บ returnTo เพื่อกลับมาหน้าเดิมหลัง Login |
| Actual Result |  |
| Status |  |

### TS_PF_001 - ทดสอบการแสดง Username ของผู้ใช้ที่เข้าสู่ระบบ

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้เข้าสู่ระบบแล้ว |
| Test Data | บัญชีที่มี user_name |
| Test Steps | 1. เข้าสู่ระบบ<br>2. ตรวจสอบ Sidebar/Header หรือพื้นที่แสดงข้อมูลผู้ใช้<br>3. Reload หน้าเว็บ |
| Expected Result | ระบบแสดงชื่อผู้ใช้ตรงกับบัญชีที่ Login และยังแสดงถูกต้องหลัง Reload |
| Actual Result |  |
| Status |  |

### TS_PF_002 - ทดสอบการแก้ไขข้อมูลโปรไฟล์

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้เข้าสู่ระบบแล้ว |
| Test Data | user_name หรือข้อมูลโปรไฟล์ใหม่ |
| Test Steps | 1. ตรวจสอบว่ามีหน้า/ปุ่มแก้ไขโปรไฟล์หรือไม่<br>2. หากมี ให้แก้ไขข้อมูลและบันทึก<br>3. Reload และตรวจสอบข้อมูลใหม่ |
| Expected Result | สถานะปัจจุบันยังไม่พบหน้าแก้ไข Profile แยกใน Website จึงควรบันทึกว่า Feature นี้ยังไม่พร้อมทดสอบ หรือหากเพิ่มภายหลัง ระบบต้องบันทึกข้อมูลใหม่และแสดงผลถูกต้อง |
| Actual Result |  |
| Status |  |

### TS_DET_001 - ทดสอบการอนุญาตและเปิดใช้งานกล้อง

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้เข้าสู่ระบบและอยู่หน้า Realtime |
| Test Data | Browser ที่มีกล้อง และ Browser ที่ยังไม่อนุญาตสิทธิ์กล้อง |
| Test Steps | 1. กด Start บนหน้า Realtime<br>2. อนุญาตสิทธิ์กล้องจาก Browser<br>3. ตรวจสอบภาพ/สถานะกล้อง<br>4. ทดสอบกรณีปฏิเสธสิทธิ์กล้อง |
| Expected Result | เมื่ออนุญาต กล้องเริ่มทำงานและระบบพร้อมตรวจจับ เมื่อปฏิเสธสิทธิ์ ระบบแสดงสถานะหรือ Error ว่าเข้าถึงกล้องไม่ได้ |
| Actual Result |  |
| Status |  |

### TS_DET_002 - ทดสอบการเริ่มตรวจจับการกะพริบตา

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้ Login แล้ว กล้องพร้อมใช้งาน |
| Test Data | ใบหน้าผู้ทดสอบอยู่ในกรอบกล้อง |
| Test Steps | 1. เข้าหน้า Realtime<br>2. กด Start<br>3. ตรวจสอบการสร้าง Detection Session<br>4. ตรวจสอบสถานะ sessionActive และข้อมูลบนหน้าจอ |
| Expected Result | ระบบเรียก /detection/start สำเร็จ ได้ session_id เปิดกล้อง และเริ่มประมวลผลใบหน้า/ดวงตา |
| Actual Result |  |
| Status |  |

### TS_DET_003 - ทดสอบการตรวจจับและนับจำนวนการกะพริบตา

| Field | Detail |
|---|---|
| Preconditions | Detection Session ทำงานอยู่และพบใบหน้า |
| Test Data | ผู้ทดสอบกะพริบตาหลายครั้ง |
| Test Steps | 1. เริ่ม Detection Session<br>2. กะพริบตา 3-5 ครั้งอย่างชัดเจน<br>3. ตรวจสอบค่า Blink Count บน UI<br>4. ตรวจสอบการบันทึกผ่าน /detection/blink |
| Expected Result | Blink Count เพิ่มขึ้นตามการกะพริบที่ตรวจจับได้ และระบบส่งข้อมูล ear/detection_id เพื่อบันทึก Blink Record |
| Actual Result |  |
| Status |  |

### TS_DET_004 - ทดสอบการแสดง Blink Rate แบบ Real-time

| Field | Detail |
|---|---|
| Preconditions | Detection Session ทำงานอยู่ |
| Test Data | ระยะเวลาตรวจจับและจำนวน Blink |
| Test Steps | 1. เริ่ม Detection Session<br>2. กะพริบตาหลายครั้งระหว่าง session<br>3. ตรวจสอบค่า Avg. Blink/min หรือ Blink Rate บนหน้าจอ<br>4. รอดูการอัปเดตทุกช่วงเวลา |
| Expected Result | ระบบคำนวณ Blink Rate จากจำนวน Blink และเวลาที่ตรวจพบใบหน้า พร้อมอัปเดตแบบ Real-time |
| Actual Result |  |
| Status |  |

### TS_DET_005 - ทดสอบการหยุดนับเวลาเมื่อไม่พบใบหน้า

| Field | Detail |
|---|---|
| Preconditions | Detection Session ทำงานอยู่ |
| Test Data | ผู้ทดสอบออกจากหน้ากล้องเกินช่วงเวลาที่ระบบกำหนด |
| Test Steps | 1. เริ่ม Detection Session<br>2. ออกจากหน้ากล้องหรือปิดบังใบหน้า<br>3. สังเกต Duration และ Telemetry<br>4. ตรวจสอบ Notification กรณีเปิดแจ้งเตือน Face Missing |
| Expected Result | ระบบไม่เพิ่มเวลาการใช้งานเมื่อไม่พบใบหน้า และส่งสถานะ personPresent=false |
| Actual Result |  |
| Status |  |

### TS_DET_006 - ทดสอบการนับเวลาต่อเมื่อกลับมาพบใบหน้า

| Field | Detail |
|---|---|
| Preconditions | Detection Session ทำงานอยู่และเคยไม่พบใบหน้า |
| Test Data | ผู้ทดสอบกลับมาอยู่หน้ากล้อง |
| Test Steps | 1. เริ่ม Detection Session<br>2. ออกจากหน้ากล้องให้เวลาหยุดนับ<br>3. กลับมาอยู่หน้ากล้อง<br>4. ตรวจสอบ Duration และ Blink Rate |
| Expected Result | เมื่อกลับมาพบใบหน้า ระบบเริ่มนับ active seconds ต่อจากค่าเดิม และกลับมาตรวจจับ Blink ได้ |
| Actual Result |  |
| Status |  |

### TS_DET_007 - ทดสอบการตรวจพบแสงไม่เพียงพอ

| Field | Detail |
|---|---|
| Preconditions | Detection Session ทำงานอยู่ |
| Test Data | สภาพแสงปกติและสภาพแสงมืด |
| Test Steps | 1. เริ่ม Detection Session<br>2. ลดแสงบริเวณใบหน้าหรือกล้อง<br>3. ตรวจสอบสถานะ lightingLevel และ Notification<br>4. เพิ่มแสงกลับสู่ปกติ |
| Expected Result | เมื่อภาพมืด ระบบประเมิน lightingLevel เป็น DARK และหากเปิดแจ้งเตือน poorLighting ระบบแจ้งเตือนให้เพิ่มแสง |
| Actual Result |  |
| Status |  |

### TS_DET_008 - ทดสอบการหยุดชั่วคราวและดำเนินการตรวจจับต่อ

| Field | Detail |
|---|---|
| Preconditions | Detection Session ทำงานอยู่ |
| Test Data | Session ที่มี Duration และ Blink Count แล้ว |
| Test Steps | 1. เริ่ม Detection Session<br>2. กด Pause<br>3. ตรวจสอบว่ากล้องหยุดและ App Tracker pause<br>4. กด Resume/Start อีกครั้ง<br>5. ตรวจสอบการนับเวลาต่อ |
| Expected Result | Pause แล้วระบบหยุดกล้องและหยุด App Tracker ชั่วคราว Resume แล้วระบบเปิดกล้องต่อ ใช้ session เดิม และคงค่า Blink/Duration เดิม |
| Actual Result |  |
| Status |  |

### TS_DET_009 - ทดสอบการสิ้นสุด Detection Session

| Field | Detail |
|---|---|
| Preconditions | Detection Session ทำงานอยู่ |
| Test Data | Session ที่มีเวลาตรวจจับและจำนวน Blink |
| Test Steps | 1. เริ่ม Detection Session<br>2. ใช้งานอย่างน้อย 1 นาที<br>3. กด End Session<br>4. ตรวจสอบการปิดกล้องและสิ้นสุด session |
| Expected Result | ระบบเรียก /app-usage/end และ /detection/end ส่ง duration_seconds, total_blinks, average_blinks_per_minute, average_ear แล้วหยุดกล้องและเปลี่ยนสถานะ sessionActive=false |
| Actual Result |  |
| Status |  |

### TS_DET_010 - ทดสอบการบันทึกจำนวนกะพริบและเวลาตรวจจับ

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้ทำ Detection Session จนจบ |
| Test Data | Detection Session ที่มี total_blinks และ duration_seconds |
| Test Steps | 1. เริ่ม Session และกะพริบตาหลายครั้ง<br>2. End Session<br>3. เปิด Dashboard หรือ History<br>4. ตรวจสอบข้อมูล session ที่บันทึก |
| Expected Result | จำนวน Blink, Duration และ Average Blink/min ถูกบันทึกและนำไปแสดงใน Dashboard/History ได้ถูกต้อง |
| Actual Result |  |
| Status |  |

### TS_DET_011 - ทดสอบการป้องกันการเริ่ม Session ซ้อนกัน

| Field | Detail |
|---|---|
| Preconditions | Detection Session กำลังทำงานอยู่ |
| Test Data | ผู้ใช้กด Start ซ้ำหรือเรียก API start ซ้ำ |
| Test Steps | 1. เริ่ม Detection Session<br>2. ระหว่าง session ยังทำงาน ให้กด Start ซ้ำหรือเรียก /detection/start ซ้ำ<br>3. ตรวจสอบจำนวน session_id และสถานะ UI |
| Expected Result | ระบบไม่ควรสร้าง session ซ้อนจาก UI ระหว่าง sessionActive อยู่ และควรคง session_id เดิมจนกว่าจะ End Session |
| Actual Result |  |
| Status |  |

### TS_DET_012 - ทดสอบการแสดง Error เมื่อเข้าถึงกล้องไม่ได้

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้ Login แล้ว |
| Test Data | Browser ที่ปิดสิทธิ์กล้อง หรือไม่มีกล้อง |
| Test Steps | 1. ปิดสิทธิ์กล้องใน Browser<br>2. เปิดหน้า Realtime<br>3. กด Start<br>4. ตรวจสอบข้อความ Error/สถานะกล้อง |
| Expected Result | ระบบไม่เริ่มตรวจจับและแสดงข้อความ/สถานะว่าไม่สามารถเข้าถึงกล้องได้ โดยไม่ทำให้หน้าเว็บค้าง |
| Actual Result |  |
| Status |  |

### TS_HLP_001 - ทดสอบสถานะเมื่อไม่พบ Blink Helper

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้เข้าสู่ระบบและยังไม่ได้เปิด Blink Helper |
| Test Data | หน้า Connecting Device |
| Test Steps | 1. ปิด Blink Helper<br>2. เปิดหน้า Connecting Device<br>3. กดตรวจสอบอีกครั้ง<br>4. ตรวจสอบสถานะ Blink Helper |
| Expected Result | ระบบแสดงสถานะ Blink Helper ว่าติดต่อไม่ได้ หรือยังไม่เชื่อมต่อ โดยไม่กระทบการใช้งานหน้าอื่น |
| Actual Result |  |
| Status |  |

### TS_HLP_002 - ทดสอบการเชื่อมต่อ Blink Helper สำเร็จ

| Field | Detail |
|---|---|
| Preconditions | ติดตั้งและเปิด Blink Helper แล้ว |
| Test Data | Helper Application ที่พร้อมส่ง activeApp |
| Test Steps | 1. เปิด Blink Helper<br>2. เปิดหน้า Connecting Device<br>3. กดตรวจสอบอีกครั้ง<br>4. ตรวจสอบสถานะ Helper และ active app |
| Expected Result | ระบบแสดง Blink Helper เป็นเชื่อมต่อแล้ว และแสดงชื่อ Application ปัจจุบันเมื่อ Helper ส่งข้อมูลได้ |
| Actual Result |  |
| Status |  |

### TS_HLP_003 - ทดสอบการตรวจหา Application ที่กำลังใช้งาน

| Field | Detail |
|---|---|
| Preconditions | Blink Helper และ Browser Extension เชื่อมต่อแล้ว Detection Session ทำงานอยู่ |
| Test Data | Application เช่น Chrome, VS Code, Browser อื่น |
| Test Steps | 1. เริ่ม Detection Session<br>2. เปิด Application ที่ต้องการทดสอบ<br>3. รอระบบ Poll ข้อมูล current app<br>4. ตรวจสอบชื่อ Application และระยะเวลาบนหน้า Realtime |
| Expected Result | ระบบเรียก /app-usage/current และแสดง Application ที่กำลังใช้งาน พร้อม Duration และ Blink Count ของ Application นั้น |
| Actual Result |  |
| Status |  |

### TS_HLP_004 - ทดสอบการเปลี่ยน Application ระหว่าง Session

| Field | Detail |
|---|---|
| Preconditions | Detection Session ทำงานอยู่และ Helper เชื่อมต่อแล้ว |
| Test Data | Application อย่างน้อย 2 โปรแกรม |
| Test Steps | 1. เริ่ม Detection Session<br>2. ใช้งาน Application A<br>3. เปลี่ยนไป Application B<br>4. ตรวจสอบชื่อ Application, Duration และ Blink Count |
| Expected Result | ระบบอัปเดต current app เป็น Application ใหม่ รีเซ็ต/แยก Current App Blink Count ตาม usage_id และบันทึก App Usage แยกกัน |
| Actual Result |  |
| Status |  |

### TS_EXT_001 - ทดสอบการทำงานของ Browser Extension

| Field | Detail |
|---|---|
| Preconditions | ติดตั้ง BlinkCare Monitor Extension แล้ว |
| Test Data | Extension version และสถานะ connected/monitoring |
| Test Steps | 1. เปิดหน้า Connecting Device<br>2. ตรวจสอบสถานะ Chrome Extension<br>3. เริ่ม Detection Session<br>4. ตรวจสอบสถานะ monitoring และ helperConnected |
| Expected Result | ระบบตรวจพบ Extension แสดงเวอร์ชัน สถานะเชื่อมต่อ และสถานะการตรวจจับตามจริง |
| Actual Result |  |
| Status |  |

### TS_NTI_001 - ทดสอบการแจ้งเตือน

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้ Login แล้วและ Browser รองรับ Notification |
| Test Data | Settings: lowBlinkRate, faceMissing, poorLighting, planCompleted, muted |
| Test Steps | 1. เข้าหน้า Notification<br>2. เปิด/ปิด Switch แต่ละรายการ<br>3. กดบันทึกการตั้งค่า<br>4. อนุญาตสิทธิ์ Notification จาก Browser<br>5. ทำให้เกิดเหตุการณ์ เช่น Blink Rate ต่ำ หรือไม่พบใบหน้า |
| Expected Result | ระบบบันทึกการตั้งค่า แสดงสถานะสิทธิ์แจ้งเตือน และแสดง/บันทึกประวัติแจ้งเตือนตามรายการที่เปิดใช้งาน |
| Actual Result |  |
| Status |  |

### TS_PLN_001 - ทดสอบการแสดงแผนดูแลสุขภาพตา

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้ Login แล้ว |
| Test Data | Goal: เพิ่มอัตราการกะพริบตา, ลดอาการตาล้า, ลดเวลาหน้าจอ, ลดอาการตาแห้ง |
| Test Steps | 1. เข้าหน้า Plan<br>2. ตรวจสอบรายการแผนทั้งหมด<br>3. กดสร้างแผนใหม่<br>4. เลือกเป้าหมาย มาตรการ วันที่เริ่ม/สิ้นสุด และความถี่<br>5. กดบันทึกแผน<br>6. ตรวจสอบแผนในแท็บแผนของฉัน/ติดตามผล/ประวัติแผน |
| Expected Result | ระบบแสดงแผนดูแลดวงตาและสร้างแผนได้สำเร็จ โดยบันทึก goal_code, plan_name, start_date, end_date และ measures ไปยัง Backend |
| Actual Result |  |
| Status |  |

### TS_DSH_001 - ทดสอบการแสดงข้อมูลสรุปบน Dashboard

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้ Login แล้วและมี Detection Session ที่สิ้นสุดแล้ว |
| Test Data | วันที่ที่มีข้อมูลและวันที่ไม่มีข้อมูล |
| Test Steps | 1. เข้าหน้า Dashboard<br>2. เลือกวันที่ที่มีข้อมูล<br>3. ตรวจสอบ Summary Cards, Dry Eye Risk, Blink Rate Trend, Top Risk Periods และ App Usage<br>4. เลือกวันที่ไม่มีข้อมูล<br>5. กด Refresh |
| Expected Result | Dashboard แสดงจำนวน session, total blinks, screen time, average blinks/min, risk level, trend และข้อมูลเปรียบเทียบได้ถูกต้อง กรณีไม่มีข้อมูลแสดง empty state ที่เหมาะสม |
| Actual Result |  |
| Status |  |

### TS_HIS_001 - ทดสอบดู Timeline เหตุการณ์ย้อนหลัง

| Field | Detail |
|---|---|
| Preconditions | ผู้ใช้ Login แล้วและมีข้อมูล Detection/Notification |
| Test Data | Date range, Filter: ทั้งหมด, การใช้งาน, การแจ้งเตือน |
| Test Steps | 1. เข้าหน้า History<br>2. เลือกช่วงวันที่ From/To<br>3. ตรวจสอบ Summary Metrics<br>4. เปลี่ยนตัวกรอง Timeline<br>5. ตรวจสอบเหตุการณ์ที่น่าสนใจ |
| Expected Result | ระบบแสดง Timeline ตามช่วงวันที่และตัวกรองที่เลือก พร้อมสรุปเวลาการใช้งาน Blink Rate เฉลี่ย จำนวนแจ้งเตือน วันที่มีการใช้งาน และเหตุการณ์ที่น่าสนใจ |
| Actual Result |  |
| Status |  |

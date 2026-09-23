import { Link } from "react-router-dom";
import {
  LuBell,
  LuCamera,
  LuChevronRight,
  LuCircleCheck,
  LuExternalLink,
  LuLaptop,
  LuMail,
  LuMonitorCog,
  LuPuzzle,
  LuShieldCheck,
} from "react-icons/lu";
import "./Support.css";

const topics = [
  {
    icon: LuPuzzle,
    title: "Chrome Extension",
    description: "การติดตั้ง การเชื่อมต่อบัญชี และการเริ่มตรวจจับ",
    steps: [
      "เปิด chrome://extensions และตรวจว่า BlinkCare Monitor เปิดใช้งานอยู่",
      "หลังอัปเดต Extension ให้กด Reload แล้วรีเฟรชหน้า BlinkCare",
      "เข้าสู่ระบบบนเว็บไซต์ก่อนกดเริ่มตรวจจับจาก Extension",
    ],
  },
  {
    icon: LuCamera,
    title: "กล้องและการตรวจจับ",
    description: "แก้ปัญหาเปิดกล้องไม่ได้หรือไม่พบใบหน้า",
    steps: [
      "อนุญาต Camera ให้ Chrome ในการตั้งค่าของเบราว์เซอร์และระบบปฏิบัติการ",
      "ปิดโปรแกรมอื่นที่กำลังใช้กล้อง แล้วเริ่มตรวจจับใหม่",
      "จัดใบหน้าให้อยู่ในกรอบและเพิ่มแสงหากภาพมืดเกินไป",
    ],
  },
  {
    icon: LuLaptop,
    title: "Blink Helper",
    description: "การติดตามชื่อแอปที่กำลังใช้งานบนเครื่อง",
    steps: [
      "เปิด Blink Helper ก่อนเริ่ม Detection Session",
      "Helper ต้องเชื่อมต่อ backend ชุดเดียวกับเว็บไซต์และ Extension",
      "หากขึ้นว่าไม่พบ Helper ให้ปิดและเปิด Helper ใหม่ แล้ว Reload Extension",
    ],
  },
  {
    icon: LuBell,
    title: "การแจ้งเตือน",
    description: "System Notification และการแจ้งเตือนตามแผน",
    steps: [
      "เปิดสิทธิ์ Notifications ให้ Google Chrome ในการตั้งค่าระบบ",
      "ตรวจว่าการแจ้งเตือนชนิดนั้นเปิดอยู่ในหน้า Notification Settings",
      "มาตรการตามแผนจะนับเฉพาะเวลาที่ตรวจพบผู้ใช้อยู่หน้าจอจริง",
    ],
  },
];

const faqs = [
  ["BlinkCare บันทึกภาพจากกล้องหรือไม่", "ไม่บันทึกภาพหรือวิดีโอ การประมวลผลใบหน้าและการกะพริบตาทำบนอุปกรณ์"],
  ["ทำไมเวลาตรวจจับหยุดเดิน", "ระบบหยุดนับเวลาเมื่อไม่พบใบหน้า และเริ่มนับต่อเมื่อกลับมาอยู่หน้ากล้อง"],
  ["ทำไม Dashboard ยังไม่มีข้อมูล", "Dashboard แสดง session ที่กดสิ้นสุดแล้ว กรุณากดหยุดตรวจจับและเลือกวันที่ตรงกับวันที่ใช้งาน"],
  ["ทำไมไม่เห็นชื่อแอปใน Extension", "ต้องเปิด Blink Helper ไว้ หาก Helper พร้อมแต่ยังไม่มี session ให้หยุดแล้วเริ่มตรวจจับใหม่"],
];

export default function Support() {
  return (
    <main className="support-page">
      <header className="support-topbar">
        <Link className="support-brand" to="/" aria-label="BlinkCare home">
          <span><LuShieldCheck /></span>
          <div><strong>BlinkCare</strong><small>Support Center</small></div>
        </Link>
        <Link className="support-open-app" to="/">เปิด BlinkCare <LuExternalLink /></Link>
      </header>

      <section className="support-intro">
        <span>BLINKCARE SUPPORT</span>
        <h1>เราช่วยคุณแก้ปัญหาได้</h1>
        <p>เลือกหัวข้อที่พบปัญหา หรือติดต่อทีมสนับสนุนพร้อมรายละเอียดอุปกรณ์และข้อความ error</p>
        <div className="support-status"><LuCircleCheck /><span><strong>ระบบช่วยเหลือพร้อมใช้งาน</strong><small>BlinkCare Web, Chrome Extension และ Blink Helper</small></span></div>
      </section>

      <section className="support-content">
        <div className="support-section-heading"><div><h2>หัวข้อช่วยเหลือ</h2><p>ขั้นตอนตรวจสอบเบื้องต้นสำหรับส่วนประกอบแต่ละส่วน</p></div></div>
        <div className="support-topic-grid">
          {topics.map((topic) => {
            const Icon = topic.icon;
            return (
              <article className="support-topic" key={topic.title}>
                <div className="support-topic-title"><span><Icon /></span><div><h3>{topic.title}</h3><p>{topic.description}</p></div></div>
                <ol>{topic.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              </article>
            );
          })}
        </div>

        <div className="support-lower-grid">
          <section className="support-faq">
            <div className="support-section-heading"><div><h2>คำถามที่พบบ่อย</h2><p>คำตอบสั้น ๆ สำหรับการใช้งานประจำวัน</p></div></div>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}<LuChevronRight /></summary>
                <p>{answer}</p>
              </details>
            ))}
          </section>

          <aside className="support-contact">
            <span className="support-contact-icon"><LuMail /></span>
            <h2>ยังแก้ปัญหาไม่ได้?</h2>
            <p>ส่งภาพหน้าจอ ข้อความ error ระบบปฏิบัติการ และขั้นตอนที่ทำก่อนเกิดปัญหามาให้ทีมสนับสนุน</p>
            <a href="mailto:support@blinkcare.website">support@blinkcare.website <LuExternalLink /></a>
            <div><LuMonitorCog /><span><strong>ข้อมูลที่ควรแนบ</strong><small>Chrome version, Extension version และ Blink Helper version</small></span></div>
          </aside>
        </div>
      </section>

      <footer className="support-footer"><span>BlinkCare Support</span><small>Eye health monitoring assistance</small></footer>
    </main>
  );
}

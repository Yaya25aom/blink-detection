import { Link } from "react-router-dom";
import {
  LuBell,
  LuCamera,
  LuChevronRight,
  LuDatabase,
  LuEye,
  LuKeyRound,
  LuLaptop,
  LuLockKeyhole,
  LuMail,
  LuShieldCheck,
} from "react-icons/lu";
import "./Privacy.css";

const summaries = [
  { icon: LuCamera, title: "ไม่บันทึกภาพ", text: "ภาพจากกล้องใช้ประมวลผลบนอุปกรณ์และไม่ถูกอัปโหลดเป็นภาพหรือวิดีโอ" },
  { icon: LuDatabase, title: "เก็บข้อมูลการใช้งาน", text: "บันทึกผลรวม session, Blink Rate, ระยะเวลา และชื่อแอปเพื่อสร้าง Dashboard" },
  { icon: LuKeyRound, title: "แยกข้อมูลตามบัญชี", text: "ข้อมูล session แผน และการแจ้งเตือนเชื่อมกับบัญชีผู้ใช้ที่เข้าสู่ระบบ" },
];

const sections = [
  {
    title: "1. ข้อมูลที่เราเก็บรวบรวม",
    content: [
      "ข้อมูลบัญชี เช่น อีเมล รหัสผู้ใช้ และข้อมูลที่จำเป็นสำหรับการเข้าสู่ระบบและยืนยัน OTP",
      "ข้อมูล Detection Session เช่น เวลาเริ่มและสิ้นสุด ระยะเวลาที่พบผู้ใช้อยู่หน้าจอ จำนวนการกะพริบตา Blink Rate และค่า EAR ที่เกี่ยวข้องกับการตรวจจับ",
      "ข้อมูลการใช้งานแอป เช่น ชื่อแอปที่อยู่ด้านหน้า เวลาเริ่มและสิ้นสุด และระยะเวลาการใช้งาน โดย Blink Helper เป็นผู้ตรวจจับบนอุปกรณ์",
      "ข้อมูลแผนดูแลสุขภาพตา เช่น เป้าหมาย มาตรการ รอบเวลา วันที่เริ่มและสิ้นสุด รวมถึงสถานะทำสำเร็จหรือข้ามการแจ้งเตือน",
      "การตั้งค่าและประวัติการแจ้งเตือนที่เกี่ยวข้องกับบัญชีผู้ใช้บนอุปกรณ์นั้น",
    ],
  },
  {
    title: "2. การใช้กล้องและการประมวลผลใบหน้า",
    content: [
      "BlinkCare ใช้กล้องเพื่อตรวจหาตำแหน่งใบหน้า ดวงตา การกะพริบตา การอยู่หน้าจอ และสภาพแสงที่เพียงพอสำหรับการตรวจจับ",
      "การวิเคราะห์ภาพดำเนินการภายในเบราว์เซอร์หรือ Chrome Extension บนอุปกรณ์ของผู้ใช้ BlinkCare ไม่บันทึกหรือส่งภาพและวิดีโอจากกล้องไปยังเซิร์ฟเวอร์",
      "ระบบส่งเฉพาะผลลัพธ์ที่คำนวณแล้ว เช่น จำนวนการกะพริบตา เวลา และค่าทางสถิติที่จำเป็นต่อ Dashboard",
    ],
  },
  {
    title: "3. วัตถุประสงค์ในการใช้ข้อมูล",
    content: [
      "แสดงผลการตรวจจับแบบเรียลไทม์ สรุปสุขภาพดวงตา Dashboard และประวัติการใช้งาน",
      "คำนวณ Blink Rate ราย session รายช่วงเวลา และรายแอปที่กำลังใช้งาน",
      "ส่งการแจ้งเตือนเมื่อ Blink Rate ต่ำ ไม่พบใบหน้า สภาพแสงไม่เหมาะสม หรือถึงรอบมาตรการตามแผน",
      "ติดตามความคืบหน้าของแผนดูแลสุขภาพตาและปรับปรุงความเสถียรของบริการ",
    ],
  },
  {
    title: "4. Chrome Extension และ Blink Helper",
    content: [
      "Extension จัดเก็บ token และสถานะที่จำเป็นใน Chrome storage เพื่อเชื่อม session กับบัญชีที่เข้าสู่ระบบ",
      "Blink Helper อ่านเฉพาะชื่อแอปที่อยู่ด้านหน้าบน macOS หรือ Windows และส่งช่วงการใช้งานไปยัง backend เมื่อมี Detection Session ทำงานอยู่",
      "Extension ติดต่อ Helper ผ่าน local bridge ที่ 127.0.0.1 บนอุปกรณ์เดียวกัน ช่องทางนี้ส่งเฉพาะสถานะและชื่อแอป ไม่ส่งภาพจากกล้อง",
    ],
  },
  {
    title: "5. การจัดเก็บและการรักษาความปลอดภัย",
    content: [
      "ข้อมูลฝั่งเซิร์ฟเวอร์ถูกจัดเก็บในฐานข้อมูลของ BlinkCare และผูกกับรหัสบัญชีผู้ใช้",
      "การเรียก API ที่มีข้อมูลส่วนบุคคลใช้ access token เพื่อตรวจสอบบัญชี และระบบใช้ refresh token เพื่อรักษาสถานะการเข้าสู่ระบบ",
      "ผู้ใช้ควรรักษาความปลอดภัยของอุปกรณ์ บัญชี Chrome และข้อมูลเข้าสู่ระบบของตนเอง และออกจากระบบเมื่อใช้อุปกรณ์ร่วมกับผู้อื่น",
    ],
  },
  {
    title: "6. การแบ่งปันข้อมูล",
    content: [
      "BlinkCare ไม่จำหน่ายภาพจากกล้อง ข้อมูลการกะพริบตา หรือประวัติการใช้งานแอปให้บุคคลภายนอก",
      "ข้อมูลอาจถูกประมวลผลโดยผู้ให้บริการโครงสร้างพื้นฐานที่จำเป็นต่อการให้บริการ เช่น hosting, database และ email สำหรับ OTP ภายใต้ขอบเขตการทำงานของระบบ",
      "เราอาจเปิดเผยข้อมูลเมื่อจำเป็นตามกฎหมาย หรือเพื่อป้องกันความปลอดภัยของผู้ใช้และบริการ",
    ],
  },
  {
    title: "7. สิทธิ์และตัวเลือกของผู้ใช้",
    content: [
      "ผู้ใช้สามารถปิดกล้อง หยุด Detection Session ปิดการแจ้งเตือน ปิด Blink Helper หรือออกจากระบบได้ทุกเมื่อ",
      "สิทธิ์กล้องและ Notification สามารถเปลี่ยนได้จากการตั้งค่า Chrome และการตั้งค่าระบบปฏิบัติการ",
      "ผู้ใช้สามารถติดต่อทีมสนับสนุนเพื่อสอบถามเกี่ยวกับข้อมูลหรือขอลบบัญชีและข้อมูลที่เกี่ยวข้อง โดยอาจต้องยืนยันตัวตนก่อนดำเนินการ",
    ],
  },
  {
    title: "8. ข้อจำกัดทางการแพทย์",
    content: [
      "BlinkCare เป็นเครื่องมือช่วยติดตามพฤติกรรมการใช้หน้าจอและการกะพริบตา ไม่ใช่อุปกรณ์วินิจฉัยโรคหรือคำแนะนำทางการแพทย์",
      "หากมีอาการปวดตา ตาแห้ง ระคายเคือง หรือการมองเห็นผิดปกติต่อเนื่อง ควรปรึกษาผู้เชี่ยวชาญด้านสุขภาพตา",
    ],
  },
  {
    title: "9. การเปลี่ยนแปลงนโยบาย",
    content: [
      "เราอาจปรับปรุงนโยบายนี้เมื่อฟังก์ชันหรือวิธีประมวลผลข้อมูลเปลี่ยนแปลง โดยจะแสดงวันที่ปรับปรุงล่าสุดไว้บนหน้านี้",
    ],
  },
];

export default function Privacy() {
  return (
    <main className="privacy-page">
      <header className="privacy-topbar">
        <Link className="privacy-brand" to="/">
          <span><LuEye /></span><div><strong>BlinkCare</strong><small>Privacy Center</small></div>
        </Link>
        <nav><Link to="/support">Support</Link><Link to="/">เปิด BlinkCare</Link></nav>
      </header>

      <section className="privacy-intro">
        <div>
          <span>PRIVACY POLICY</span>
          <h1>นโยบายความเป็นส่วนตัว</h1>
          <p>นโยบายนี้อธิบายว่า BlinkCare เก็บ ใช้ และดูแลข้อมูลอย่างไรเมื่อคุณใช้งานเว็บไซต์ Chrome Extension และ Blink Helper</p>
          <small>ปรับปรุงล่าสุด: 23 กันยายน 2569</small>
        </div>
        <LuLockKeyhole />
      </section>

      <section className="privacy-summary">
        {summaries.map((item) => {
          const Icon = item.icon;
          return <article key={item.title}><span><Icon /></span><div><h2>{item.title}</h2><p>{item.text}</p></div></article>;
        })}
      </section>

      <div className="privacy-layout">
        <aside className="privacy-nav">
          <strong>เนื้อหาในหน้านี้</strong>
          {sections.map((section, index) => <a href={`#privacy-${index + 1}`} key={section.title}>{section.title}<LuChevronRight /></a>)}
        </aside>

        <article className="privacy-document">
          <div className="privacy-notice"><LuShieldCheck /><p><strong>ความเป็นส่วนตัวตั้งแต่การออกแบบ</strong><span>กล้องใช้สำหรับประมวลผลการตรวจจับบนอุปกรณ์ โดยไม่มีการจัดเก็บภาพหรือวิดีโอ</span></p></div>
          {sections.map((section, index) => (
            <section id={`privacy-${index + 1}`} key={section.title}>
              <h2>{section.title}</h2>
              <ul>{section.content.map((paragraph) => <li key={paragraph}>{paragraph}</li>)}</ul>
            </section>
          ))}
          <section className="privacy-contact" id="privacy-contact">
            <LuMail /><div><h2>ติดต่อเกี่ยวกับความเป็นส่วนตัว</h2><p>หากมีคำถาม คำขอเข้าถึง หรือลบข้อมูล กรุณาติดต่อทีม BlinkCare</p><a href="mailto:support@blinkcare.website">support@blinkcare.website</a></div>
          </section>
        </article>
      </div>

      <footer className="privacy-footer"><span>BlinkCare Privacy</span><div><LuLaptop /> Web · Extension · Helper <LuBell /></div></footer>
    </main>
  );
}

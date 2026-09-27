import { useEffect, useRef, useState } from "react";
import { LuCheck, LuCircle, LuEye, LuPause, LuPlay, LuRotateCcw, LuSparkles, LuSunMedium, LuX } from "react-icons/lu";
import eyeBreakScene from "../assets/eye-break-scene.png";
import "./PlanActivityGuide.css";

type Props = { title: string; measureCode?: string; onComplete: () => void; onSkip: () => void; onClose?: () => void };
type Kind = "distance" | "rest" | "blink" | "checklist";
type Config = { kind: Kind; label: string; heading: string; description: string; durations?: number[]; initial?: number; steps: [string, string][]; checks?: string[] };

const rule: Config = { kind: "distance", label: "20-20-20 EYE BREAK", heading: "พักสายตาด้วยกฎ 20-20-20", description: "ละสายตาจากหน้าจอ แล้วมองจุดที่อยู่ไกลประมาณ 20 ฟุต", durations: [20], initial: 20, steps: [["หันออกจากหน้าจอ", "เลือกจุดที่อยู่ไกลประมาณ 20 ฟุต"], ["มองให้สบายตา", "ไม่ต้องเพ่ง ปล่อยสายตาตามธรรมชาติ"], ["กลับมาพร้อมดวงตาที่ผ่อนคลาย", "กะพริบตาช้า ๆ 2-3 ครั้ง"]] };
const rest = (heading: string, description: string, durations: number[], steps: [string, string][]): Config => ({ kind: "rest", label: "GUIDED EYE BREAK", heading, description, durations, initial: durations[1] ?? durations[0], steps });
const CONFIG: Record<string, Config> = {
  RULE_20_20_20: rule, STRAIN_20_20_20: rule,
  DRY_20_20_20: { ...rule, description: "มองจุดที่อยู่ไกลประมาณ 20 ฟุต และกะพริบตาช้า ๆ เพื่อเพิ่มความชุ่มชื้น" },
  EYE_BREAK: rest("พักสายตาเป็นระยะ", "หยุดมองหน้าจอชั่วครู่ แล้วปล่อยให้ดวงตาได้พัก", [30, 60, 120], [["หันออกจากหน้าจอ", "วางสายตาบนจุดที่มองแล้วสบาย"], ["ผ่อนคลายดวงตา", "คลายหน้าผาก ไหล่ และไม่เพ่ง"], ["กะพริบตาช้า ๆ", "ทำ 2-3 ครั้งก่อนกลับมาทำงาน"]]),
  DRY_EYE_BREAK: rest("พักดวงตาเพื่อลดอาการตาแห้ง", "หลับตาเบา ๆ เป็นช่วง ๆ และพักจากลมที่เป่าเข้าดวงตา", [30, 60, 120], [["หันออกจากหน้าจอ", "หลีกเลี่ยงลมหรือแอร์ที่เป่าเข้าตา"], ["หลับตาเบา ๆ", "ไม่ขยี้หรือบีบดวงตา"], ["กะพริบตาให้สมบูรณ์", "ค่อย ๆ ลืมตาและกะพริบช้า ๆ"]]),
  STRAIN_BREAK: rest("พักจากงานที่ใช้สายตา", "เปลี่ยนจุดโฟกัสและขยับร่างกายเพื่อลดความล้าจากการเพ่ง", [60, 120, 300], [["วางงานตรงหน้า", "ละสายตาจากรายละเอียดเล็ก"], ["เปลี่ยนระยะโฟกัส", "มองใกล้และไกลสลับกัน"], ["ขยับคอและไหล่", "เคลื่อนไหวช้า ๆ โดยไม่ฝืน"]]),
  SESSION_LIMIT: rest("พักหลังใช้งานหน้าจอต่อเนื่อง", "ลุกออกจากหน้าจอ เพื่อหยุดช่วงการใช้งานต่อเนื่อง", [60, 180, 300], [["ลุกออกจากหน้าจอ", "วางอุปกรณ์และเปลี่ยนอิริยาบถ"], ["มองรอบตัว", "เปลี่ยนระยะโฟกัสของดวงตา"], ["กลับมาเมื่อพร้อม", "จัดท่านั่งใหม่ก่อนเริ่มงาน"]]),
  OFFLINE_BREAK: rest("พักโดยไม่ใช้หน้าจอ", "วางอุปกรณ์ แล้วเดินหรือทำกิจกรรมที่ไม่ใช้หน้าจอ", [180, 300, 600], [["วางอุปกรณ์", "ไม่เปลี่ยนไปใช้โทรศัพท์หรือจออื่น"], ["ขยับร่างกาย", "เดิน ดื่มน้ำ หรือยืดกล้ามเนื้อ"], ["กลับมาอย่างมีสติ", "เช็กท่านั่งและระยะห่างจากจอ"]]),
  BLINK_EXERCISE: { kind: "blink", label: "BLINK EXERCISE", heading: "ฝึกกะพริบตาให้ครบ", description: "หลับตาเบา ๆ แล้วลืมตาช้า ๆ หนึ่งครั้งต่อหนึ่งจังหวะ", steps: [["หลับตาเบา ๆ", "ไม่บีบเปลือกตาหรือเกร็งใบหน้า"], ["หยุดหนึ่งจังหวะ", "ให้เปลือกตาปิดอย่างเป็นธรรมชาติ"], ["ลืมตาช้า ๆ", "กดนับเมื่อทำครบหนึ่งครั้ง"]] },
  BRIGHTNESS: { kind: "checklist", label: "LIGHT CHECK", heading: "ตรวจความสว่างให้เหมาะสม", description: "เช็กแสงรอบตัวและหน้าจอให้มองเห็นชัดโดยไม่แสบตา", checks: ["ปรับความสว่างจอให้ใกล้เคียงกับแสงรอบตัว", "ลดแสงสะท้อนบนหน้าจอ", "จัดให้ใบหน้าได้รับแสงเพียงพอ"], steps: [["ดูแสงรอบตัว", "ห้องไม่ควรมืดกว่าหน้าจอมาก"], ["ตรวจแสงสะท้อน", "ขยับจอหรือแหล่งกำเนิดแสง"], ["ปรับจนสบายตา", "ไม่ต้องหรี่ตาเพื่ออ่านข้อความ"]] },
  DAILY_LIMIT: { kind: "checklist", label: "DAILY SCREEN LIMIT", heading: "ครบเป้าหมายเวลาหน้าจอวันนี้แล้ว", description: "ปิดงานที่ไม่จำเป็นและเตรียมจบการใช้หน้าจอในวันนี้", checks: ["บันทึกหรือปิดงานที่ไม่จำเป็นแล้ว", "วางแผนช่วงเวลาที่จะไม่ใช้หน้าจอ", "เปลี่ยนไปทำกิจกรรมที่ไม่ใช้หน้าจอ"], steps: [["ปิดงานที่ไม่จำเป็น", "เก็บเฉพาะสิ่งที่ต้องทำจริง ๆ"], ["วางอุปกรณ์", "หลีกเลี่ยงการย้ายไปใช้จออื่น"], ["พักให้ดวงตา", "เลือกกิจกรรมที่มองไกลหรือเคลื่อนไหว"]] },
};
const FALLBACK = rest("พักดูแลดวงตา", "พักจากหน้าจอและผ่อนคลายดวงตาสักครู่", [30, 60, 120], [["หยุดมองหน้าจอ", "วางสายตาบนจุดที่สบาย"], ["ผ่อนคลาย", "คลายใบหน้าและหัวไหล่"], ["กลับมาทำงาน", "กะพริบตาช้า ๆ ก่อนเริ่ม"]]);
const durationLabel = (seconds: number) => seconds < 60 ? `${seconds} วินาที` : `${seconds / 60} นาที`;

export default function PlanActivityGuide({ title, measureCode, onComplete, onSkip, onClose }: Props) {
  const config = CONFIG[measureCode ?? ""] ?? { ...FALLBACK, heading: title };
  const [duration, setDuration] = useState(config.initial ?? 60);
  const [remaining, setRemaining] = useState(config.initial ?? 60);
  const [running, setRunning] = useState(false);
  const [blinkTarget, setBlinkTarget] = useState(10);
  const [blinkCount, setBlinkCount] = useState(0);
  const [checks, setChecks] = useState(() => config.checks?.map(() => false) ?? []);
  const audio = useRef<AudioContext | null>(null);
  const sounded = useRef(false);
  const timerComplete = (config.kind === "distance" || config.kind === "rest") && remaining === 0;
  const complete = timerComplete || config.kind === "blink" && blinkCount >= blinkTarget || config.kind === "checklist" && checks.length > 0 && checks.every(Boolean);

  useEffect(() => { if (!running || remaining <= 0) return; const id = window.setInterval(() => setRemaining((v) => Math.max(0, v - 1)), 1000); return () => clearInterval(id); }, [remaining, running]);
  useEffect(() => { if (!complete || sounded.current) return; sounded.current = true; setRunning(false); const context = audio.current; if (!context) return; [659, 880].forEach((frequency, index) => { const oscillator = context.createOscillator(); const gain = context.createGain(); const start = context.currentTime + index * .22; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(.18, start + .02); gain.gain.exponentialRampToValueAtTime(.0001, start + .35); oscillator.connect(gain).connect(context.destination); oscillator.start(start); oscillator.stop(start + .38); }); }, [complete]);
  const prepareAudio = async () => { if (!audio.current) audio.current = new AudioContext(); await audio.current.resume(); };
  const reset = () => { setRemaining(duration); setRunning(false); setBlinkCount(0); setChecks(config.checks?.map(() => false) ?? []); sounded.current = false; };
  const chooseDuration = (seconds: number) => { setDuration(seconds); setRemaining(seconds); setRunning(false); sounded.current = false; };
  const interacted = remaining < duration || blinkCount > 0 || checks.some(Boolean);

  return <div className="activity-overlay" role="dialog" aria-modal="true" aria-label={title}><section className="activity-guide">
    <button className="activity-close" onClick={onClose ?? onSkip} title="ปิด"><LuX /></button>
    <header className="activity-header"><span>{config.label}</span><h2>{config.heading}</h2><p>{config.description}</p></header>
    <div className={`activity-scene activity-${config.kind} ${running ? "is-running" : ""} ${complete ? "is-complete" : ""}`}>
      <img src={eyeBreakScene} alt="ตัวละครพิกเซลกำลังพักสายตาจากหน้าจอ" />
      {(config.kind === "distance" || config.kind === "rest") && <><div className="gaze-path"><i /><i /><i /><i /><i /><i /><i /></div>{config.kind === "distance" && <div className="distance-target"><span>20 ฟุต</span></div>}<div className={`countdown-orbit ${complete ? "complete" : ""}`} style={{ "--progress": `${(duration - remaining) / duration * 360}deg` } as React.CSSProperties}><div>{complete ? <LuCheck /> : <><strong>{remaining}</strong><small>วินาที</small></>}</div></div></>}
      {config.kind === "blink" && <div className="blink-workout"><LuEye /><strong>{blinkCount}</strong><span>จาก {blinkTarget} ครั้ง</span><button disabled={complete} onClick={() => { void prepareAudio(); setBlinkCount((v) => Math.min(blinkTarget, v + 1)); }}><LuSparkles /> กะพริบแล้ว 1 ครั้ง</button></div>}
      {config.kind === "checklist" && <div className="checklist-panel"><LuSunMedium />{config.checks?.map((item, index) => <button className={checks[index] ? "checked" : ""} key={item} onClick={() => { void prepareAudio(); setChecks((items) => items.map((value, i) => i === index ? !value : value)); }}>{checks[index] ? <LuCheck /> : <LuCircle />}<span>{item}</span></button>)}</div>}
    </div>
    {config.kind === "blink" && <div className="activity-options"><span>จำนวนที่ต้องการฝึก</span>{[5, 10, 15, 20].map((count) => <button className={blinkTarget === count ? "active" : ""} disabled={blinkCount > 0} key={count} onClick={() => setBlinkTarget(count)}>{count} ครั้ง</button>)}</div>}
    {(config.kind === "rest" || config.kind === "distance") && (config.durations?.length ?? 0) > 1 && <div className="activity-options"><span>ระยะเวลาพัก</span>{config.durations?.map((seconds) => <button className={duration === seconds ? "active" : ""} disabled={running || remaining < duration} key={seconds} onClick={() => chooseDuration(seconds)}>{durationLabel(seconds)}</button>)}</div>}
    <div className="activity-steps">{config.steps.map(([heading, detail], index) => <div className={complete ? "done" : index === 0 ? "active" : ""} key={heading}><b>{index + 1}</b><span><strong>{heading}</strong><small>{detail}</small></span></div>)}</div>
    <div className="activity-controls">{!complete ? <><button className="activity-secondary" onClick={onSkip}>ข้ามรอบนี้</button>{(config.kind === "rest" || config.kind === "distance") && <button className="activity-primary" onClick={() => { void prepareAudio(); setRunning((v) => !v); }}>{running ? <><LuPause /> หยุดชั่วคราว</> : <><LuPlay /> {remaining < duration ? "ทำต่อ" : `เริ่มพัก ${durationLabel(duration)}`}</>}</button>}{interacted && <button className="activity-reset" onClick={reset} title="เริ่มใหม่"><LuRotateCcw /></button>}</> : <button className="activity-primary finish" onClick={onComplete}><LuCheck /> บันทึกว่าทำสำเร็จ</button>}</div>
  </section></div>;
}

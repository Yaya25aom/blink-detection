import { useEffect, useState } from "react";
import { LuCheck, LuEye, LuPause, LuPlay, LuRotateCcw, LuX } from "react-icons/lu";
import eyeBreakScene from "../assets/eye-break-scene.png";
import "./PlanActivityGuide.css";

type Props = {
  title: string;
  measureCode?: string;
  onComplete: () => void;
  onSkip: () => void;
  onClose?: () => void;
};

const TWENTY_RULE_CODES = new Set(["RULE_20_20_20", "STRAIN_20_20_20", "DRY_20_20_20"]);

export default function PlanActivityGuide({ title, measureCode, onComplete, onSkip, onClose }: Props) {
  const isTwentyRule = TWENTY_RULE_CODES.has(measureCode ?? "");
  const totalSeconds = isTwentyRule ? 20 : 30;
  const [remaining, setRemaining] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const complete = remaining === 0;

  useEffect(() => {
    if (!running || complete) return;
    const timer = window.setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [complete, running]);

  useEffect(() => {
    if (complete) setRunning(false);
  }, [complete]);

  const reset = () => {
    setRemaining(totalSeconds);
    setRunning(false);
  };

  return <div className="activity-overlay" role="dialog" aria-modal="true" aria-label={title}>
    <section className="activity-guide">
      <button className="activity-close" onClick={onClose ?? onSkip} title="ปิด"><LuX /></button>
      <header className="activity-header"><span>GUIDED EYE BREAK</span><h2>{isTwentyRule ? "พักสายตาด้วยกฎ 20-20-20" : title}</h2><p>{isTwentyRule ? "ละสายตาจากหน้าจอ แล้วมองวัตถุที่อยู่ไกลประมาณ 20 ฟุต" : "พักจากหน้าจอ ผ่อนคลายไหล่ และปล่อยให้ดวงตาได้พัก"}</p></header>

      <div className={`activity-scene ${running ? "is-running" : ""}`}>
        <img src={eyeBreakScene} alt="ตัวละครพิกเซลกำลังมองต้นไม้ไกลจากหน้าจอ" />
        <div className="gaze-origin"><LuEye /></div>
        <div className="gaze-path"><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="distance-target"><span>20 ฟุต</span></div>
        <div className={`countdown-orbit ${complete ? "complete" : ""}`} style={{ "--progress": `${((totalSeconds - remaining) / totalSeconds) * 360}deg` } as React.CSSProperties}>
          <div>{complete ? <LuCheck /> : <><strong>{remaining}</strong><small>วินาที</small></>}</div>
        </div>
      </div>

      <div className="activity-steps">
        <div className={running || complete ? "done" : "active"}><b>1</b><span><strong>หันออกจากหน้าจอ</strong><small>เลือกต้นไม้หรือวัตถุไกล ๆ</small></span></div>
        <div className={running ? "active" : complete ? "done" : ""}><b>2</b><span><strong>มองให้สบายตา</strong><small>ไม่ต้องเพ่ง ปล่อยสายตาตามธรรมชาติ</small></span></div>
        <div className={complete ? "done" : ""}><b>3</b><span><strong>ครบแล้วค่อยกลับมาทำงาน</strong><small>กะพริบตาช้า ๆ 2-3 ครั้ง</small></span></div>
      </div>

      <div className="activity-controls">
        {!complete ? <>
          <button className="activity-secondary" onClick={onSkip}>ข้ามรอบนี้</button>
          <button className="activity-primary" onClick={() => setRunning((value) => !value)}>{running ? <><LuPause /> หยุดชั่วคราว</> : <><LuPlay /> {remaining < totalSeconds ? "ทำต่อ" : `เริ่มพัก ${totalSeconds} วินาที`}</>}</button>
          {remaining < totalSeconds && <button className="activity-reset" onClick={reset} title="เริ่มใหม่"><LuRotateCcw /></button>}
        </> : <button className="activity-primary finish" onClick={onComplete}><LuCheck /> บันทึกว่าทำสำเร็จ</button>}
      </div>
    </section>
  </div>;
}

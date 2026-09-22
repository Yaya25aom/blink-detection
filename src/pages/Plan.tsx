import { useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { apiFetch } from "../services/apiClient";
import { showPlanNotification } from "../services/planNotification";
import {
  LuCalendarDays,
  LuArrowLeft,
  LuCheck,
  LuClock3,
  LuDroplets,
  LuEye,
  LuHourglass,
  LuMonitorOff,
  LuMove,
  LuSave,
  LuSettings2,
  LuSparkles,
  LuSunMedium,
  LuTimerReset,
} from "react-icons/lu";
import "./Plan.css";

type Measure = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: IconType;
  prefix: string;
  options: string[];
  defaultOption: string;
  supportsFlexible?: boolean;
};

type ReminderMode = "flexible" | "scheduled";

type Goal = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: IconType;
  color: string;
  measures: Measure[];
  benefits: string[];
};

const goals: Goal[] = [
  {
    id: "blink-rate",
    code: "BLINK_RATE",
    title: "เพิ่มอัตราการกะพริบตา",
    description: "สร้างนิสัยกะพริบตาให้สม่ำเสมอระหว่างใช้หน้าจอ",
    icon: LuEye,
    color: "violet",
    measures: [
      { id: "eye-break", code: "EYE_BREAK", title: "พักสายตาเป็นระยะ", description: "แจ้งเตือนให้หยุดมองหน้าจอและพักสายตา", icon: LuClock3, prefix: "ทุก", options: ["20 นาที", "30 นาที", "45 นาที", "60 นาที"], defaultOption: "30 นาที" },
      { id: "20-rule", code: "RULE_20_20_20", title: "ใช้กฎ 20-20-20", description: "มองไกล 20 ฟุต นาน 20 วินาที ตามรูปแบบที่เลือก", icon: LuTimerReset, prefix: "ทุก", options: ["20 นาที", "30 นาที"], defaultOption: "20 นาที", supportsFlexible: true },
      { id: "blink-exercise", code: "BLINK_EXERCISE", title: "ฝึกกะพริบตาให้ครบ", description: "หลับตาเบา ๆ แล้วกะพริบช้า ๆ ตามจำนวนครั้ง", icon: LuSparkles, prefix: "ทุก", options: ["30 นาที", "45 นาที", "60 นาที"], defaultOption: "30 นาที" },
    ],
    benefits: ["เพิ่มความถี่ในการกะพริบตา", "ลดช่วงเวลาที่จ้องหน้าจอต่อเนื่อง", "ช่วยกระจายน้ำตาให้ทั่วผิวตา"],
  },
  {
    id: "eye-strain",
    code: "EYE_STRAIN",
    title: "ลดอาการตาล้าและระคายเคือง",
    description: "ลดความเมื่อยล้าจากการเพ่งหน้าจอเป็นเวลานาน",
    icon: LuSunMedium,
    color: "orange",
    measures: [
      { id: "strain-break", code: "STRAIN_BREAK", title: "พักจากงานที่ใช้สายตา", description: "หยุดงานระยะสั้นและเปลี่ยนจุดโฟกัส", icon: LuClock3, prefix: "ทุก", options: ["30 นาที", "45 นาที", "60 นาที"], defaultOption: "45 นาที" },
      { id: "strain-20-rule", code: "STRAIN_20_20_20", title: "ใช้กฎ 20-20-20", description: "คลายกล้ามเนื้อตาด้วยการมองระยะไกลตามรูปแบบที่เลือก", icon: LuTimerReset, prefix: "ทุก", options: ["20 นาที", "30 นาที"], defaultOption: "20 นาที", supportsFlexible: true },
      { id: "brightness", code: "BRIGHTNESS", title: "ตรวจความสว่างหน้าจอ", description: "เตือนให้ปรับจอให้ใกล้เคียงกับแสงรอบตัว", icon: LuSunMedium, prefix: "ทุก", options: ["2 ชั่วโมง", "3 ชั่วโมง", "4 ชั่วโมง"], defaultOption: "2 ชั่วโมง" },
    ],
    benefits: ["ลดการเพ่งต่อเนื่อง", "ลดความรู้สึกเมื่อยล้าหรือหนักบริเวณดวงตา", "ปรับสภาพแวดล้อมให้สบายตาขึ้น", "ลดความรู้สึกไม่สบายตาหลังใช้งานหน้าจอเป็นเวลานาน"],
  },
  {
    id: "screen-time",
    code: "SCREEN_TIME",
    title: "ลดการใช้งานหน้าจอมากเกินไป",
    description: "ควบคุมเวลาหน้าจอและสร้างช่วงพักที่สม่ำเสมอ",
    icon: LuMonitorOff,
    color: "blue",
    measures: [
      { id: "session-limit", code: "SESSION_LIMIT", title: "จำกัดการใช้งานต่อเนื่อง", description: "เตือนเมื่อใช้งานหน้าจอติดต่อกันนานเกินไป", icon: LuHourglass, prefix: "ทุก", options: ["30 นาที", "45 นาที", "60 นาที", "90 นาที"], defaultOption: "60 นาที" },
      { id: "daily-limit", code: "DAILY_LIMIT", title: "กำหนดเวลาหน้าจอต่อวัน", description: "แจ้งเตือนเมื่อเวลาใช้งานรวมใกล้ถึงเป้าหมาย", icon: LuMonitorOff, prefix: "ไม่เกิน", options: ["4 ชั่วโมง", "6 ชั่วโมง", "8 ชั่วโมง", "10 ชั่วโมง"], defaultOption: "8 ชั่วโมง" },
      { id: "offline-break", code: "OFFLINE_BREAK", title: "กำหนดช่วงพักแบบไม่ใช้หน้าจอ", description: "สร้างช่วงพักสำหรับเดินหรือทำกิจกรรมอื่น", icon: LuMove, prefix: "ทุก", options: ["2 ชั่วโมง", "3 ชั่วโมง", "4 ชั่วโมง"], defaultOption: "2 ชั่วโมง" },
    ],
    benefits: ["ลดเวลาหน้าจอสะสม", "เพิ่มช่วงพักระหว่างวัน", "สร้างพฤติกรรมการใช้หน้าจอที่สมดุลมากขึ้น"],
  },
  {
    id: "dry-eye",
    code: "DRY_EYE",
    title: "ลดอาการตาแห้ง",
    description: "เพิ่มพฤติกรรมที่ช่วยรักษาความชุ่มชื้นของดวงตา",
    icon: LuDroplets,
    color: "green",
    measures: [
      { id: "dry-eye-break", code: "DRY_EYE_BREAK", title: "พักสายตาเป็นระยะ", description: "หยุดมองหน้าจอชั่วครู่เพื่อให้ดวงตาได้พัก", icon: LuClock3, prefix: "ทุก", options: ["20 นาที", "30 นาที", "45 นาที", "60 นาที"], defaultOption: "30 นาที" },
      { id: "dry-20-rule", code: "DRY_20_20_20", title: "ใช้กฎ 20-20-20", description: "มองไกล 20 ฟุต นาน 20 วินาที ตามรูปแบบที่เลือก", icon: LuTimerReset, prefix: "ทุก", options: ["20 นาที", "30 นาที"], defaultOption: "20 นาที", supportsFlexible: true },
    ],
    benefits: ["ช่วยรักษาความชุ่มชื้นของผิวตา", "ลดพฤติกรรมที่ทำให้ตาแห้ง", "เพิ่มการกะพริบตาอย่างสมบูรณ์"],
  },
];

const toInputDate = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toInputDate(date);
};

const numericValue = (setting: string) => Number(setting.match(/\d+/)?.[0] ?? 0);

const toPlanMeasure = (
  measure: Measure,
  frequency: string,
  mode: ReminderMode,
) => {
  const value = numericValue(frequency);

  if (measure.code === "DAILY_LIMIT") {
    return {
      measure_code: measure.code,
      target_value: value,
      target_unit: "HOURS_PER_DAY",
      interval_minutes: null,
      reminder_mode: "SCHEDULED" as const,
      is_enabled: true,
    };
  }

  return {
    measure_code: measure.code,
    target_value: null,
    target_unit: null,
    interval_minutes: frequency.includes("ชั่วโมง") ? value * 60 : value,
    reminder_mode: (measure.supportsFlexible && mode === "flexible" ? "FLEXIBLE" : "SCHEDULED") as "FLEXIBLE" | "SCHEDULED",
    is_enabled: true,
  };
};

type StoredPlan = {
  name?: string;
  goalId?: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  measures?: Array<{ id: string; frequency: string; mode?: ReminderMode }>;
};

const readStoredPlan = (): StoredPlan | null => {
  try {
    const stored = localStorage.getItem("blinkCarePlan");
    if (!stored) return null;
    const plan = JSON.parse(stored) as StoredPlan;
    return plan.goalId && goals.some((item) => item.id === plan.goalId) ? plan : null;
  } catch {
    localStorage.removeItem("blinkCarePlan");
    return null;
  }
};

type PlanProps = {
  onBack?: () => void;
};

export default function Plan({ onBack }: PlanProps) {
  const initialPlan = useMemo(() => readStoredPlan(), []);
  const [name, setName] = useState(initialPlan?.name || "แผนดูแลสุขภาพดวงตา");
  const [goalId, setGoalId] = useState(initialPlan?.goalId || goals[0].id);
  const goal = goals.find((item) => item.id === goalId) ?? goals[0];
  const restoredMeasures = (initialPlan?.measures ?? []).filter((measure) =>
    goal.measures.some((candidate) => candidate.id === measure.id),
  );
  const [selected, setSelected] = useState<Record<string, boolean>>(
    restoredMeasures.length > 0
      ? Object.fromEntries(restoredMeasures.map((measure) => [measure.id, true]))
      : Object.fromEntries(goal.measures.slice(0, 3).map((measure) => [measure.id, true])),
  );
  const [frequencies, setFrequencies] = useState<Record<string, string>>(
    Object.fromEntries(restoredMeasures.map((measure) => [measure.id, measure.frequency])),
  );
  const [reminderModes, setReminderModes] = useState<Record<string, ReminderMode>>(
    Object.fromEntries(restoredMeasures.map((measure) => [
      measure.id,
      measure.mode ?? (["20 นาที", "30 นาที"].includes(measure.frequency) ? "scheduled" : "flexible"),
    ])),
  );
  const [startDate, setStartDate] = useState(initialPlan?.startDate || toInputDate(new Date()));
  const [endDate, setEndDate] = useState(
    initialPlan?.endDate || addDays(initialPlan?.startDate || toInputDate(new Date()), (initialPlan?.duration ?? 7) - 1),
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const GoalIcon = goal.icon;

  const duration = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`).getTime();
    const end = new Date(`${endDate}T00:00:00`).getTime();
    return Math.max(1, Math.round((end - start) / 86_400_000) + 1);
  }, [endDate, startDate]);

  const activeMeasures = goal.measures.filter((measure) => selected[measure.id]);

  const chooseGoal = (id: string) => {
    const nextGoal = goals.find((item) => item.id === id);
    if (!nextGoal) return;
    setGoalId(id);
    setSelected(Object.fromEntries(nextGoal.measures.slice(0, 3).map((measure) => [measure.id, true])));
    setSaved(false);
  };

  const savePlan = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError("");

    const plan = {
      name: name.trim(), goalId, startDate, endDate, duration,
      measures: activeMeasures.map((measure) => ({
        id: measure.id,
        frequency: frequencies[measure.id] ?? (measure.supportsFlexible ? "40 นาที" : measure.defaultOption),
        mode: measure.supportsFlexible ? (reminderModes[measure.id] ?? "flexible") : undefined,
      })),
      savedAt: new Date().toISOString(),
    };

    try {
      const response = await apiFetch("/plans", {
        method: "POST",
        body: JSON.stringify({
          goal_code: goal.code,
          plan_name: name.trim(),
          start_date: startDate,
          end_date: endDate,
          measures: activeMeasures.map((measure) => {
            const mode = reminderModes[measure.id] ?? "flexible";
            const frequency = frequencies[measure.id] ??
              (measure.supportsFlexible ? "40 นาที" : measure.defaultOption);
            return toPlanMeasure(measure, frequency, mode);
          }),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "ไม่สามารถบันทึกแผนได้");
      }

      localStorage.setItem("blinkCarePlan", JSON.stringify(plan));
      window.dispatchEvent(new Event("blinkcare:plan-updated"));
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "ไม่สามารถบันทึกแผนได้");
    } finally {
      setSaving(false);
    }
  };

  const updateStartDate = (value: string) => {
    setStartDate(value);
    if (endDate < value) setEndDate(value);
    setSaved(false);
  };

  const applyDuration = (days: number) => {
    setEndDate(addDays(startDate, days - 1));
    setSaved(false);
  };

  const setReminderMode = (measure: Measure, mode: ReminderMode) => {
    setReminderModes((current) => ({ ...current, [measure.id]: mode }));
    setFrequencies((current) => ({
      ...current,
      [measure.id]: mode === "flexible" ? "40 นาที" : measure.defaultOption,
    }));
    setSaved(false);
  };

  return (
    <section className="plan-page">
      <div className="plan-heading">
        {onBack && <button className="plan-back-button" onClick={onBack} title="กลับไปหน้าแผน"><LuArrowLeft /></button>}
        <div><span className="plan-eyebrow">PERSONAL EYE CARE</span><h1>สร้างแผนปรับปรุงสุขภาพตา</h1><p>เลือกเป้าหมายและมาตรการที่เหมาะกับพฤติกรรมการใช้หน้าจอของคุณ</p></div>
      </div>

      <div className="plan-layout">
        <div className="plan-builder">
          <section className="plan-section">
            <div className="section-number">1</div><div className="section-content"><h2>ตั้งชื่อแผน</h2><label className="field-label" htmlFor="plan-name">ชื่อแผน</label><div className="name-input"><input id="plan-name" maxLength={100} value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} /><span>{name.length}/100</span></div></div>
          </section>

          <section className="plan-section">
            <div className="section-number">2</div><div className="section-content"><h2>เลือกเป้าหมาย</h2><p className="section-description">เลือกสิ่งที่ต้องการปรับปรุงเป็นหลัก</p><div className="goal-grid">{goals.map((item) => { const Icon = item.icon; return <button key={item.id} className={`goal-option ${item.color} ${goalId === item.id ? "selected" : ""}`} onClick={() => chooseGoal(item.id)}><span className="goal-icon"><Icon /></span><span><strong>{item.title}</strong><small>{item.description}</small></span>{goalId === item.id && <LuCheck className="selected-check" />}</button>; })}</div></div>
          </section>

          <section className="plan-section">
            <div className="section-number">3</div><div className="section-content"><h2>เลือกมาตรการในแผน</h2><p className="section-description">เปิดมาตรการและกำหนดเวลาที่ระบบจะช่วยเตือน</p><div className="measure-list">{goal.measures.map((measure) => { const Icon = measure.icon; const enabled = Boolean(selected[measure.id]); const mode = reminderModes[measure.id] ?? "flexible"; const options = measure.supportsFlexible && mode === "flexible" ? ["40 นาที", "50 นาที", "60 นาที"] : measure.options; const prefix = measure.supportsFlexible && mode === "flexible" ? "ต่อเนื่อง" : measure.prefix; return <div className={`measure-row ${enabled ? "enabled" : ""}`} key={measure.id}><label className="measure-check"><input type="checkbox" checked={enabled} onChange={(event) => { setSelected((current) => ({ ...current, [measure.id]: event.target.checked })); setSaved(false); }} /><span><LuCheck /></span></label><span className="measure-icon"><Icon /></span><div className="measure-copy"><strong>{measure.title}</strong><small>{measure.description}</small></div><div className="measure-frequency"><span>{prefix}</span><select disabled={!enabled} value={frequencies[measure.id] ?? (measure.supportsFlexible ? "40 นาที" : measure.defaultOption)} onChange={(event) => { setFrequencies((current) => ({ ...current, [measure.id]: event.target.value })); setSaved(false); }}>{options.map((option) => <option key={option}>{option}</option>)}</select></div><span className={`enabled-label ${enabled ? "on" : ""}`}>{enabled ? "เปิดใช้" : "ปิด"}</span>{measure.supportsFlexible && enabled && <div className="reminder-mode"><span>รูปแบบการเตือน</span><div className="mode-segments"><button className={mode === "flexible" ? "active" : ""} onClick={() => setReminderMode(measure, "flexible")}><strong>ยืดหยุ่น</strong><small>เตือนเมื่อใช้หน้าจอต่อเนื่องนาน</small></button><button className={mode === "scheduled" ? "active" : ""} onClick={() => setReminderMode(measure, "scheduled")}><strong>ตามแผน</strong><small>เตือนตามรอบเวลาที่กำหนด</small></button></div></div>}</div>; })}</div></div>
          </section>

          <section className="plan-section">
            <div className="section-number">4</div><div className="section-content"><h2>ตั้งช่วงเวลาแผน</h2><div className="schedule-row"><label><span className="field-label">เริ่มต้น</span><div className="date-input"><LuCalendarDays /><input type="date" value={startDate} onChange={(event) => updateStartDate(event.target.value)} /></div></label><span className="date-arrow">ถึง</span><label><span className="field-label">สิ้นสุด</span><div className="date-input"><LuCalendarDays /><input type="date" min={startDate} value={endDate} onChange={(event) => { setEndDate(event.target.value); setSaved(false); }} /></div></label><div className="duration-options"><span className="field-label">ทางลัด · รวม {duration} วัน</span><div>{[7, 14, 30].map((days) => <button className={duration === days ? "active" : ""} key={days} onClick={() => applyDuration(days)}>{days} วัน</button>)}</div></div></div></div>
          </section>

          <div className="plan-actions"><button className="secondary-action" onClick={() => { const today = toInputDate(new Date()); setName("แผนดูแลสุขภาพดวงตา"); chooseGoal(goals[0].id); setStartDate(today); setEndDate(addDays(today, 6)); }}>เริ่มใหม่</button><button className="primary-action" disabled={saving || !name.trim() || activeMeasures.length === 0} onClick={() => void savePlan()}><LuSave />{saving ? "กำลังบันทึก..." : "บันทึกแผน"}</button></div>
          {saved && <div className="save-message"><span><LuCheck /> บันทึกแผนลงฐานข้อมูลเรียบร้อยแล้ว</span><button onClick={() => void showPlanNotification("ถึงเวลาพักสายตาแล้ว", "พักสายตาตามแผนที่คุณกำหนดไว้")}>ทดสอบการแจ้งเตือน</button></div>}
          {saveError && <div className="save-message error">{saveError}</div>}
        </div>

        <aside className="plan-preview">
          <div className="preview-title"><span><LuSettings2 /></span><div><small>ตัวอย่างแผนของคุณ</small><strong>{name || "ยังไม่ได้ตั้งชื่อแผน"}</strong></div></div>
          <div className={`preview-goal ${goal.color}`}><GoalIcon /><div><small>เป้าหมาย</small><strong>{goal.title}</strong></div></div>
          <div className="preview-block"><h3>มาตรการในแผน <span>{activeMeasures.length}</span></h3>{activeMeasures.map((measure) => { const Icon = measure.icon; const mode = reminderModes[measure.id] ?? "flexible"; const detail = measure.supportsFlexible ? (mode === "flexible" ? `ยืดหยุ่น · หลังใช้ต่อเนื่อง ${frequencies[measure.id] ?? "40 นาที"}` : `ตามแผน · ทุก ${frequencies[measure.id] ?? measure.defaultOption}`) : `${measure.prefix} ${frequencies[measure.id] ?? measure.defaultOption}`; return <div className="preview-measure" key={measure.id}><Icon /><div><strong>{measure.title}</strong><small>{detail}</small></div></div>; })}{activeMeasures.length === 0 && <p className="preview-empty">เลือกอย่างน้อย 1 มาตรการ</p>}</div>
          <div className="preview-block"><h3>ผลลัพธ์ที่คาดหวัง</h3>{goal.benefits.map((benefit) => <div className="benefit" key={benefit}><LuCheck />{benefit}</div>)}</div>
          <div className="preview-period"><LuCalendarDays /><div><small>ระยะเวลา {duration} วัน</small><strong>{new Date(`${startDate}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })} - {new Date(`${endDate}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}</strong></div></div>
          <p className="plan-note">แผนนี้เป็นเครื่องมือช่วยสร้างพฤติกรรม ไม่ใช่คำแนะนำทางการแพทย์ หากมีอาการผิดปกติต่อเนื่องควรปรึกษาผู้เชี่ยวชาญ</p>
        </aside>
      </div>
    </section>
  );
}

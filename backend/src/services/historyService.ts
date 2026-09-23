import { pool } from "../config/database.js";

export const getHistory = async (userId: number, from: string, to: string) => {
  const params = [userId, from, to];
  const [sessionsResult, remindersResult, thresholdResult, notificationsResult] = await Promise.all([
    pool.query(
      `
      SELECT
        session_id,
        started_at AT TIME ZONE 'UTC' AS started_at,
        ended_at AT TIME ZONE 'UTC' AS ended_at,
        COALESCE(duration_seconds, 0)::INTEGER AS duration_seconds,
        COALESCE(total_blinks, 0)::INTEGER AS total_blinks,
        COALESCE(average_blinks_per_minute, 0)::NUMERIC AS blink_rate,
        ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date AS local_date
      FROM detection_service.detection_session
      WHERE user_id = $1 AND ended_at IS NOT NULL
        AND ((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $2::date AND $3::date
      ORDER BY started_at DESC
      `,
      params,
    ),
    pool.query(
      `
      SELECT
        pre.reminder_event_id,
        pre.triggered_at AT TIME ZONE 'UTC' AS triggered_at,
        pre.responded_at AT TIME ZONE 'UTC' AS responded_at,
        pre.status,
        mt.measure_code,
        mt.measure_name,
        ip.plan_name,
        ((pre.triggered_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date AS local_date
      FROM plan_service.plan_reminder_event pre
      JOIN plan_service.improvement_plan ip ON ip.plan_id = pre.plan_id
      JOIN plan_service.plan_measure pm ON pm.plan_measure_id = pre.plan_measure_id
      JOIN master_data_service.measure_type mt ON mt.measure_type_id = pm.measure_type_id
      WHERE pre.user_id = $1
        AND ((pre.triggered_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Bangkok')::date BETWEEN $2::date AND $3::date
      ORDER BY pre.triggered_at DESC
      `,
      params,
    ),
    pool.query(
      `
      SELECT COALESCE(MIN(pm.interval_minutes), 60)::INTEGER AS continuous_limit_minutes
      FROM plan_service.improvement_plan ip
      JOIN plan_service.plan_measure pm ON pm.plan_id = ip.plan_id
      JOIN master_data_service.measure_type mt ON mt.measure_type_id = pm.measure_type_id
      WHERE ip.user_id = $1 AND pm.is_enabled = TRUE
        AND mt.measure_code = 'SESSION_LIMIT'
        AND ip.start_date <= $3::date AND ip.end_date >= $2::date
      `,
      params,
    ),
    pool.query(
      `SELECT notification_event_id, category, title, body, occurred_at,
          timezone('Asia/Bangkok', occurred_at)::date AS local_date
       FROM notification_service.notification_event
       WHERE user_id = $1
         AND timezone('Asia/Bangkok', occurred_at)::date BETWEEN $2::date AND $3::date
       ORDER BY occurred_at DESC`,
      params,
    ),
  ]);

  const sessions = sessionsResult.rows.map((row) => ({
    id: `session-${row.session_id}`,
    type: "USAGE" as const,
    occurred_at: row.started_at,
    date: row.local_date,
    title: "บันทึกการใช้งานหน้าจอ",
    description: `ตรวจจับ ${Math.round(Number(row.duration_seconds) / 60)} นาที · ${Number(row.total_blinks)} ครั้ง`,
    duration_seconds: Number(row.duration_seconds),
    blink_rate: Number(row.blink_rate),
  }));
  const reminders = remindersResult.rows.map((row) => ({
    id: `reminder-${row.reminder_event_id}`,
    type: "REMINDER" as const,
    occurred_at: row.triggered_at,
    date: row.local_date,
    title: row.measure_name,
    description: `${row.plan_name} · ${row.status === "COMPLETED" ? "ทำสำเร็จ" : row.status === "SKIPPED" ? "ข้าม" : "รอการตอบกลับ"}`,
    status: row.status,
    measure_code: row.measure_code,
  }));
  const notificationEvents = notificationsResult.rows.map((row) => ({
    id: `notification-${row.notification_event_id}`,
    type: "REMINDER" as const,
    occurred_at: row.occurred_at,
    date: row.local_date,
    title: row.title,
    description: row.body,
    category: row.category,
  }));
  const events = [...sessions, ...reminders, ...notificationEvents].sort(
    (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
  );
  const totalSeconds = sessions.reduce((sum, session) => sum + session.duration_seconds, 0);
  const totalBlinks = sessionsResult.rows.reduce((sum, row) => sum + Number(row.total_blinks), 0);
  const activeDates = new Set(sessions.map((session) => String(session.date).slice(0, 10)));
  const dailyMap = new Map<string, { date: string; duration_seconds: number; total_blinks: number; reminders: number }>();

  for (const session of sessions) {
    const date = String(session.date).slice(0, 10);
    const day = dailyMap.get(date) ?? { date, duration_seconds: 0, total_blinks: 0, reminders: 0 };
    day.duration_seconds += session.duration_seconds;
    const source = sessionsResult.rows.find((row) => `session-${row.session_id}` === session.id);
    day.total_blinks += Number(source?.total_blinks ?? 0);
    dailyMap.set(date, day);
  }
  for (const reminder of reminders) {
    const date = String(reminder.date).slice(0, 10);
    const day = dailyMap.get(date) ?? { date, duration_seconds: 0, total_blinks: 0, reminders: 0 };
    day.reminders += 1;
    dailyMap.set(date, day);
  }
  const continuousLimitMinutes = Number(thresholdResult.rows[0]?.continuous_limit_minutes ?? 60);
  const calculatedInterestingEvents = sessionsResult.rows.flatMap((row) => {
    const items = [];
    const blinkRate = Number(row.blink_rate);
    const durationMinutes = Math.round(Number(row.duration_seconds) / 60);
    if (blinkRate > 0 && blinkRate < 12) {
      items.push({
        id: `low-blink-${row.session_id}`,
        type: "LOW_BLINK",
        occurred_at: row.started_at,
        title: "Blink Rate ต่ำกว่าเกณฑ์",
        description: `${blinkRate.toFixed(1)} ครั้ง/นาที · ต่ำกว่าเกณฑ์ 12 ครั้ง/นาที`,
      });
    }
    if (durationMinutes >= continuousLimitMinutes) {
      items.push({
        id: `long-session-${row.session_id}`,
        type: "LONG_SESSION",
        occurred_at: row.started_at,
        title: "ใช้งานหน้าจอต่อเนื่องเกินเวลา",
        description: `${durationMinutes} นาที · เกณฑ์ที่กำหนด ${continuousLimitMinutes} นาที`,
      });
    }
    return items;
  });
  const persistedInterestingEvents = notificationsResult.rows
    .filter((row) => row.category === "LOW_BLINK" || row.category === "LONG_SESSION")
    .map((row) => ({
      id: `notification-${row.notification_event_id}`,
      type: row.category,
      occurred_at: row.occurred_at,
      title: row.title,
      description: row.body,
    }));
  const interestingEvents = [...persistedInterestingEvents, ...calculatedInterestingEvents]
    .filter((event, index, all) => all.findIndex((candidate) =>
      candidate.title === event.title &&
      Math.abs(new Date(candidate.occurred_at).getTime() - new Date(event.occurred_at).getTime()) < 60_000
    ) === index)
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  return {
    from,
    to,
    summary: {
      total_duration_seconds: totalSeconds,
      average_blinks_per_minute: totalSeconds > 0 ? totalBlinks / (totalSeconds / 60) : 0,
      reminder_count: reminders.length + notificationEvents.length,
      active_days: activeDates.size,
    },
    daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).map((day) => ({
      ...day,
      blink_rate: day.duration_seconds > 0 ? day.total_blinks / (day.duration_seconds / 60) : 0,
    })),
    interesting_events: interestingEvents,
    continuous_limit_minutes: continuousLimitMinutes,
    events,
  };
};

import { pool } from "../config/database.js";

export type PlanMeasureInput = {
  measure_code: string;
  target_value: number | null;
  target_unit: string | null;
  interval_minutes: number | null;
  reminder_mode: "FLEXIBLE" | "SCHEDULED";
  is_enabled: boolean;
};

export type CreatePlanInput = {
  user_id: number;
  goal_code: string;
  plan_name: string;
  start_date: string;
  end_date: string;
  measures: PlanMeasureInput[];
};

export const createPlan = async (data: CreatePlanInput) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const goalResult = await client.query(
      `
      SELECT goal_type_id, goal_code, goal_name
      FROM master_data_service.goal_type
      WHERE goal_code = $1 AND is_active = TRUE
      `,
      [data.goal_code],
    );

    if (goalResult.rows.length === 0) {
      throw new Error("Active goal type not found");
    }

    const goal = goalResult.rows[0];
    const measureCodes = [...new Set(data.measures.map((measure) => measure.measure_code))];
    const measureResult = await client.query(
      `
      SELECT measure_type_id, measure_code, measure_name
      FROM master_data_service.measure_type
      WHERE goal_type_id = $1
        AND measure_code = ANY($2::varchar[])
        AND is_active = TRUE
      `,
      [goal.goal_type_id, measureCodes],
    );

    if (measureResult.rows.length !== measureCodes.length) {
      throw new Error("One or more measures do not belong to the selected goal");
    }

    const planResult = await client.query(
      `
      INSERT INTO plan_service.improvement_plan
        (user_id, goal_type_id, plan_name, start_date, end_date, status)
      VALUES ($1, $2, $3, $4::date, $5::date, 'ACTIVE')
      RETURNING plan_id, user_id, goal_type_id, plan_name, start_date, end_date, status, created_at
      `,
      [data.user_id, goal.goal_type_id, data.plan_name, data.start_date, data.end_date],
    );

    const plan = planResult.rows[0];
    const measureTypes = new Map(
      measureResult.rows.map((row) => [row.measure_code, row]),
    );
    const savedMeasures = [];

    for (const measure of data.measures) {
      const measureType = measureTypes.get(measure.measure_code);
      const result = await client.query(
        `
        INSERT INTO plan_service.plan_measure
          (plan_id, measure_type_id, target_value, target_unit, interval_minutes, reminder_mode, is_enabled)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING plan_measure_id, measure_type_id, target_value, target_unit,
                  interval_minutes, reminder_mode, is_enabled
        `,
        [
          plan.plan_id,
          measureType.measure_type_id,
          measure.target_value,
          measure.target_unit,
          measure.interval_minutes,
          measure.reminder_mode,
          measure.is_enabled,
        ],
      );

      savedMeasures.push({
        ...result.rows[0],
        measure_code: measureType.measure_code,
        measure_name: measureType.measure_name,
      });
    }

    await client.query("COMMIT");
    return { ...plan, goal_code: goal.goal_code, goal_name: goal.goal_name, measures: savedMeasures };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getActivePlan = async (userId: number) => {
  const result = await pool.query(
    `
    SELECT
      ip.plan_id,
      ip.plan_name,
      ip.start_date,
      ip.end_date,
      ip.status,
      gt.goal_code,
      gt.goal_name,
      COALESCE(
        json_agg(
          json_build_object(
            'plan_measure_id', pm.plan_measure_id,
            'measure_code', mt.measure_code,
            'measure_name', mt.measure_name,
            'target_value', pm.target_value,
            'target_unit', pm.target_unit,
            'interval_minutes', pm.interval_minutes,
            'reminder_mode', pm.reminder_mode,
            'is_enabled', pm.is_enabled
          ) ORDER BY pm.plan_measure_id
        ) FILTER (
          WHERE pm.plan_measure_id IS NOT NULL
            AND mt.measure_code <> 'LOW_BLINK_ALERT'
        ),
        '[]'::json
      ) AS measures
    FROM plan_service.improvement_plan ip
    JOIN master_data_service.goal_type gt ON gt.goal_type_id = ip.goal_type_id
    LEFT JOIN plan_service.plan_measure pm ON pm.plan_id = ip.plan_id
    LEFT JOIN master_data_service.measure_type mt ON mt.measure_type_id = pm.measure_type_id
    WHERE ip.user_id = $1
      AND ip.status = 'ACTIVE'
      AND CURRENT_DATE BETWEEN ip.start_date AND ip.end_date
    GROUP BY ip.plan_id, gt.goal_code, gt.goal_name
    ORDER BY ip.created_at DESC
    LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
};

export const createReminderEvent = async (
  userId: number,
  planId: number,
  planMeasureId: number,
) => {
  const result = await pool.query(
    `
    INSERT INTO plan_service.plan_reminder_event
      (user_id, plan_id, plan_measure_id, status)
    SELECT $1, ip.plan_id, pm.plan_measure_id, 'PENDING'
    FROM plan_service.improvement_plan ip
    JOIN plan_service.plan_measure pm ON pm.plan_id = ip.plan_id
    WHERE ip.plan_id = $2 AND pm.plan_measure_id = $3 AND ip.user_id = $1
    RETURNING reminder_event_id, status, triggered_at
    `,
    [userId, planId, planMeasureId],
  );
  return result.rows[0] ?? null;
};

export const respondToReminderEvent = async (
  userId: number,
  reminderEventId: number,
  status: "COMPLETED" | "SKIPPED",
) => {
  const result = await pool.query(
    `
    UPDATE plan_service.plan_reminder_event
    SET status = $3, responded_at = CURRENT_TIMESTAMP
    WHERE reminder_event_id = $1 AND user_id = $2 AND status = 'PENDING'
    RETURNING reminder_event_id, status, responded_at
    `,
    [reminderEventId, userId, status],
  );
  return result.rows[0] ?? null;
};

export const getUserPlans = async (userId: number) => {
  const plansResult = await pool.query(
    `
    SELECT
      ip.plan_id,
      ip.plan_name,
      ip.start_date,
      ip.end_date,
      ip.status,
      ip.created_at,
      gt.goal_code,
      gt.goal_name,
      CASE
        WHEN CURRENT_DATE < ip.start_date THEN 'UPCOMING'
        WHEN CURRENT_DATE > ip.end_date THEN 'COMPLETED'
        ELSE ip.status
      END AS effective_status,
      GREATEST(1, (ip.end_date - ip.start_date) + 1)::INTEGER AS total_days,
      CASE
        WHEN CURRENT_DATE < ip.start_date THEN 0
        ELSE LEAST(
          100,
          ROUND(
            (LEAST(CURRENT_DATE, ip.end_date) - ip.start_date + 1)::NUMERIC
            / GREATEST(1, (ip.end_date - ip.start_date) + 1) * 100
          )
        )::INTEGER
      END AS timeline_progress,
      COALESCE(stats.session_count, 0)::INTEGER AS session_count,
      COALESCE(stats.active_seconds, 0)::INTEGER AS active_seconds,
      COALESCE(stats.total_blinks, 0)::INTEGER AS total_blinks,
      COALESCE(stats.session_durations, '[]'::json) AS session_durations,
      COALESCE(stats.used_days, 0)::INTEGER AS used_days,
      COALESCE(reminders.occurred_rounds, 0)::INTEGER AS occurred_rounds,
      COALESCE(reminders.completed_rounds, 0)::INTEGER AS completed_rounds,
      COALESCE(reminders.skipped_rounds, 0)::INTEGER AS skipped_rounds,
      COALESCE(baseline.avg_session_seconds, 0)::NUMERIC AS baseline_avg_session_seconds,
      CASE WHEN COALESCE(stats.active_seconds, 0) > 0
        THEN stats.total_blinks::NUMERIC / (stats.active_seconds::NUMERIC / 60)
        ELSE 0
      END AS average_blinks_per_minute
    FROM plan_service.improvement_plan ip
    JOIN master_data_service.goal_type gt ON gt.goal_type_id = ip.goal_type_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(ds.session_id)::INTEGER AS session_count,
        COALESCE(SUM(ds.duration_seconds), 0) AS active_seconds,
        COALESCE(SUM(ds.total_blinks), 0) AS total_blinks,
        COUNT(DISTINCT ds.started_at::date)::INTEGER AS used_days,
        COALESCE(
          json_agg(ds.duration_seconds ORDER BY ds.started_at)
            FILTER (WHERE ds.session_id IS NOT NULL),
          '[]'::json
        ) AS session_durations
      FROM detection_service.detection_session ds
      WHERE ds.user_id = ip.user_id
        AND ds.ended_at IS NOT NULL
        AND ds.started_at::date BETWEEN ip.start_date AND ip.end_date
    ) stats ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(pre.reminder_event_id)::INTEGER AS occurred_rounds,
        COUNT(pre.reminder_event_id) FILTER (WHERE pre.status = 'COMPLETED')::INTEGER AS completed_rounds,
        COUNT(pre.reminder_event_id) FILTER (WHERE pre.status = 'SKIPPED')::INTEGER AS skipped_rounds
      FROM plan_service.plan_reminder_event pre
      WHERE pre.plan_id = ip.plan_id AND pre.user_id = ip.user_id
    ) reminders ON TRUE
    LEFT JOIN LATERAL (
      SELECT AVG(ds.duration_seconds)::NUMERIC AS avg_session_seconds
      FROM detection_service.detection_session ds
      WHERE ds.user_id = ip.user_id
        AND ds.ended_at IS NOT NULL
        AND ds.started_at::date BETWEEN ip.start_date - 7 AND ip.start_date - 1
    ) baseline ON TRUE
    WHERE ip.user_id = $1
    ORDER BY ip.created_at DESC
    `,
    [userId],
  );

  if (plansResult.rows.length === 0) return [];

  const planIds = plansResult.rows.map((plan) => plan.plan_id);
  const measuresResult = await pool.query(
    `
    SELECT
      pm.plan_id,
      pm.plan_measure_id,
      mt.measure_code,
      mt.measure_name,
      pm.target_value,
      pm.target_unit,
      pm.interval_minutes,
      pm.reminder_mode,
      pm.is_enabled,
      COALESCE(events.occurred_rounds, 0)::INTEGER AS occurred_rounds,
      COALESCE(events.completed_rounds, 0)::INTEGER AS completed_rounds,
      COALESCE(events.skipped_rounds, 0)::INTEGER AS skipped_rounds
    FROM plan_service.plan_measure pm
    JOIN master_data_service.measure_type mt ON mt.measure_type_id = pm.measure_type_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(pre.reminder_event_id)::INTEGER AS occurred_rounds,
        COUNT(pre.reminder_event_id) FILTER (WHERE pre.status = 'COMPLETED')::INTEGER AS completed_rounds,
        COUNT(pre.reminder_event_id) FILTER (WHERE pre.status = 'SKIPPED')::INTEGER AS skipped_rounds
      FROM plan_service.plan_reminder_event pre
      WHERE pre.plan_measure_id = pm.plan_measure_id
    ) events ON TRUE
    WHERE pm.plan_id = ANY($1::bigint[])
      AND mt.measure_code <> 'LOW_BLINK_ALERT'
    ORDER BY pm.plan_measure_id
    `,
    [planIds],
  );
  const dailyResult = await pool.query(
    `
    SELECT
      ip.plan_id,
      CASE WHEN activity.local_date < ip.start_date THEN 'BASELINE' ELSE 'CURRENT' END AS period,
      activity.local_date AS activity_date,
      SUM(activity.duration_seconds)::INTEGER AS active_seconds,
      SUM(activity.total_blinks)::INTEGER AS total_blinks,
      CASE WHEN SUM(activity.duration_seconds) > 0
        THEN SUM(activity.total_blinks)::NUMERIC / (SUM(activity.duration_seconds)::NUMERIC / 60)
        ELSE 0
      END AS blink_rate
    FROM plan_service.improvement_plan ip
    JOIN LATERAL (
      SELECT
        ds.started_at::date AS local_date,
        ds.duration_seconds,
        ds.total_blinks
      FROM detection_service.detection_session ds
      WHERE ds.user_id = ip.user_id AND ds.ended_at IS NOT NULL
    ) activity ON activity.local_date BETWEEN ip.start_date - 7 AND ip.end_date
    WHERE ip.plan_id = ANY($1::bigint[])
    GROUP BY ip.plan_id, period, activity.local_date
    ORDER BY ip.plan_id, activity.local_date
    `,
    [planIds],
  );

  return plansResult.rows.map((plan) => {
    const activeSeconds = Number(plan.active_seconds);
    const dailyMetrics = dailyResult.rows
      .filter((metric) => String(metric.plan_id) === String(plan.plan_id))
      .map((metric) => ({
        period: metric.period,
        date: metric.activity_date,
        active_seconds: Number(metric.active_seconds),
        total_blinks: Number(metric.total_blinks),
        blink_rate: Number(metric.blink_rate),
      }));
    const sessionDurations = (plan.session_durations as Array<number | string>)
      .map(Number)
      .filter((seconds) => Number.isFinite(seconds) && seconds > 0);
    const measures = measuresResult.rows
      .filter((measure) => String(measure.plan_id) === String(plan.plan_id))
      .map((measure) => {
        const intervalMinutes = measure.interval_minutes === null
          ? null
          : Number(measure.interval_minutes);
        const requiresContinuousUse = measure.reminder_mode === "FLEXIBLE"
          || measure.measure_code === "SESSION_LIMIT";
        const estimatedRounds = intervalMinutes
          ? requiresContinuousUse
            ? sessionDurations.reduce(
              (total, seconds) => total + Math.floor(seconds / (intervalMinutes * 60)),
              0,
            )
            : Math.floor(activeSeconds / (intervalMinutes * 60))
          : null;

        return {
          ...measure,
          interval_minutes: intervalMinutes,
          estimated_rounds: estimatedRounds,
        };
      });

    return {
      ...plan,
      total_days: Number(plan.total_days),
      timeline_progress: Number(plan.timeline_progress),
      session_count: Number(plan.session_count),
      active_seconds: activeSeconds,
      total_blinks: Number(plan.total_blinks),
      used_days: Number(plan.used_days),
      occurred_rounds: Number(plan.occurred_rounds),
      completed_rounds: Number(plan.completed_rounds),
      skipped_rounds: Number(plan.skipped_rounds),
      baseline_avg_session_seconds: Number(plan.baseline_avg_session_seconds),
      average_blinks_per_minute: Number(plan.average_blinks_per_minute),
      session_durations: undefined,
      estimated_reminder_rounds: measures.reduce(
        (total, measure) => total + Number(measure.estimated_rounds ?? 0),
        0,
      ),
      daily_metrics: dailyMetrics,
      measures,
    };
  });
};

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
        ) FILTER (WHERE pm.plan_measure_id IS NOT NULL),
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

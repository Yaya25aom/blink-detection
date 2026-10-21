import { Router } from "express";
import { pool } from "../config/database.js";
import { authenticateToken } from "../middleware/authMiddleware.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

const router = Router();
router.use(authenticateToken, requireAdmin);

router.get("/overview", async (_req, res) => {
  try {
    const [users, stats] = await Promise.all([
      pool.query(`SELECT u.user_id, u.user_name, u.email, u.role_user, u.status_active,
          u.created_at, COALESCE(MAX(a.last_login_at), u.created_at) AS last_seen_at,
          COALESCE(MAX(a.last_login_at), u.created_at) < CURRENT_TIMESTAMP - INTERVAL '3 months' AS inactive_3_months
        FROM user_service.users u
        LEFT JOIN auth_service.user_auth a ON a.user_id = u.user_id
        WHERE u.delete_flag = 0
        GROUP BY u.user_id
        ORDER BY last_seen_at DESC, u.user_id DESC`),
      pool.query(`SELECT COUNT(DISTINCT d.user_id)::INTEGER AS tracked_users,
          COUNT(*)::INTEGER AS sessions,
          COALESCE(SUM(d.total_blinks), 0)::BIGINT AS total_blinks,
          COALESCE(SUM(d.duration_seconds), 0)::BIGINT AS duration_seconds
        FROM detection_service.detection_session d
        JOIN user_service.users u ON u.user_id = d.user_id AND u.delete_flag = 0
        WHERE d.ended_at IS NOT NULL AND d.duration_seconds > 0`),
    ]);
    const duration = Number(stats.rows[0].duration_seconds);
    return res.json({
      users: users.rows,
      stats: {
        ...stats.rows[0],
        blink_rate: duration > 0 ? Number(stats.rows[0].total_blinks) * 60 / duration : 0,
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return res.status(500).json({ message: "โหลดข้อมูลแอดมินไม่สำเร็จ" });
  }
});

router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const action = req.body?.action;
  if (!Number.isSafeInteger(id) || id <= 0 || !["suspend", "activate", "delete"].includes(action)) {
    return res.status(400).json({ message: "คำขอไม่ถูกต้อง" });
  }
  if (id === Number(req.user?.user_id)) return res.status(400).json({ message: "จัดการบัญชีตัวเองไม่ได้" });
  try {
    const result = await pool.query(
      `UPDATE user_service.users
       SET status_active = CASE WHEN $2 = 'activate' THEN 'ACTIVE' ELSE 'INACTIVE' END,
           delete_flag = CASE WHEN $2 = 'delete' THEN 1 ELSE delete_flag END,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND delete_flag = 0 AND UPPER(role_user) <> 'ADMIN'
       RETURNING user_id`,
      [id, action],
    );
    if (!result.rows[0]) return res.status(404).json({ message: "ไม่พบบัญชีที่จัดการได้" });
    return res.json({ success: true });
  } catch (error) {
    console.error("Admin user update error:", error);
    return res.status(500).json({ message: "จัดการบัญชีไม่สำเร็จ" });
  }
});

export default router;

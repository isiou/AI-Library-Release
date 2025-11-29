const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../utils/auth");

const router = express.Router();

// 获取活动公告
router.get("/active", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM announcements WHERE is_active = true ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (error) {
    console.error("获取活动公告失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取所有公告
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM announcements ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (error) {
    console.error("获取公告列表失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 创建公告
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, content, type, is_active } = req.body;
    const created_by = req.session.user.username || req.session.user.readerId;

    const result = await db.query(
      "INSERT INTO announcements (title, content, type, is_active, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [
        title,
        content,
        type || "info",
        is_active !== undefined ? is_active : true,
        created_by,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("创建公告失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 更新公告
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type, is_active } = req.body;

    const result = await db.query(
      "UPDATE announcements SET title = $1, content = $2, type = $3, is_active = $4 WHERE id = $5 RETURNING *",
      [title, content, type, is_active, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "公告不存在" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("更新公告失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 删除公告
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      "DELETE FROM announcements WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "公告不存在" });
    }

    res.json({ message: "公告已删除" });
  } catch (error) {
    console.error("删除公告失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;

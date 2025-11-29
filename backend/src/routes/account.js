const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const router = express.Router();

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "未登录" });
  }
  next();
};

// 获取用户账号信息
router.get("/", requireAuth, async (req, res) => {
  try {
    const { readerId } = req.session.user;

    const query = `
    SELECT r.reader_id, r.gender, r.enroll_year, r.reader_type, r.department, l.nickname, l.is_admin
    FROM readers r
    LEFT JOIN login_info l ON r.reader_id = l.reader_id
    WHERE r.reader_id = $1
    `;

    const { rows } = await db.query(query, [readerId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "用户不存在" });
    }

    const user = rows[0];
    res.json({
      readerId: user.reader_id,
      gender: user.gender,
      enrollYear: user.enroll_year,
      readerType: user.reader_type,
      department: user.department,
      nickname: user.nickname || user.reader_id,
      isAdmin: user.is_admin || false,
    });
  } catch (error) {
    console.error("账号获取失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 更新用户账号信息
router.put("/", requireAuth, async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const allowedFields = ["nickname", "gender"];

    // 过滤允许更新的字段
    const updateFields = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    }

    // 检查是否有不允许的字段
    const invalidFields = Object.keys(req.body).filter(
      (field) => !allowedFields.includes(field),
    );
    if (invalidFields.length > 0)
      return res.status(400).json({
        message: "存在不允许更新的字段",
      });

    // 检查是否有要更新的字段
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: "未更新字段" });
    }

    const updateQueries = [];
    const queryParams = [];

    // 构建更新查询
    if (updateFields.gender) {
      updateQueries.push(`UPDATE readers SET gender = $1 WHERE reader_id = $2`);
      queryParams.push([updateFields.gender, readerId]);
    }
    if (updateFields.nickname) {
      updateQueries.push(
        `UPDATE login_info SET nickname = $1 WHERE reader_id = $2`,
      );
      queryParams.push([updateFields.nickname, readerId]);
    }

    // 执行查询
    for (let i = 0; i < updateQueries.length; i++) {
      await db.query(updateQueries[i], queryParams[i]);
    }

    // 更新 Session
    if (updateFields.gender) {
      req.session.user.gender = updateFields.gender;
    }
    if (updateFields.nickname) {
      req.session.user.nickname = updateFields.nickname;
    }
    res.json({ message: "用户信息修改成功" });
  } catch (error) {
    console.error("用户信息修改失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 修改密码
router.put("/password", requireAuth, async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "新密码与旧密码相同" });
    }

    // 获取当前密码信息
    const userQuery = `
    SELECT l.salt, l.password, r.reader_id
    FROM readers r
    LEFT JOIN login_info l ON r.reader_id = l.reader_id
    WHERE r.reader_id = $1
    `;

    const { rows } = await db.query(userQuery, [readerId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "找不到用户" });
    }

    const user = rows[0];

    // 验证当前密码
    let isValidPassword = false;
    if (user.salt && user.password) {
      isValidPassword = await bcrypt.compare(currentPassword, user.password);
    } else {
      isValidPassword = currentPassword === readerId;
    }

    if (!isValidPassword) {
      return res.status(400).json({ message: "密码验证失败" });
    }

    // 生成新密码哈希
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 构建更新密码查询
    const updateQuery = `
    INSERT INTO login_info (reader_id, salt, password)
    VALUES ($3, $1, $2)
    ON CONFLICT (reader_id)
    DO UPDATE SET salt = $1, password = $2`;

    // 执行查询
    await db.query(updateQuery, [salt, hashedPassword, readerId]);

    try {
      if (req.body) {
        delete req.body.currentPassword;
        delete req.body.newPassword;
      }
      if (req.sanitizedBody) {
        req.sanitizedBody.currentPassword = "[REDACTED]";
        req.sanitizedBody.newPassword = "[REDACTED]";
      }
    } catch (error) {
      console.error("请求体脱敏失败\n", error);
    }
    res.json({ message: "密码修改成功" });
  } catch (error) {
    console.error("密码修改失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 用户借阅信息统计
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const { readerId } = req.session.user;

    // 当前借阅数量
    const currentBorrowsResult = await db.query(
      `SELECT COUNT(*) AS count FROM borrow_records WHERE reader_id = $1 AND status IN ('borrowed', '借阅中')`,
      [readerId],
    );

    // 总借阅数量
    const totalBorrowsResult = await db.query(
      `SELECT COUNT(*) AS count FROM borrow_records WHERE reader_id = $1`,
      [readerId],
    );

    // 逾期数量
    const overdueResult = await db.query(
      `SELECT COUNT(*) AS count FROM borrow_records WHERE reader_id = $1 AND (status IN ('overdue', '逾期归还') OR (status IN ('borrowed', '借阅中') AND due_date < CURRENT_DATE))`,
      [readerId],
    );

    // 已采纳的推荐数量
    let acceptedRecommendations = 0;
    try {
      const acceptedRes = await db.query(
        `SELECT COUNT(*) AS count FROM recommendation_accepts WHERE reader_id = $1`,
        [readerId],
      );
      acceptedRecommendations = parseInt(acceptedRes.rows[0]?.count || 0);
    } catch (error) {
      acceptedRecommendations = 0;
    }

    res.json({
      currentBorrows: parseInt(currentBorrowsResult.rows[0].count || 0),
      totalBorrows: parseInt(totalBorrowsResult.rows[0].count || 0),
      overdueCount: parseInt(overdueResult.rows[0].count || 0),
      acceptedRecommendations,
    });
  } catch (error) {
    console.error("帐号状态获取失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;

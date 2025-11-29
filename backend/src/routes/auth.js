const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

// 用户登录
router.post("/login", async (req, res) => {
  try {
    const { readerId, password } = req.body;

    if (!readerId || !password) {
      return res.status(400).json({ message: "缺少账号或密码" });
    }

    // 查询用户信息
    const userQuery = `
      SELECT r.reader_id, r.gender, r.enroll_year, r.reader_type, r.department,
             l.salt, l.password, l.is_admin, l.nickname
      FROM readers r
      LEFT JOIN login_info l ON r.reader_id = l.reader_id
      WHERE r.reader_id = $1
    `;

    const { rows } = await db.query(userQuery, [readerId]);

    if (rows.length === 0) {
      return res.status(401).json({ message: "账号或密码错误" });
    }

    const user = rows[0];
    let isValidPassword = false;

    // 验证密码
    if (user.salt && user.password) {
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      // 首次登录
      const dbReaderId = String(user.reader_id).trim();
      const expectedHash = crypto
        .createHash("sha256")
        .update(dbReaderId)
        .digest("hex");

      isValidPassword = password.toLowerCase() === expectedHash.toLowerCase();

      if (isValidPassword) {
        try {
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);
          const nickname = user.reader_id;

          await db.query(
            `INSERT INTO login_info (reader_id, nickname, salt, password)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (reader_id)
             DO UPDATE SET salt = EXCLUDED.salt, password = EXCLUDED.password`,
            [user.reader_id, nickname, salt, hashedPassword],
          );
        } catch (error) {
          // 安全性保护不显示错误
        }
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({ message: "账号或密码错误" });
    }

    // 更新登录时间
    await db.query(
      "UPDATE login_info SET login_time = CURRENT_TIMESTAMP WHERE reader_id = $1",
      [readerId],
    );

    // 敏感字段清理
    try {
      if (req.body?.password) delete req.body.password;
      if (req.sanitizedBody?.password)
        req.sanitizedBody.password = "[REDACTED]";
    } catch (e) {}

    // 设置 Session
    req.session.user = {
      readerId: user.reader_id,
      gender: user.gender,
      enrollYear: user.enroll_year,
      readerType: user.reader_type,
      department: user.department,
      isAdmin: user.is_admin || false,
      nickname: user.nickname || user.reader_id,
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session 创建失败\n", err);
        return res.status(500).json({ message: "登录失败" });
      }

      res.json({
        message: "登录成功",
        user: req.session.user,
        sessionId: req.sessionID,
      });
    });
  } catch (error) {
    console.error("登录失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 用户注册
router.post("/register", async (req, res) => {
  try {
    const {
      readerId,
      password,
      nickname,
      gender,
      enrollYear,
      readerType,
      department,
    } = req.body;

    if (!readerId || !password) {
      return res.status(400).json({ message: "缺少账号或密码" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    await db.query("BEGIN");

    await db.query(
      "INSERT INTO readers (reader_id, gender, enroll_year, reader_type, department) VALUES ($1, $2, $3, $4, $5)",
      [readerId, gender, enrollYear, readerType, department],
    );

    await db.query(
      "INSERT INTO login_info (reader_id, nickname, salt, password) VALUES ($1, $2, $3, $4)",
      [readerId, nickname || readerId, salt, hashedPassword],
    );

    await db.query("COMMIT");

    // 敏感字段清理
    try {
      if (req.body?.password) delete req.body.password;
      if (req.sanitizedBody?.password)
        req.sanitizedBody.password = "[REDACTED]";
    } catch (e) {}

    res.status(201).json({ message: "注册成功" });
  } catch (error) {
    await db.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(409).json({ message: "用户已存在" });
    }
    console.error("注册失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 用户登出
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("登出失败\n", err);
      return res.status(500).json({ message: "登出失败" });
    }
    res.json({ message: "登出成功" });
  });
});

// 检查会话状态
router.get("/session", (req, res) => {
  if (req.session && req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({
      message: "未登录",
      sessionId: req.sessionID,
      hasSession: !!req.session,
    });
  }
});

module.exports = router;

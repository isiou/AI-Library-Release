const express = require("express");
const multer = require("multer");
const { format, parse } = require("fast-csv");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../db");
const { STATUS, toCanonical, toZh } = require("../utils/status");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// 认证中间件
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: "需要认证" });
  }
  next();
};

// 管理员权限中间件
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.session.user.readerId;
    const result = await db.query(
      "SELECT is_admin FROM login_info WHERE reader_id = $1",
      [userId],
    );
    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ message: "需要管理员权限" });
    }
    next();
  } catch (error) {
    console.error("权限检查失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
};

// 应用中间件
router.use(requireAuth, requireAdmin);

// 获取学生列表
router.get("/students", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", department = "" } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereConditions.push(
        `(r.reader_id ILIKE $${paramCount} OR COALESCE(l.nickname, '') ILIKE $${paramCount})`,
      );
      queryParams.push(`%${search}%`);
    }

    if (department) {
      paramCount++;
      whereConditions.push(`r.department = $${paramCount}`);
      queryParams.push(department);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

    // 查询数据
    const dataQuery = `
    SELECT r.*, l.nickname, COALESCE(l.is_admin, false) as is_admin
    FROM readers r
    LEFT JOIN login_info l ON r.reader_id = l.reader_id
    ${whereClause}
    ORDER BY r.reader_id
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    const queryArgs = [...queryParams, parseInt(limit), parseInt(offset)];
    const result = await db.query(dataQuery, queryArgs);

    // 查询总数
    const countQuery = `
    SELECT COUNT(*)
    FROM readers r
    LEFT JOIN login_info l ON r.reader_id = l.reader_id
    ${whereClause}
    `;
    const totalResult = await db.query(countQuery, queryParams);

    res.json({
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalResult.rows[0].count),
      },
    });
  } catch (error) {
    console.error("获取学生列表失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取 CSV 模板
router.get("/students/csv-template", (req, res) => {
  try {
    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("students_template.csv");
    const bom = "\ufeff";
    const content = "reader_id,gender,enroll_year,reader_type,department\n";
    res.send(bom + content);
  } catch (error) {
    console.error("获取CSV模板失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取单个学生信息
router.get("/students/:id", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, l.nickname
       FROM readers r
       JOIN login_info l ON r.reader_id = l.reader_id
       WHERE r.reader_id = $1`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "未找到学生" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("获取学生详情失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 创建学生
router.post("/students", async (req, res) => {
  try {
    let {
      reader_id,
      gender,
      enroll_year,
      reader_type,
      department,
      nickname,
      password,
    } = req.body;

    // 设置默认值
    if (!nickname) nickname = reader_id;
    if (!password) password = reader_id;

    await db.query("BEGIN");

    await db.query(
      "INSERT INTO readers (reader_id, gender, enroll_year, reader_type, department) VALUES ($1, $2, $3, $4, $5)",
      [reader_id, gender, enroll_year, reader_type, department],
    );

    // 密码处理
    const sha256Password = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(sha256Password, salt);

    await db.query(
      "INSERT INTO login_info (reader_id, nickname, salt, password) VALUES ($1, $2, $3, $4)",
      [reader_id, nickname, salt, hashedPassword],
    );

    await db.query("COMMIT");

    // 脱敏处理
    try {
      if (req.body && req.body.password) delete req.body.password;
      if (req.sanitizedBody && req.sanitizedBody.password)
        req.sanitizedBody.password = "[REDACTED]";
    } catch (e) {}

    res.status(201).json({ message: "读者已创建" });
  } catch (error) {
    await db.query("ROLLBACK");
    if (error.code === "23505") {
      return res.status(400).json({ message: "该读者已存在" });
    }
    console.error("创建学生失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 更新学生信息
router.put("/students/:id", async (req, res) => {
  try {
    const { gender, enroll_year, reader_type, department, nickname } = req.body;

    await db.query("BEGIN");

    await db.query(
      "UPDATE readers SET gender=$1, enroll_year=$2, reader_type=$3, department=$4 WHERE reader_id=$5",
      [gender, enroll_year, reader_type, department, req.params.id],
    );

    await db.query(
      `INSERT INTO login_info (reader_id, nickname)
       VALUES ($1, $2)
       ON CONFLICT (reader_id)
       DO UPDATE SET nickname = EXCLUDED.nickname`,
      [req.params.id, nickname],
    );

    await db.query("COMMIT");
    res.json({ message: "读者已更新" });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("更新学生失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 删除学生
router.delete("/students/:id", async (req, res) => {
  try {
    await db.query("BEGIN");

    const tables = [
      "ai_usage_stats",
      "ai_user_preferences",
      "recommendation_history",
      "message_feedback",
      "chat_sessions",
      "borrow_records",
      "login_info",
      "readers",
    ];

    for (const table of tables) {
      await db.query(`DELETE FROM ${table} WHERE reader_id = $1`, [
        req.params.id,
      ]);
    }

    await db.query("COMMIT");
    res.json({ message: "读者已删除" });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("删除学生失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 重置学生密码
router.post("/students/:id/reset-password", async (req, res) => {
  try {
    const { newPassword } = req.body;

    const sha256Password = crypto
      .createHash("sha256")
      .update(newPassword)
      .digest("hex");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(sha256Password, salt);

    await db.query(
      "UPDATE login_info SET password = $1, salt = $2 WHERE reader_id = $3",
      [hashedPassword, salt, req.params.id],
    );

    try {
      if (req.body && req.body.newPassword) delete req.body.newPassword;
      if (req.sanitizedBody && req.sanitizedBody.newPassword)
        req.sanitizedBody.newPassword = "[REDACTED]";
    } catch (e) {}

    res.json({ message: "密码已重置" });
  } catch (error) {
    console.error("重置密码失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 导入学生数据
router.post("/students/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "未获取到文件" });
  }

  const students = [];
  fs.createReadStream(req.file.path)
    .pipe(parse({ headers: true }))
    .on("error", (error) => {
      console.error("CSV解析错误\n", error);
      res.status(500).json({ message: "文件解析失败" });
    })
    .on("data", (row) => students.push(row))
    .on("end", async () => {
      const client = await db.getClient();
      let successCount = 0;
      let failCount = 0;
      const errors = [];

      try {
        await client.query("BEGIN");
        for (const student of students) {
          try {
            const { reader_id, gender, enroll_year, reader_type, department } =
              student;

            if (!reader_id) {
              throw new Error("缺少 reader_id 字段");
            }

            const sha256Password = crypto
              .createHash("sha256")
              .update(reader_id)
              .digest("hex");
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(sha256Password, salt);

            await client.query(
              "INSERT INTO readers (reader_id, gender, enroll_year, reader_type, department) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (reader_id) DO NOTHING",
              [
                reader_id,
                gender || null,
                enroll_year || null,
                reader_type || null,
                department || null,
              ],
            );

            await client.query(
              `INSERT INTO login_info (reader_id, nickname, salt, password)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (reader_id) DO NOTHING`,
              [reader_id, reader_id, salt, hashedPassword],
            );

            successCount++;
          } catch (rowErr) {
            failCount++;
            errors.push({
              row: successCount + failCount,
              message: rowErr.message,
            });
          }
        }
        await client.query("COMMIT");

        res.status(201).json({
          data: {
            success: true,
            message: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
            stats: {
              total: successCount + failCount,
              success: successCount,
              failed: failCount,
            },
            errors,
          },
        });
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("导入学生失败\n", error);
        res.status(500).json({
          data: { success: false, message: "导入学生时出错: " + error.message },
        });
      } finally {
        client.release();
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      }
    });
});

// 获取当前管理员信息
router.get("/info", (req, res) => {
  res.json(req.session.user);
});

// 获取所有院系
router.get("/departments", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT DISTINCT department FROM readers WHERE department IS NOT NULL AND department != '' ORDER BY department",
    );
    res.json(result.rows.map((row) => row.department));
  } catch (error) {
    console.error("获取院系失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取基础统计信息
router.get("/stats", async (req, res) => {
  try {
    const [readersCount, booksCount, borrowsCount] = await Promise.all([
      db.query("SELECT COUNT(*) FROM readers"),
      db.query("SELECT COUNT(*) FROM books"),
      db.query("SELECT COUNT(*) FROM borrow_records"),
    ]);

    res.json({
      readers: readersCount.rows[0].count,
      books: booksCount.rows[0].count,
      borrows: borrowsCount.rows[0].count,
    });
  } catch (error) {
    console.error("获取统计信息失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取借阅记录
router.get("/borrows", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT br.*, b.title, r.reader_id, l.nickname FROM borrow_records br
             JOIN books b ON br.book_id = b.book_id
             JOIN readers r ON br.reader_id = r.reader_id
             JOIN login_info l ON r.reader_id = l.reader_id
             WHERE b.title ILIKE $1 OR r.reader_id ILIKE $1 OR l.nickname ILIKE $1
             ORDER BY br.borrow_date DESC
             LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset],
    );

    const totalResult = await db.query("SELECT COUNT(*) FROM borrow_records");

    const normalized = result.rows.map((row) => ({
      ...row,
      status: toCanonical(row.status) || row.status,
    }));

    res.json({
      data: normalized,
      pagination: { page, limit, total: totalResult.rows[0].count },
    });
  } catch (error) {
    console.error("获取借阅记录失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取借阅统计
router.get("/borrows/stats", async (req, res) => {
  try {
    const [totalBorrows, currentBorrows, overdueBorrows] = await Promise.all([
      db.query("SELECT COUNT(*) FROM borrow_records"),
      db.query(
        "SELECT COUNT(*) FROM borrow_records WHERE status IN ('borrowed', '借阅中')",
      ),
      db.query(
        "SELECT COUNT(*) FROM borrow_records WHERE status IN ('overdue', '逾期归还') OR (status IN ('borrowed', '借阅中') AND due_date < CURRENT_DATE)",
      ),
    ]);

    res.json({
      total: totalBorrows.rows[0].count,
      current: currentBorrows.rows[0].count,
      overdue: overdueBorrows.rows[0].count,
    });
  } catch (error) {
    console.error("获取借阅统计失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 更新借阅记录
router.put("/borrows/:id", async (req, res) => {
  try {
    const borrowId = req.params.id;
    const { status, return_date } = req.body;

    const canonical = toCanonical(status);
    const validStatuses = [STATUS.BORROWED, STATUS.RETURNED, STATUS.OVERDUE];

    if (!canonical || !validStatuses.includes(canonical)) {
      return res.status(400).json({
        message: "无效状态，必须是 borrowed, returned, overdue 中的一个",
      });
    }

    const { rows } = await db.query(
      "SELECT * FROM borrow_records WHERE borrow_id = $1",
      [borrowId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "未找到借阅记录" });
    }

    let updateQuery = "UPDATE borrow_records SET status = $1";
    let queryParams = [toZh(canonical) || canonical];

    if (status === "returned" && return_date) {
      updateQuery += ", return_date = $2";
      queryParams.push(return_date);
    }

    updateQuery +=
      " WHERE borrow_id = $" + (queryParams.length + 1) + " RETURNING *";
    queryParams.push(borrowId);

    const updateResult = await db.query(updateQuery, queryParams);

    res.json({
      message: "借阅记录更新成功",
      record: updateResult.rows[0],
    });
  } catch (error) {
    console.error("更新借阅记录失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取管理员列表
router.get("/admins", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.reader_id, l.nickname FROM login_info l
             JOIN readers r ON l.reader_id = r.reader_id
             WHERE l.is_admin = true`,
    );
    res.json(result.rows);
  } catch (error) {
    console.error("获取管理员列表失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 设置/取消管理员
router.post("/admins/:id", async (req, res) => {
  try {
    const { makeAdmin } = req.body;
    const readerId = String(req.params.id || "").trim();

    if (!readerId) {
      return res.status(400).json({ message: "无效的用户 ID" });
    }

    const readerResult = await db.query(
      "SELECT reader_id FROM readers WHERE reader_id = $1",
      [readerId],
    );

    if (readerResult.rows.length === 0) {
      return res.status(404).json({ message: "读者不存在" });
    }

    const loginCheck = await db.query(
      "SELECT reader_id FROM login_info WHERE reader_id = $1",
      [readerId],
    );

    let affected;
    if (loginCheck.rows.length > 0) {
      affected = await db.query(
        "UPDATE login_info SET is_admin = $1 WHERE reader_id = $2 RETURNING reader_id, is_admin",
        [!!makeAdmin, readerId],
      );
    } else {
      const sha256Password = crypto
        .createHash("sha256")
        .update(readerId)
        .digest("hex");
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(sha256Password, salt);
      affected = await db.query(
        "INSERT INTO login_info (reader_id, nickname, salt, password, is_admin) VALUES ($1, $2, $3, $4, $5) RETURNING reader_id, is_admin",
        [readerId, readerId, salt, hashedPassword, !!makeAdmin],
      );
    }

    if (affected.rows.length === 0) {
      return res.status(500).json({ message: "更新失败，未找到目标记录" });
    }

    const row = affected.rows[0];
    res.json({
      data: {
        success: true,
        message: row.is_admin ? "已设为管理员" : "已取消管理员权限",
        reader_id: row.reader_id,
        is_admin: row.is_admin,
      },
    });
  } catch (error) {
    console.error("设置管理员失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取导入历史
router.get("/import/history", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM import_history ORDER BY created_at DESC LIMIT 50",
    );
    res.json({
      data: {
        imports: result.rows,
      },
    });
  } catch (error) {
    console.error("获取导入历史失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 预览导入数据
router.post("/import/preview", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "未上传文件" });
  }

  try {
    const preview = [];
    fs.createReadStream(req.file.path)
      .pipe(
        parse({
          headers: (headers) => headers.map((h) => h.replace(/^\ufeff/, "")),
        }),
      )
      .on("data", (row) => {
        if (preview.length < 10) {
          preview.push(row);
        }
      })
      .on("end", () => {
        fs.unlinkSync(req.file.path);
        res.json({
          data: {
            preview: preview,
          },
        });
      })
      .on("error", (error) => {
        fs.unlinkSync(req.file.path);
        console.error("文件解析失败\n", error);
        res.status(500).json({ message: "文件解析失败: " + error.message });
      });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("预览导入失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 执行数据导入
router.post("/import/data", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "未上传文件" });
  }

  try {
    const { type, config } = req.body;
    const importConfig = config ? JSON.parse(config) : {};

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    if (type === "books") {
      const client = await db.getClient();
      try {
        await client.query("BEGIN");

        const rows = [];
        fs.createReadStream(req.file.path)
          .pipe(
            parse({
              headers: (headers) =>
                headers.map((h) => h.replace(/^\ufeff/, "")),
            }),
          )
          .on("data", (row) => rows.push(row))
          .on("end", async () => {
            try {
              for (const row of rows) {
                try {
                  const {
                    book_id,
                    title,
                    author,
                    publisher,
                    publication_year,
                    call_no,
                    language,
                    doc_type,
                  } = row;

                  if (importConfig.update_existing) {
                    await client.query(
                      `INSERT INTO books (book_id, title, author, publisher, publication_year, call_no, language, doc_type)
                       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                       ON CONFLICT (book_id) DO UPDATE SET
                       title = $2, author = $3, publisher = $4, publication_year = $5, call_no = $6, language = $7, doc_type = $8`,
                      [
                        book_id,
                        title,
                        author,
                        publisher,
                        publication_year,
                        call_no,
                        language,
                        doc_type,
                      ],
                    );
                  } else {
                    await client.query(
                      "INSERT INTO books (book_id, title, author, publisher, publication_year, call_no, language, doc_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (book_id) DO NOTHING",
                      [
                        book_id,
                        title,
                        author,
                        publisher,
                        publication_year,
                        call_no,
                        language,
                        doc_type,
                      ],
                    );
                  }
                  successCount++;
                } catch (error) {
                  failCount++;
                  errors.push({
                    row: successCount + failCount,
                    message: error.message,
                  });
                  if (!importConfig.skip_errors) {
                    throw error;
                  }
                }
              }

              const status =
                failCount === 0
                  ? "success"
                  : successCount === 0
                    ? "failed"
                    : "partial";
              await client.query(
                "INSERT INTO import_history (type, filename, status, total_count, success_count, error_count, errors) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [
                  type,
                  req.file.originalname,
                  status,
                  successCount + failCount,
                  successCount,
                  failCount,
                  JSON.stringify(errors),
                ],
              );

              await client.query("COMMIT");
              client.release();
              fs.unlinkSync(req.file.path);

              res.json({
                data: {
                  success: true,
                  message: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
                  stats: {
                    total: successCount + failCount,
                    success: successCount,
                    failed: failCount,
                  },
                },
              });
            } catch (error) {
              await client.query("ROLLBACK");
              client.release();
              fs.unlinkSync(req.file.path);
              console.error("导入书籍处理失败\n", error);
              res.status(500).json({
                data: {
                  success: false,
                  message: "导入失败: " + error.message,
                },
              });
            }
          })
          .on("error", async (error) => {
            await client.query("ROLLBACK");
            client.release();
            fs.unlinkSync(req.file.path);
            console.error("导入书籍流错误\n", error);
            res.status(500).json({
              data: {
                success: false,
                message: "导入失败: " + error.message,
              },
            });
          });
      } catch (error) {
        await client.query("ROLLBACK");
        client.release();
        throw error;
      }
    } else if (type === "users") {
      const client = await db.getClient();
      try {
        await client.query("BEGIN");

        const rows = [];
        fs.createReadStream(req.file.path)
          .pipe(
            parse({
              headers: (headers) =>
                headers.map((h) => h.replace(/^\ufeff/, "")),
            }),
          )
          .on("data", (row) => rows.push(row))
          .on("end", async () => {
            try {
              for (const row of rows) {
                try {
                  const {
                    reader_id,
                    gender,
                    enroll_year,
                    reader_type,
                    department,
                  } = row;

                  if (!reader_id) {
                    throw new Error("缺少 reader_id 字段");
                  }

                  const sha256Password = crypto
                    .createHash("sha256")
                    .update(reader_id)
                    .digest("hex");
                  const salt = await bcrypt.genSalt(10);
                  const hashedPassword = await bcrypt.hash(
                    sha256Password,
                    salt,
                  );

                  if (importConfig.update_existing) {
                    await client.query(
                      `INSERT INTO readers (reader_id, gender, enroll_year, reader_type, department)
                       VALUES ($1, $2, $3, $4, $5)
                       ON CONFLICT (reader_id) DO UPDATE SET
                       gender = EXCLUDED.gender,
                       enroll_year = EXCLUDED.enroll_year,
                       reader_type = EXCLUDED.reader_type,
                       department = EXCLUDED.department`,
                      [
                        reader_id,
                        gender || null,
                        enroll_year || null,
                        reader_type || null,
                        department || null,
                      ],
                    );
                  } else {
                    await client.query(
                      `INSERT INTO readers (reader_id, gender, enroll_year, reader_type, department)
                       VALUES ($1, $2, $3, $4, $5)
                       ON CONFLICT (reader_id) DO NOTHING`,
                      [
                        reader_id,
                        gender || null,
                        enroll_year || null,
                        reader_type || null,
                        department || null,
                      ],
                    );
                  }

                  await client.query(
                    `INSERT INTO login_info (reader_id, nickname, salt, password)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (reader_id) DO NOTHING`,
                    [reader_id, reader_id, salt, hashedPassword],
                  );

                  successCount++;
                } catch (rowErr) {
                  failCount++;
                  errors.push({
                    row: successCount + failCount,
                    message: rowErr.message,
                  });
                  if (!importConfig.skip_errors) {
                    throw rowErr;
                  }
                }
              }

              const status =
                failCount === 0
                  ? "success"
                  : successCount === 0
                    ? "failed"
                    : "partial";
              await client.query(
                "INSERT INTO import_history (type, filename, status, total_count, success_count, error_count, errors) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [
                  type,
                  req.file.originalname,
                  status,
                  successCount + failCount,
                  successCount,
                  failCount,
                  JSON.stringify(errors),
                ],
              );

              await client.query("COMMIT");
              client.release();
              fs.unlinkSync(req.file.path);

              res.json({
                data: {
                  success: true,
                  message: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
                  stats: {
                    total: successCount + failCount,
                    success: successCount,
                    failed: failCount,
                  },
                },
              });
            } catch (error) {
              await client.query("ROLLBACK");
              client.release();
              fs.unlinkSync(req.file.path);
              console.error("导入用户处理失败\n", error);
              res.status(500).json({
                data: { success: false, message: "导入失败: " + error.message },
              });
            }
          })
          .on("error", async (error) => {
            await client.query("ROLLBACK");
            client.release();
            fs.unlinkSync(req.file.path);
            console.error("导入用户流错误\n", error);
            res.status(500).json({
              data: { success: false, message: "导入失败: " + error.message },
            });
          });
      } catch (error) {
        await client.query("ROLLBACK");
        client.release();
        throw error;
      }
    } else if (type === "borrows") {
      const client = await db.getClient();
      try {
        await client.query("BEGIN");

        const rows = [];
        fs.createReadStream(req.file.path)
          .pipe(
            parse({
              headers: (headers) =>
                headers.map((h) => h.replace(/^\ufeff/, "")),
            }),
          )
          .on("data", (row) => rows.push(row))
          .on("end", async () => {
            try {
              for (const row of rows) {
                try {
                  const {
                    borrow_id,
                    reader_id,
                    book_id,
                    borrow_date,
                    due_date,
                    return_date,
                    status,
                  } = row;

                  if (!borrow_id || !reader_id || !book_id) {
                    throw new Error("缺少必填字段");
                  }

                  let canonical = toCanonical(status);
                  if (!canonical) {
                    if (return_date) {
                      canonical = STATUS.RETURNED;
                    } else if (due_date && new Date(due_date) < new Date()) {
                      canonical = STATUS.OVERDUE;
                    } else {
                      canonical = STATUS.BORROWED;
                    }
                  }
                  const dbStatus = toZh(canonical) || canonical;

                  const params = [
                    borrow_id,
                    reader_id,
                    book_id,
                    borrow_date || null,
                    due_date || null,
                    return_date || null,
                    dbStatus,
                  ];

                  if (importConfig.update_existing) {
                    await client.query(
                      `INSERT INTO borrow_records (borrow_id, reader_id, book_id, borrow_date, due_date, return_date, status)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)
                       ON CONFLICT (borrow_id) DO UPDATE SET
                       reader_id = EXCLUDED.reader_id,
                       book_id = EXCLUDED.book_id,
                       borrow_date = EXCLUDED.borrow_date,
                       due_date = EXCLUDED.due_date,
                       return_date = EXCLUDED.return_date,
                       status = EXCLUDED.status`,
                      params,
                    );
                  } else {
                    await client.query(
                      `INSERT INTO borrow_records (borrow_id, reader_id, book_id, borrow_date, due_date, return_date, status)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)
                       ON CONFLICT (borrow_id) DO NOTHING`,
                      params,
                    );
                  }
                  successCount++;
                } catch (error) {
                  failCount++;
                  errors.push({
                    row: successCount + failCount,
                    message: error.message,
                  });
                  if (!importConfig.skip_errors) {
                    throw error;
                  }
                }
              }

              const status =
                failCount === 0
                  ? "success"
                  : successCount === 0
                    ? "failed"
                    : "partial";
              await client.query(
                "INSERT INTO import_history (type, filename, status, total_count, success_count, error_count, errors) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [
                  type,
                  req.file.originalname,
                  status,
                  successCount + failCount,
                  successCount,
                  failCount,
                  JSON.stringify(errors),
                ],
              );

              await client.query("COMMIT");
              client.release();
              fs.unlinkSync(req.file.path);

              res.json({
                data: {
                  success: true,
                  message: `导入完成：成功 ${successCount} 条，失败 ${failCount} 条`,
                  stats: {
                    total: successCount + failCount,
                    success: successCount,
                    failed: failCount,
                  },
                },
              });
            } catch (error) {
              await client.query("ROLLBACK");
              client.release();
              fs.unlinkSync(req.file.path);
              console.error("导入借阅处理失败\n", error);
              res.status(500).json({
                data: { success: false, message: "导入失败: " + error.message },
              });
            }
          })
          .on("error", async (error) => {
            await client.query("ROLLBACK");
            client.release();
            fs.unlinkSync(req.file.path);
            console.error("导入借阅流错误\n", error);
            res.status(500).json({
              data: { success: false, message: "导入失败: " + error.message },
            });
          });
      } catch (error) {
        await client.query("ROLLBACK");
        client.release();
        throw error;
      }
    } else {
      fs.unlinkSync(req.file.path);
      res.json({
        data: {
          success: true,
          message: `${type} 类型导入暂未实现`,
          stats: { total: 0, success: 0, failed: 0 },
        },
      });
    }
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("导入数据失败\n", error);
    res.status(500).json({
      data: {
        success: false,
        message: "导入失败: " + error.message,
      },
    });
  }
});

// 统计概览
router.get("/stats/overview", async (req, res) => {
  try {
    const [readersCount, booksCount, borrowsCount, currentBorrows] =
      await Promise.all([
        db.query("SELECT COUNT(*) FROM readers"),
        db.query("SELECT COUNT(*) FROM books"),
        db.query("SELECT COUNT(*) FROM borrow_records"),
        db.query(
          "SELECT COUNT(*) FROM borrow_records WHERE status IN ('borrowed', '借阅中')",
        ),
      ]);

    res.json({
      data: {
        total_users: readersCount.rows[0].count,
        total_books: booksCount.rows[0].count,
        total_borrows: borrowsCount.rows[0].count,
        current_borrows: currentBorrows.rows[0].count,
      },
    });
  } catch (error) {
    console.error("获取统计概览失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 统计趋势
router.get("/stats/trends", async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const query = `
      SELECT
        DATE_TRUNC('day', borrow_date) as date,
        COUNT(*) as borrow_count,
        0 as return_count
      FROM borrow_records
      WHERE borrow_date BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('day', borrow_date)
      ORDER BY date
    `;

    const { rows } = await db.query(query, [start_date, end_date]);
    res.json({ data: rows });
  } catch (error) {
    console.error("获取统计趋势失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 统计分类
router.get("/stats/categories", async (req, res) => {
  try {
    const query = `
      SELECT doc_type as category, COUNT(*) as count
      FROM books
      WHERE doc_type IS NOT NULL AND doc_type <> ''
      GROUP BY doc_type
      ORDER BY count DESC
    `;

    const { rows } = await db.query(query);
    res.json({ data: rows });
  } catch (error) {
    console.error("获取统计分类失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 统计活跃度
router.get("/stats/activity", async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const query = `
      SELECT
        DATE_TRUNC('day', borrow_date) as date,
        COUNT(DISTINCT reader_id) as active_users,
        0 as new_users
      FROM borrow_records
      WHERE borrow_date BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('day', borrow_date)
      ORDER BY date
    `;

    const { rows } = await db.query(query, [start_date, end_date]);
    res.json({ data: rows });
  } catch (error) {
    console.error("获取统计活跃度失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 统计热门书籍
router.get("/stats/popular-books", async (req, res) => {
  try {
    const query = `
      SELECT
        b.book_id,
        b.title,
        b.author,
        b.publisher,
        b.publication_year,
        b.call_no,
        b.language,
        b.doc_type,
        COUNT(br.book_id) AS borrow_count
      FROM books b
      LEFT JOIN borrow_records br ON b.book_id = br.book_id
      GROUP BY b.book_id, b.title, b.author, b.publisher, b.publication_year, b.call_no, b.language, b.doc_type
      ORDER BY borrow_count DESC, b.title ASC
      LIMIT 10
    `;

    const { rows } = await db.query(query);
    res.json({ data: rows });
  } catch (error) {
    console.error("获取热门书籍失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 统计近期活动
router.get("/stats/recent-activity", async (req, res) => {
  try {
    const query = `
      SELECT
        br.borrow_date as created_at,
        r.reader_id,
        l.nickname as user_name,
        CASE
          WHEN br.status = 'borrowed' THEN 'borrow'
          WHEN br.status = 'returned' THEN 'return'
          ELSE 'renew'
        END as action,
        b.title as book_title
      FROM borrow_records br
      JOIN books b ON br.book_id = b.book_id
      JOIN readers r ON br.reader_id = r.reader_id
      JOIN login_info l ON r.reader_id = l.reader_id
      ORDER BY br.borrow_date DESC
      LIMIT 20
    `;

    const { rows } = await db.query(query);
    res.json({ data: rows });
  } catch (error) {
    console.error("获取近期活动失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 导出统计数据
router.get("/stats/export", async (req, res) => {
  try {
    const [overview, categories] = await Promise.all([
      db.query(`
        SELECT
          (SELECT COUNT(*) FROM readers) as total_users,
          (SELECT COUNT(*) FROM books) as total_books,
          (SELECT COUNT(*) FROM borrow_records) as total_borrows,
          (SELECT COUNT(*) FROM borrow_records WHERE status IN ('borrowed', '借阅中')) as current_borrows
      `),
      db.query(`
        SELECT doc_type as category, COUNT(*) as count
        FROM books
        GROUP BY doc_type
        ORDER BY count DESC
      `),
    ]);

    let csvContent = "统计项目,数量\n";
    csvContent += `总用户数,${overview.rows[0].total_users}\n`;
    csvContent += `总图书数,${overview.rows[0].total_books}\n`;
    csvContent += `总借阅次数,${overview.rows[0].total_borrows}\n`;
    csvContent += `当前借阅数,${overview.rows[0].current_borrows}\n\n`;
    csvContent += "分类,数量\n";

    categories.rows.forEach((row) => {
      csvContent += `${row.category},${row.count}\n`;
    });

    res.header("Content-Type", "text/csv;charset=utf-8;");
    res.attachment(
      `library_statistics_${new Date().toISOString().split("T")[0]}.csv`,
    );
    res.send("\ufeff" + csvContent);
  } catch (error) {
    console.error("导出统计数据失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;

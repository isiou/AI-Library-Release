const express = require("express");
const db = require("../db");
const { STATUS, toCanonical, compatibleDbValues } = require("../utils/status");
const { requireAuth } = require("../utils/auth");

const router = express.Router();

// 获取用户借阅记录
router.get("/", requireAuth, async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      startDate = "",
      endDate = "",
    } = req.query;

    // 验证和处理分页参数
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;

    // 构建查询条件
    let whereConditions = ["br.reader_id = $1"];
    let queryParams = [readerId];
    let paramIndex = 2;

    // 搜索条件
    if (search.trim()) {
      whereConditions.push(`(
        b.title ILIKE $${paramIndex} OR
        b.author ILIKE $${paramIndex} OR
        b.call_no ILIKE $${paramIndex}
      )`);
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // 状态筛选
    if (status.trim()) {
      const canonical = toCanonical(status.trim());
      if (canonical) {
        const values = compatibleDbValues(canonical);
        if (values.length) {
          whereConditions.push(`br.status = ANY($${paramIndex})`);
          queryParams.push(values);
          paramIndex++;
        }
      }
    }

    // 日期范围筛选
    if (startDate.trim()) {
      whereConditions.push(`br.borrow_date >= $${paramIndex}`);
      queryParams.push(startDate.trim());
      paramIndex++;
    }

    if (endDate.trim()) {
      whereConditions.push(`br.borrow_date <= $${paramIndex}`);
      queryParams.push(endDate.trim());
      paramIndex++;
    }

    const whereClause = whereConditions.join(" AND ");

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM borrow_records br
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // 查询数据
    const dataQuery = `
      SELECT
        br.borrow_id,
        br.reader_id,
        br.book_id,
        b.title,
        b.author,
        b.call_no,
        br.borrow_date,
        br.due_date,
        br.return_date,
        br.status
      FROM borrow_records br
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE ${whereClause}
      ORDER BY br.borrow_date DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limitNum, offset);
    const dataResult = await db.query(dataQuery, queryParams);

    const normalizedRows = dataResult.rows.map((row) => ({
      ...row,
      status: toCanonical(row.status) || row.status,
    }));

    // 计算分页信息
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data: normalizedRows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("获取借阅记录失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取单个借阅记录详情
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { readerId } = req.session.user;

    const query = `
      SELECT
        br.borrow_id,
        br.reader_id,
        br.book_id,
        b.title,
        b.author,
        b.call_no,
        br.borrow_date,
        br.due_date,
        br.return_date,
        br.status
      FROM borrow_records br
      LEFT JOIN books b ON br.book_id = b.book_id
      WHERE br.borrow_id = $1 AND br.reader_id = $2
    `;

    const { rows } = await db.query(query, [id, readerId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "未找到借阅记录" });
    }

    const record = rows[0];
    record.status = toCanonical(record.status) || record.status;

    res.json(record);
  } catch (error) {
    console.error("获取借阅详情失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;

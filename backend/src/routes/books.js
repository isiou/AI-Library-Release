const express = require("express");
const multer = require("multer");
const fs = require("fs");
const { format, parse } = require("fast-csv");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../utils/auth");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// 书籍搜索
router.get("/search", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      author,
      language,
      sortBy = "popularity",
    } = req.query;
    const offset = (page - 1) * limit;

    let params = [];
    let whereClauses = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      whereClauses.push(
        `(b.title ILIKE $${paramCount} OR b.author ILIKE $${paramCount} OR b.publisher ILIKE $${paramCount})`,
      );
      params.push(`%${search}%`);
    }

    if (category) {
      paramCount++;
      whereClauses.push(`b.doc_type = $${paramCount}`);
      params.push(category);
    }

    if (author) {
      paramCount++;
      whereClauses.push(`b.author ILIKE $${paramCount}`);
      params.push(`%${author}%`);
    }

    if (language) {
      paramCount++;
      whereClauses.push(`b.language = $${paramCount}`);
      params.push(language);
    }

    const fromClause = `FROM books b LEFT JOIN borrow_records br ON b.book_id = br.book_id`;
    const whereClause =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // 获取总数
    const countQuery = `SELECT COUNT(DISTINCT b.book_id) ${fromClause} ${whereClause}`;
    const { rows: countRows } = await db.query(countQuery, params);
    const total = parseInt(countRows[0].count);

    // 排序逻辑
    let orderByClause = "ORDER BY COUNT(br.borrow_id) DESC, b.title ASC";
    if (sortBy === "title") {
      orderByClause = "ORDER BY b.title ASC";
    } else if (sortBy === "publication_year") {
      orderByClause = "ORDER BY b.publication_year DESC, b.title ASC";
    }

    // 添加分页和排序
    const dataQuery = `
      SELECT b.*, COUNT(br.borrow_id) as borrow_count
      ${fromClause}
      ${whereClause}
      GROUP BY b.book_id
      ${orderByClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(parseInt(limit), offset);

    const { rows } = await db.query(dataQuery, params);

    res.json({
      books: rows,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("书籍搜索失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取热门书籍列表
router.get("/popular/list", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 10, 100);

    const query = `
      SELECT b.*, borrow_count.borrow_count
      FROM books b
      INNER JOIN (
          SELECT book_id, COUNT(*) as borrow_count
          FROM borrow_records
          GROUP BY book_id
      ) borrow_count ON b.book_id = borrow_count.book_id
      ORDER BY borrow_count.borrow_count DESC, b.title ASC
      LIMIT $1
    `;

    const { rows } = await db.query(query, [limitNum]);
    res.json({ data: rows });
  } catch (error) {
    console.error("获取热门书籍失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取书籍分类统计
router.get("/categories/stats", async (req, res) => {
  try {
    const query = `
      SELECT doc_type as category, COUNT(*) as count
      FROM books
      GROUP BY doc_type
      ORDER BY count DESC
    `;

    const { rows } = await db.query(query);
    res.json({ data: rows });
  } catch (error) {
    console.error("获取分类统计失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取所有唯一的书籍分类
router.get("/categories", async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT doc_type as category
      FROM books
      WHERE doc_type IS NOT NULL AND doc_type != ''
      ORDER BY doc_type ASC
    `;

    const { rows } = await db.query(query);
    res.json({ data: rows.map((row) => row.category) });
  } catch (error) {
    console.error("获取书籍分类失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取所有唯一的书籍语言
router.get("/languages", async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT language
      FROM books
      WHERE language IS NOT NULL AND language != ''
      ORDER BY language ASC
    `;

    const { rows } = await db.query(query);
    res.json({ data: rows.map((row) => row.language) });
  } catch (error) {
    console.error("获取书籍语言失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取作者列表
router.get("/authors", async (req, res) => {
  try {
    const { search, limit = 50 } = req.query;
    let query =
      "SELECT DISTINCT author FROM books WHERE author IS NOT NULL AND author != ''";
    let params = [];

    if (search) {
      query += " AND author ILIKE $1";
      params.push(`%${search}%`);
    }

    query += " ORDER BY author LIMIT $" + (params.length + 1);
    params.push(parseInt(limit));

    const { rows } = await db.query(query, params);
    res.json({ data: rows.map((row) => row.author) });
  } catch (error) {
    console.error("获取作者列表失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取相关书籍
router.get("/:id/related", async (req, res) => {
  try {
    const bookId = req.params.id;

    const bookResult = await db.query(
      "SELECT * FROM books WHERE book_id = $1",
      [bookId],
    );
    if (bookResult.rows.length === 0) {
      return res.status(404).json({ message: "未找到书籍" });
    }

    const book = bookResult.rows[0];
    res.json({ data: [book] });
  } catch (error) {
    console.error("获取相关书籍失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 管理员获取所有图书
router.get("/all", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      author,
      doc_type,
    } = req.query;
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM books WHERE 1=1";
    let params = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (title ILIKE $${paramCount} OR author ILIKE $${paramCount} OR publisher ILIKE $${paramCount} OR book_id ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (category) {
      paramCount++;
      query += ` AND doc_type = $${paramCount}`;
      params.push(category);
    }

    if (author) {
      paramCount++;
      query += ` AND author ILIKE $${paramCount}`;
      params.push(`%${author}%`);
    }

    if (doc_type) {
      paramCount++;
      query += ` AND doc_type = $${paramCount}`;
      params.push(doc_type);
    }

    // 获取总数
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*)");
    const { rows: countRows } = await db.query(countQuery, params);
    const total = parseInt(countRows[0].count);

    // 添加分页和排序
    query += ` ORDER BY title LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), offset);

    const { rows } = await db.query(query, params);

    res.json({
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("获取所有图书失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取书籍详情
router.get("/:id", async (req, res) => {
  try {
    const query = `
      SELECT
        b.*,
        (SELECT COUNT(*) FROM borrow_records br WHERE br.book_id = b.book_id AND br.return_date IS NULL) as current_borrows,
        (SELECT COUNT(*) FROM borrow_records br WHERE br.book_id = b.book_id) as total_borrows
      FROM books b
      WHERE b.book_id = $1
    `;

    const { rows } = await db.query(query, [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "未找到书籍" });
    }

    const book = rows[0];
    book.total_count = 1;
    book.available_count = parseInt(book.current_borrows) > 0 ? 0 : 1;

    res.json(book);
  } catch (error) {
    console.error("获取书籍详情失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 创建书籍 (管理员)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
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
    } = req.body;

    await db.query(
      "INSERT INTO books (book_id, title, author, publisher, publication_year, call_no, language, doc_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
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
    res.status(201).json({ message: "书籍已创建" });
  } catch (error) {
    console.error("创建书籍失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 更新书籍 (管理员)
router.put("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      title,
      author,
      publisher,
      publication_year,
      call_no,
      language,
      doc_type,
    } = req.body;

    await db.query(
      "UPDATE books SET title=$1, author=$2, publisher=$3, publication_year=$4, call_no=$5, language=$6, doc_type=$7 WHERE book_id=$8",
      [
        title,
        author,
        publisher,
        publication_year,
        call_no,
        language,
        doc_type,
        req.params.id,
      ],
    );
    res.json({ message: "书籍已更新" });
  } catch (error) {
    console.error("更新书籍失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 删除书籍 (管理员)
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query("BEGIN");
    const bookId = req.params.id;

    await client.query("DELETE FROM borrow_records WHERE book_id = $1", [
      bookId,
    ]);
    await client.query("DELETE FROM books WHERE book_id = $1", [bookId]);

    await client.query("COMMIT");
    res.json({ message: "书籍已删除" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("删除书籍失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  } finally {
    client.release();
  }
});

// 批量删除书籍 (管理员)
router.post("/batch", requireAuth, requireAdmin, async (req, res) => {
  const client = await db.getClient();
  try {
    const { ids } = req.body;
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM borrow_records WHERE book_id = ANY($1::varchar[])",
      [ids],
    );
    await client.query("DELETE FROM books WHERE book_id = ANY($1::varchar[])", [
      ids,
    ]);

    await client.query("COMMIT");
    res.json({ message: "书籍已删除" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("批量删除书籍失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  } finally {
    client.release();
  }
});

// 导入书籍 (管理员)
router.post(
  "/import",
  requireAuth,
  requireAdmin,
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).send("未上传文件");
    }

    const books = [];
    fs.createReadStream(req.file.path)
      .pipe(parse({ headers: true }))
      .on("error", (error) => {
        console.error("CSV 解析失败\n", error);
        res.status(500).json({ message: "CSV 解析失败" });
      })
      .on("data", (row) => books.push(row))
      .on("end", async () => {
        fs.unlinkSync(req.file.path);
        const client = await db.getClient();
        try {
          await client.query("BEGIN");
          for (const book of books) {
            const {
              book_id,
              title,
              author,
              publisher,
              publication_year,
              call_no,
              language,
              doc_type,
            } = book;
            await client.query(
              "INSERT INTO books (book_id, title, author, publisher, publication_year, call_no, language, doc_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (book_id) DO UPDATE SET title = $2, author = $3, publisher = $4, publication_year = $5, call_no = $6, language = $7, doc_type = $8",
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
          await client.query("COMMIT");
          res
            .status(201)
            .json({ message: `共导入成功 ${books.length} 条记录` });
        } catch (error) {
          await client.query("ROLLBACK");
          console.error("导入书籍失败\n", error);
          res.status(500).json({ message: "导入书籍失败" });
        } finally {
          client.release();
        }
      });
  },
);

module.exports = router;

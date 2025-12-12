const express = require("express");
const db = require("../db");
const config = require("../config");
const {
  normalizeRecommendation,
  buildFallbackQuery,
} = require("../lib/recommendations");
const RecommendationService = require("../services/recommendationService");
const { requireAuth } = require("../utils/auth");

const router = express.Router();
const recommendationService = new RecommendationService();

// 获取智能推荐
router.get("/", requireAuth, async (req, res) => {
  try {
    const { model = "ollama", limit = 10, query = "" } = req.query;
    const limitNum = Math.max(
      1,
      Math.min(
        config.recommendation.maxLimit,
        parseInt(limit) || config.recommendation.defaultLimit,
      ),
    );
    const userId = req.session.user.readerId;

    let recommendations = [];
    let message = "";
    let model_type = "";

    try {
      const result = await recommendationService.getBookRecommendations(
        userId,
        model,
        query,
        limitNum,
      );

      if (result.success && result.recommendations) {
        recommendations = result.recommendations.map(normalizeRecommendation);
        model_type = `(${result.model_used || model})`;
        message = "获取推荐成功";
      } else {
        throw new Error(result.error || "推荐服务错误");
      }
    } catch (aiError) {
      console.warn("模型推荐错误回退至数据库\n", aiError.message);

      try {
        const userBorrowsQuery = `
          SELECT DISTINCT b.doc_type, b.author
          FROM borrow_records br
          JOIN books b ON br.book_id = b.book_id
          WHERE br.reader_id = $1
          LIMIT 5
        `;
        const userBorrows = await db.query(userBorrowsQuery, [userId]);

        const { sql, params } = buildFallbackQuery(
          userBorrows.rows,
          query,
          limitNum,
        );
        let fallbackResult = await db.query(sql, params);

        // 兜底推荐
        if (fallbackResult.rows.length === 0 && !query) {
          const { sql: fallbackSql, params: fallbackParams } =
            buildFallbackQuery([], "", limitNum);
          fallbackResult = await db.query(fallbackSql, fallbackParams);
        }

        recommendations = fallbackResult.rows.map((book) => ({
          ...normalizeRecommendation(book),
          category: book.doc_type,
        }));

        // 保存回退推荐历史
        if (recommendations.length > 0) {
          try {
            await recommendationService.saveRecommendationHistory(
              userId,
              "database_fallback",
              recommendations,
            );
          } catch (saveError) {
            console.error("保存回退推荐历史失败\n", saveError);
          }
        }

        message = "回退数据库获取推荐成功";
      } catch (dbError) {
        console.error("数据库回退\n", dbError);
        return res.status(503).json({
          message: "推荐服务暂不可用",
          recommendations: [],
        });
      }
    }

    res.json({
      recommendations,
      model_type,
      message,
      total: recommendations.length,
    });
  } catch (error) {
    console.error("获取推荐失败\n", error);
    res.status(500).json({ message: "服务器内部错误", recommendations: [] });
  }
});

// 获取推荐历史记录
router.get("/history", requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, showRejected = "false" } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const offset = (pageNum - 1) * limitNum;
    const userId = req.session.user.readerId;

    let whereClause = "reader_id = $1";
    const queryParams = [userId];

    if (showRejected !== "true") {
      whereClause += " AND (is_rejected IS FALSE OR is_rejected IS NULL)";
    }

    // 查询总数
    const countQuery = `SELECT COUNT(*) as total FROM recommendation_history WHERE ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // 查询数据
    const query = `
      SELECT
        recommendation_id,
        recommended_book_title as title,
        recommended_book_author as author,
        recommendation_reason as reason,
        call_number,
        model_used,
        created_at,
        is_rejected
      FROM recommendation_history
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const { rows } = await db.query(query, [...queryParams, limitNum, offset]);

    const recommendations = rows.map((row) => ({
      id: row.recommendation_id,
      title: row.title || "",
      author: row.author || "",
      call_number: row.call_number || "",
      reason: row.reason || "",
      model_used: row.model_used,
      created_at: row.created_at,
      is_rejected: row.is_rejected,
    }));

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      recommendations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
      },
      message: "获取历史记录成功",
    });
  } catch (error) {
    console.error("获取推荐历史失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 更新推荐记录状态
router.put("/history/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_rejected } = req.body;
    const userId = req.session.user.readerId;

    // 验证所有权
    const checkQuery =
      "SELECT reader_id FROM recommendation_history WHERE recommendation_id = $1";
    const checkResult = await db.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "未找到推荐记录" });
    }

    if (checkResult.rows[0].reader_id !== userId) {
      return res.status(403).json({ message: "无权修改此记录" });
    }

    const updateQuery = `
      UPDATE recommendation_history
      SET is_rejected = $1
      WHERE recommendation_id = $2
      RETURNING *
    `;

    const { rows } = await db.query(updateQuery, [is_rejected, id]);

    res.json({
      message: "更新成功",
      record: rows[0],
    });
  } catch (error) {
    console.error("更新推荐记录失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 健康检查
router.get("/health", async (req, res) => {
  try {
    const healthStatus = await recommendationService.checkOllamaHealth();

    if (healthStatus.available) {
      res.json({
        status: "healthy",
        ollama_available: true,
        models: healthStatus.models.map((m) => m.name),
        message: "模型服务运行正常",
      });
    } else {
      res.json({
        status: "degraded",
        ollama_available: false,
        error: healthStatus.error,
        message: "模型服务不可用",
      });
    }
  } catch (error) {
    console.error("健康检查失败\n", error);
    res.status(500).json({
      status: "unhealthy",
      ollama_available: false,
      error: error.message,
      message: "健康检查失败",
    });
  }
});

module.exports = router;

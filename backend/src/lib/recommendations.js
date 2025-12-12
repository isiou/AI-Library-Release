// 映射字段并标准化结果
const normalizeRecommendation = (rec) => ({
  id: rec.id || rec.recommendation_id,
  title: rec.title || rec.book_title || rec.name || rec.Title || "",
  author: rec.author || rec.book_author || rec.writer || rec.Author || "",
  call_number:
    rec.call_number ||
    rec.call_no ||
    rec.callNumber ||
    rec.callNum ||
    rec.call_num ||
    "",
  reason: rec.reason || rec.explanation || rec.rationale || "",
});

// 数据库回退推荐查询
const buildFallbackQuery = (
  userBorrowsRows = [],
  query = "",
  limitNum = 10,
) => {
  let fallbackQuery = `
  SELECT b.title, b.author, b.call_no, b.doc_type,
  'Based on your reading history' as reason
  FROM books b
  `;

  const queryParams = [];
  const conditions = [];

  // 关键词过滤优先
  if (query) {
    queryParams.push(`%${query}%`);
    const idx = queryParams.length;
    conditions.push(
      `(b.title ILIKE $${idx} OR b.author ILIKE $${idx} OR b.doc_type ILIKE $${idx})`,
    );
  } else if (userBorrowsRows.length > 0) {
    // 仅在没有关键词时基于借阅历史构建过滤条件
    const docTypes = [
      ...new Set(userBorrowsRows.map((r) => r.doc_type).filter(Boolean)),
    ];
    const authors = [
      ...new Set(userBorrowsRows.map((r) => r.author).filter(Boolean)),
    ];

    const historyConditions = [];

    if (docTypes.length > 0) {
      queryParams.push(docTypes);
      historyConditions.push(`b.doc_type = ANY($${queryParams.length})`);
    }

    if (historyConditions.length > 0) {
      conditions.push(`(${historyConditions.join(" OR ")})`);
    }
  }

  if (conditions.length > 0) {
    fallbackQuery += ` WHERE ${conditions.join(" AND ")}`;
  }

  queryParams.push(limitNum);
  fallbackQuery += ` ORDER BY b.publication_year DESC LIMIT $${queryParams.length}`;

  return { sql: fallbackQuery, params: queryParams };
};

module.exports = { normalizeRecommendation, buildFallbackQuery };

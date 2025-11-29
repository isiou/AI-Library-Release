const db = require("../db");
const config = require("../config");

class RecommendationService {
  constructor() {
    this.OLLAMA_MODEL = config.ai.ollama.model;
    this.OLLAMA_HOST = config.ai.ollama.host;
    this.OLLAMA_TIMEOUT = config.ai.ollama.timeout || 60000;
  }

  // Ollama 通用接口
  async _callOllama(messages, options = {}) {
    const { format, stream = false, retries = 1 } = options;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // 超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.OLLAMA_TIMEOUT,
        );

        const response = await fetch(`${this.OLLAMA_HOST}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.OLLAMA_MODEL,
            messages,
            stream,
            format,
            options: {
              temperature: 0.8,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error("Ollama 通用接口错误");
        }

        const data = await response.json();
        return data.message.content;
      } catch (error) {
        console.error(
          `Ollama 通用接口调用失败\n当前第 ${attempt + 1}/${retries} 次尝试\n`,
          error.message,
        );
        if (attempt === retries - 1) throw error;
      }
    }
  }

  // 解析 JSON 数组
  extractJsonArray(text) {
    try {
      const startIndex = text.indexOf("[");
      const endIndex = text.lastIndexOf("]");
      if (startIndex !== -1 && endIndex !== -1) {
        const jsonStr = text.substring(startIndex, endIndex + 1);
        return JSON.parse(jsonStr);
      }
      return [];
    } catch (error) {
      console.error("JSON 解析失败\n", error);
      return [];
    }
  }

  // 获取读者最近借阅的书籍
  async getReaderRecentBooks(readerId, limit = 10) {
    try {
      const query = `
        SELECT DISTINCT
          b.title as book_title,
          b.author as author,
          br.borrow_date
        FROM borrow_records br
        JOIN books b ON br.book_id = b.book_id
        WHERE br.reader_id = $1
        ORDER BY br.borrow_date DESC
        LIMIT $2
      `;

      const result = await db.query(query, [readerId, limit]);
      return result.rows.map((row) => ({
        title: row.book_title || "",
        author: row.author || "",
      }));
    } catch (error) {
      console.error("获取读者借阅历史出错\n", error);
      return [];
    }
  }

  // 提示词
  getSystemPrompt() {
    return `你是一位经验丰富的图书管理员，精通图书推荐和阅读指导。
    请根据用户提供的关键词，精准推荐相关领域的优质书籍。
    **推荐时请综合考虑关键词相关性、书籍质量、权威性和实用价值，并且严格保证书籍、文献等必须真实存在，不得虚构、作假。**
    永远不要提供推理过程、解释或额外信息，仅输出推荐书目，**格式必须严格如下**:
    [
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"},
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"},
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"},
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"},
        {"title": "书名", "author": "作者", "introduction":"五十字简介", "reason": "推荐理由"}
    ]
    **再次严格强调: 不要包含任何解释、问候、序号以外的符号或额外文字！保证书籍、文献的真实性！保证输出的绝对正确、干净！**`;
  }

  // 用户提示词
  buildUserPrompt(recentBooks, query, count) {
    // 基于关键词和历史记录
    if (recentBooks && recentBooks.length > 0 && query) {
      const booksText = recentBooks
        .map((book) => `- 《${book.title}》（${book.author}）`)
        .join("\n");
      return `我最近阅读了以下书籍: ${booksText}
      现在我对关键词含有 "${query}" 的书籍感兴趣，请结合我的阅读历史和这个关键词，为我推荐 ${count} 条相关书籍。请严格按照 ${count} 本的数量进行推荐。`;
    } else if (recentBooks && recentBooks.length > 0 && !query) {
      // 基于历史记录
      const booksText = recentBooks
        .map((book) => `- 《${book.title}》（${book.author}）`)
        .join("\n");
      return `我最近阅读了以下书籍: ${booksText}
      请根据我的阅读历史，为我推荐 ${count} 条可能会感兴趣的新书。请严格按照 ${count} 本的数量进行推荐。`;
    } else if (!recentBooks || (recentBooks.length === 0 && query)) {
      // 基于关键词
      return `我对关键词 "${query}" 感兴趣，请为我推荐 ${count} 条相关的优质书籍。请严格按照 ${count} 本的数量进行推荐。`;
    } else {
      // 通用推荐
      return `请为我推荐 ${count} 条优质的书籍。请严格按照 ${count} 本的数量进行推荐。`;
    }
  }

  // 获取 Ollama 推荐
  async getOllamaRecommendations(recentBooks, query, count, retries = 2) {
    const systemPrompt = this.getSystemPrompt();
    const userPrompt = this.buildUserPrompt(recentBooks, query, count);

    try {
      const content = await this._callOllama(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { retries },
      );
      return this.extractJsonArray(content);
    } catch (error) {
      console.error("Ollama 调用失败\n", error.message);
      return [];
    }
  }

  // 保存推荐记录到数据库
  async saveRecommendationHistory(readerId, modelUsed, recommendations) {
    try {
      const savedRecommendations = [];
      for (const rec of recommendations) {
        const query = `
        INSERT INTO recommendation_history
        (reader_id, model_used, recommended_book_title, recommended_book_author, recommendation_reason)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING recommendation_id
        `;
        const result = await db.query(query, [
          readerId,
          modelUsed,
          rec.title || "",
          rec.author || "",
          rec.reason || "",
        ]);
        savedRecommendations.push({
          ...rec,
          id: result.rows[0].recommendation_id,
        });
      }
      return savedRecommendations;
    } catch (error) {
      console.error("持久化推荐历史失败\n", error);
      throw error;
    }
  }

  // 获取图书推荐统一接口
  async getBookRecommendations(
    readerId,
    model = "ollama",
    query = "",
    count = 5,
  ) {
    try {
      // 获取用户借阅历史记录
      const recentBooks = await this.getReaderRecentBooks(readerId, 10);

      let recommendations = [];
      let modelUsed = model;

      try {
        if (model.toLowerCase() === "ollama") {
          recommendations = await this.getOllamaRecommendations(
            recentBooks,
            query,
            count,
          );
        }

        let savedRecommendations = recommendations;
        if (recommendations && recommendations.length > 0) {
          savedRecommendations = await this.saveRecommendationHistory(
            readerId,
            modelUsed,
            recommendations,
          );
        }

        return {
          success: recommendations && recommendations.length > 0,
          reader_id: readerId,
          model_used: modelUsed,
          query: query,
          has_history: recentBooks.length > 0,
          recommendations_count: recommendations.length,
          recommendations: savedRecommendations,
        };
      } catch (error) {
        console.error("推荐服务出错\n", error);
        return {
          success: false,
          reader_id: readerId,
          model_used: modelUsed,
          query: query,
          has_history: recentBooks.length > 0,
          recommendations_count: 0,
          recommendations: [],
          error: error.message,
        };
      }
    } catch (error) {
      console.error("获取推荐时出错\n", error);
      return {
        success: false,
        reader_id: readerId,
        model_used: model,
        query: query,
        has_history: false,
        recommendations_count: 0,
        recommendations: [],
        error: error.message,
      };
    }
  }

  // 健康检查
  async checkOllamaHealth() {
    try {
      const response = await fetch(`${this.OLLAMA_HOST}/api/tags`);
      if (response.ok) {
        const data = await response.json();
        return { available: true, models: data.models || [] };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      return { available: false, error: error.message };
    }
  }

  // 获取相关书籍
  async getRelatedBooks(book, limit = 5) {
    try {
      const candidateQuery = `
      SELECT book_id, title, author, publisher, doc_type
      FROM books
      WHERE book_id != $1
      AND (doc_type = $2 OR author = $3)
      LIMIT 30
      `;
      const candidates = await db.query(candidateQuery, [
        book.book_id,
        book.doc_type,
        book.author,
      ]);

      if (candidates.rows.length === 0) {
        return [];
      }

      const candidatesText = candidates.rows
        .map(
          (b, index) =>
            `${index + 1}. ID: ${b.book_id}, 书名: 《${b.title}》, 作者: ${b.author}, 出版社: ${b.publisher || "未知"}`,
        )
        .join("\n");

      const systemPrompt = `你是一个专业的图书推荐系统。请根据目标书籍的特征，从给定的候选列表中选出最相似或最相关的 ${limit} 本书。
      请只返回被选中书籍的 ID 列表，格式为 JSON 数组，例如: ["ID1", "ID2", "ID3"]。不要包含任何解释或其他文字。`;

      const userPrompt = `目标书籍:
      书名: 《${book.title}》
      作者: ${book.author}
      出版社: ${book.publisher || "未知"}
      分类: ${book.doc_type}

      候选书籍列表:
      ${candidatesText}

      请从中选出最相关的 ${limit} 本书。`;

      try {
        const content = await this._callOllama(
          [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          { format: "json" },
        );

        let recommendedIds = this.extractJsonArray(content);

        if (!recommendedIds || recommendedIds.length === 0) {
          return candidates.rows.slice(0, limit);
        }

        const result = candidates.rows.filter((b) =>
          recommendedIds.includes(b.book_id),
        );

        if (result.length < limit) {
          const remaining = candidates.rows.filter(
            (b) => !recommendedIds.includes(b.book_id),
          );
          result.push(...remaining.slice(0, limit - result.length));
        }

        return result;
      } catch (error) {
        console.error("相关书籍推荐失败\n", error);
        return candidates.rows.slice(0, limit);
      }
    } catch (error) {
      console.error("获取相关书籍失败\n", error);
      return [];
    }
  }
}

module.exports = RecommendationService;

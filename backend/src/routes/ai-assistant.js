const express = require("express");
const db = require("../db");
const { requireAuth } = require("../utils/auth");
const aiService = require("../services/aiService");

const router = express.Router();

router.use(requireAuth);

// 获取用户的聊天会话列表
router.get("/sessions", async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT
        cs.session_id,
        cs.session_title,
        cs.created_at,
        cs.last_message_at,
        cs.is_active,
        am.model_name,
        COUNT(cm.message_id) as message_count
      FROM chat_sessions cs
      LEFT JOIN ai_models am ON cs.model_id = am.model_id
      LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id AND cm.is_deleted = false
      WHERE cs.reader_id = $1 AND cs.is_active = true
      GROUP BY cs.session_id, cs.session_title, cs.created_at, cs.last_message_at, cs.is_active, am.model_name
      ORDER BY cs.last_message_at DESC
      LIMIT $2 OFFSET $3`,
      [readerId, limit, offset],
    );

    const countResult = await db.query(
      "SELECT COUNT(*) FROM chat_sessions WHERE reader_id = $1 AND is_active = true",
      [readerId],
    );

    res.json({
      sessions: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error("获取会话列表失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 创建新的聊天会话
router.post("/sessions", async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { title = "新对话", model_id } = req.body;

    // 获取默认模型或验证指定模型
    let selectedModelId = model_id;
    if (!selectedModelId) {
      const defaultModel = await db.query(
        "SELECT model_id FROM ai_models WHERE is_active = true ORDER BY model_id LIMIT 1",
      );
      if (defaultModel.rows.length === 0) {
        return res.status(400).json({ message: "没有可用的 AI 模型" });
      }
      selectedModelId = defaultModel.rows[0].model_id;
    } else {
      const modelExists = await db.query(
        "SELECT model_id FROM ai_models WHERE model_id = $1 AND is_active = true",
        [selectedModelId],
      );
      if (modelExists.rows.length === 0) {
        return res.status(400).json({ message: "指定的模型不存在或不可用" });
      }
    }

    const result = await db.query(
      `INSERT INTO chat_sessions (reader_id, session_title, model_id)
       VALUES ($1, $2, $3)
       RETURNING session_id, session_title, created_at, last_message_at`,
      [readerId, title, selectedModelId],
    );

    res.status(201).json({
      session: result.rows[0],
      message: "会话创建成功",
    });
  } catch (error) {
    console.error("创建会话失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取指定会话的消息历史
router.get("/sessions/:sessionId/messages", async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { sessionId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // 验证会话所有权
    const sessionCheck = await db.query(
      "SELECT session_id FROM chat_sessions WHERE session_id = $1 AND reader_id = $2",
      [sessionId, readerId],
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ message: "会话不存在或无权访问" });
    }

    const result = await db.query(
      `SELECT
        message_id,
        role,
        content,
        content_type,
        metadata,
        created_at
      FROM chat_messages
      WHERE session_id = $1 AND is_deleted = false
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset],
    );

    const countResult = await db.query(
      "SELECT COUNT(*) FROM chat_messages WHERE session_id = $1 AND is_deleted = false",
      [sessionId],
    );

    res.json({
      messages: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error("获取消息历史失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 保存系统消息
router.post("/sessions/:sessionId/system-messages", async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { sessionId } = req.params;
    const { content, role = "system", metadata = {} } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "消息内容不能为空" });
    }

    // 验证会话所有权
    const sessionResult = await db.query(
      `SELECT session_id FROM chat_sessions
       WHERE session_id = $1 AND reader_id = $2 AND is_active = true`,
      [sessionId, readerId],
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: "会话不存在或无权访问" });
    }

    // 保存系统消息
    const systemMessageResult = await db.query(
      `INSERT INTO chat_messages (session_id, role, content, content_type, metadata)
       VALUES ($1, $2, $3, 'text', $4)
       RETURNING message_id, created_at`,
      [sessionId, role, content, JSON.stringify(metadata)],
    );

    const systemMessage = systemMessageResult.rows[0];

    // 更新会话的最后消息时间
    await db.query(
      "UPDATE chat_sessions SET last_message_at = NOW() WHERE session_id = $1",
      [sessionId],
    );

    res.json({
      message_id: systemMessage.message_id,
      role: role,
      content: content,
      created_at: systemMessage.created_at,
      metadata: metadata,
    });
  } catch (error) {
    console.error("保存系统消息失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 发送消息到AI助手
router.post("/sessions/:sessionId/messages", async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { sessionId } = req.params;
    const { content, stream = false } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ message: "消息内容不能为空" });
    }

    // 验证会话所有权
    const sessionResult = await db.query(
      `SELECT cs.session_id, cs.model_id, am.model_name, am.model_type, am.endpoint_url, am.model_config
       FROM chat_sessions cs
       JOIN ai_models am ON cs.model_id = am.model_id
       WHERE cs.session_id = $1 AND cs.reader_id = $2 AND cs.is_active = true AND am.is_active = true`,
      [sessionId, readerId],
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: "会话不存在或无权访问" });
    }

    const session = sessionResult.rows[0];

    // 保存用户消息
    const userMessageResult = await db.query(
      `INSERT INTO chat_messages (session_id, role, content, content_type)
       VALUES ($1, 'user', $2, 'text')
       RETURNING message_id, created_at`,
      [sessionId, content],
    );

    const userMessage = userMessageResult.rows[0];

    if (stream) {
      // 设置 SSE 响应头
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      });

      // 发送用户消息确认
      res.write(
        `data: ${JSON.stringify({
          type: "user_message",
          message: {
            message_id: userMessage.message_id,
            role: "user",
            content: content,
            created_at: userMessage.created_at,
          },
        })}\n\n`,
      );

      // 调用 AI 模型服务
      await aiService.generateStreamResponse(session, content, sessionId, res);
    } else {
      // 非流式响应
      const aiResponse = await aiService.generateResponse(
        session,
        content,
        sessionId,
      );

      res.json({
        user_message: {
          message_id: userMessage.message_id,
          role: "user",
          content: content,
          created_at: userMessage.created_at,
        },
        ai_response: aiResponse,
      });
    }
  } catch (error) {
    console.error("发送消息失败\n", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "服务器内部错误" });
    }
  }
});

// 流式发送消息
router.get("/sessions/:sessionId/messages/stream", async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { sessionId } = req.params;
    const { message, model_id } = req.query;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ message: "消息内容不能为空" });
    }

    // 验证会话所有权和模型
    const sessionResult = await db.query(
      `SELECT cs.session_id, cs.model_id, am.model_name, am.model_type, am.endpoint_url, am.model_config
       FROM chat_sessions cs
       JOIN ai_models am ON cs.model_id = am.model_id
       WHERE cs.session_id = $1 AND cs.reader_id = $2 AND cs.is_active = true AND am.is_active = true`,
      [sessionId, readerId],
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ message: "会话不存在或无权访问" });
    }

    let session = sessionResult.rows[0];

    // 如果指定了新的模型ID，更新会话模型
    if (model_id && model_id !== session.model_id) {
      const modelResult = await db.query(
        "SELECT model_id, model_name, model_type, endpoint_url, model_config FROM ai_models WHERE model_id = $1 AND is_active = true",
        [model_id],
      );

      if (modelResult.rows.length === 0) {
        return res.status(400).json({ message: "指定的模型不存在或不可用" });
      }

      // 更新会话模型
      await db.query(
        "UPDATE chat_sessions SET model_id = $1 WHERE session_id = $2",
        [model_id, sessionId],
      );

      session = { ...session, ...modelResult.rows[0] };
    }

    // 保存用户消息
    const userMessageResult = await db.query(
      `INSERT INTO chat_messages (session_id, role, content, content_type)
       VALUES ($1, 'user', $2, 'text')
       RETURNING message_id, created_at`,
      [sessionId, message],
    );

    const userMessage = userMessageResult.rows[0];

    // 设置 SSE 响应头
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // 发送用户消息确认
    res.write(
      `data: ${JSON.stringify({
        type: "user_message",
        message: {
          message_id: userMessage.message_id,
          role: "user",
          content: message,
          created_at: userMessage.created_at,
        },
      })}\n\n`,
    );

    // 调用 AI 模型服务进行流式响应
    await aiService.generateStreamResponse(session, message, sessionId, res);
  } catch (error) {
    console.error("流式发送消息失败\n", error);
    if (!res.headersSent) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
    }
    res.write(
      `data: ${JSON.stringify({
        type: "error",
        message: "发送消息失败",
      })}\n\n`,
    );
    res.end();
  }
});

// 删除会话
router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { sessionId } = req.params;

    const result = await db.query(
      "UPDATE chat_sessions SET is_active = false WHERE session_id = $1 AND reader_id = $2",
      [sessionId, readerId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "会话不存在或无权访问" });
    }

    res.json({ message: "会话删除成功" });
  } catch (error) {
    console.error("删除会话失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 更新会话标题
router.patch("/sessions/:sessionId", async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title || title.trim().length === 0) {
      return res.status(400).json({ message: "标题不能为空" });
    }

    const result = await db.query(
      "UPDATE chat_sessions SET session_title = $1 WHERE session_id = $2 AND reader_id = $3",
      [title.trim(), sessionId, readerId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "会话不存在或无权访问" });
    }

    res.json({ message: "会话标题更新成功" });
  } catch (error) {
    console.error("更新会话标题失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取可用的模型列表
router.get("/models", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT model_id, model_name, model_type, max_tokens, temperature, is_active
       FROM ai_models
       WHERE is_active = true
       ORDER BY model_name`,
    );

    res.json({ models: result.rows });
  } catch (error) {
    console.error("获取模型列表失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 消息反馈
router.post("/messages/:messageId/feedback", async (req, res) => {
  try {
    const { readerId } = req.session.user;
    const { messageId } = req.params;
    const { feedback_type, feedback_reason, feedback_comment } = req.body;

    if (!["like", "dislike", "report"].includes(feedback_type)) {
      return res.status(400).json({ message: "无效的反馈类型" });
    }

    // 验证消息存在且用户有权限
    const messageCheck = await db.query(
      `SELECT cm.message_id
       FROM chat_messages cm
       JOIN chat_sessions cs ON cm.session_id = cs.session_id
       WHERE cm.message_id = $1 AND cs.reader_id = $2`,
      [messageId, readerId],
    );

    if (messageCheck.rows.length === 0) {
      return res.status(404).json({ message: "消息不存在或无权访问" });
    }

    // 检查是否已经反馈过
    const existingFeedback = await db.query(
      "SELECT feedback_id FROM message_feedback WHERE message_id = $1 AND reader_id = $2",
      [messageId, readerId],
    );

    if (existingFeedback.rows.length > 0) {
      // 更新现有反馈
      await db.query(
        `UPDATE message_feedback
         SET feedback_type = $1, feedback_reason = $2, feedback_comment = $3
         WHERE message_id = $4 AND reader_id = $5`,
        [feedback_type, feedback_reason, feedback_comment, messageId, readerId],
      );
    } else {
      // 创建新反馈
      await db.query(
        `INSERT INTO message_feedback (message_id, reader_id, feedback_type, feedback_reason, feedback_comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [messageId, readerId, feedback_type, feedback_reason, feedback_comment],
      );
    }

    res.json({ message: "反馈提交成功" });
  } catch (error) {
    console.error("提交反馈失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

// 获取用户的 AI 使用统计
router.get("/stats", async (req, res) => {
  try {
    const { readerId } = req.session.user;

    const stats = await db.query(
      `SELECT
        COUNT(DISTINCT cs.session_id) as total_sessions,
        COUNT(cm.message_id) as total_messages,
        COUNT(CASE WHEN cm.role = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN cm.role = 'assistant' THEN 1 END) as assistant_messages,
        MAX(cs.last_message_at) as last_activity
      FROM chat_sessions cs
      LEFT JOIN chat_messages cm ON cs.session_id = cm.session_id AND cm.is_deleted = false
      WHERE cs.reader_id = $1`,
      [readerId],
    );

    res.json({ stats: stats.rows[0] });
  } catch (error) {
    console.error("获取使用统计失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
});

module.exports = router;

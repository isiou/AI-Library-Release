const db = require("../db");

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

// 可选认证中间件
const optionalAuth = (req, res, next) => {
  req.user = req.session?.user || null;
  next();
};

// 所有者或管理员权限中间件
const requireOwnerOrAdmin = async (req, res, next) => {
  try {
    const userId = req.session.user.readerId;
    const resourceUserId =
      req.params.userId || req.body.userId || req.query.userId;

    if (userId === resourceUserId) {
      return next();
    }

    const result = await db.query(
      "SELECT is_admin FROM login_info WHERE reader_id = $1",
      [userId],
    );

    if (result.rows.length === 0 || !result.rows[0].is_admin) {
      return res.status(403).json({ message: "权限不足" });
    }

    next();
  } catch (error) {
    console.error("权限检查失败\n", error);
    res.status(500).json({ message: "服务器内部错误" });
  }
};

module.exports = {
  requireAuth,
  requireAdmin,
  optionalAuth,
  requireOwnerOrAdmin,
};

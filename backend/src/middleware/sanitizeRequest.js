// 日志脱敏
const sanitizeRequest = (req, res, next) => {
  const SENSITIVE_KEYS = new Set([
    "password",
    "currentPassword",
    "newPassword",
    "confirmPassword",
    "salt",
    "token",
    "secret",
  ]);

  // 递归脱敏
  const sanitize = (data) => {
    if (!data || typeof data !== "object") return data;

    if (Array.isArray(data)) {
      return data.map((item) => sanitize(item));
    }

    const sanitized = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        if (SENSITIVE_KEYS.has(key)) {
          sanitized[key] = "[REDACTED]";
        } else {
          sanitized[key] = sanitize(data[key]);
        }
      }
    }
    return sanitized;
  };

  try {
    if (req.body) {
      req.sanitizedBody = sanitize(req.body);
    }
  } catch (error) {
    req.sanitizedBody = null;
  }

  next();
};

module.exports = sanitizeRequest;

const axios = require("axios");
const db = require("../db");
const config = require("../config");

class OllamaManager {
  constructor(baseUrl = config.ai.ollama.host) {
    this.baseUrl = baseUrl;
    this.defaultModel = config.ai.ollama.model;
    this.timeout = config.ai.ollama.timeout;
  }

  // 检查 Ollama 服务可用性
  async checkService() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      return {
        available: true,
        models: response.data.models || [],
      };
    } catch (error) {
      console.error(`Ollama 服务检查失败\n`, error);
      return {
        available: false,
        error: error.message,
      };
    }
  }

  // 获取可用模型列表
  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, {
        timeout: 5000,
      });
      return response.data.models || [];
    } catch (error) {
      throw new Error("获取模型列表失败");
    }
  }

  // 拉取指定模型
  async pullModel(modelName, onProgress = null) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/pull`,
        { name: modelName },
        {
          responseType: "stream",
          timeout: 300000,
        },
      );

      return new Promise((resolve, reject) => {
        let lastStatus = "";

        response.data.on("data", (chunk) => {
          const lines = chunk.toString().split("\n");

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line);

                if (data.status) {
                  lastStatus = data.status;
                  if (onProgress) {
                    onProgress({
                      status: data.status,
                      completed: data.completed || 0,
                      total: data.total || 0,
                    });
                  }
                }

                if (data.status === "success") {
                  resolve({ success: true, message: "模型拉取成功" });
                }
              } catch (parseError) {
                console.warn(`Ollama 解析拉取进度异常\n`, parseError.message);
              }
            }
          }
        });

        response.data.on("error", (error) => {
          reject(new Error("模型拉取中断"));
        });

        response.data.on("end", () => {
          if (lastStatus === "success") {
            resolve({ success: true, message: "模型拉取成功" });
          } else {
            resolve({ success: true, message: "模型拉取完成" });
          }
        });
      });
    } catch (error) {
      throw new Error("拉取模型请求失败");
    }
  }

  // 删除指定模型
  async deleteModel(modelName) {
    try {
      await axios.delete(`${this.baseUrl}/api/delete`, {
        data: { name: modelName },
        timeout: 10000,
      });
      return { success: true, message: "模型删除成功" };
    } catch (error) {
      throw new Error("删除模型失败");
    }
  }

  // 同步 Ollama 模型到数据库
  async syncModelsToDatabase() {
    try {
      const models = await this.getAvailableModels();
      const syncResults = [];

      const existingDbModels = await db.query(
        "SELECT model_id, model_name FROM ai_models WHERE model_type = 'ollama'",
      );
      const existingMap = new Map(
        existingDbModels.rows.map((m) => [m.model_name, m.model_id]),
      );

      for (const model of models) {
        try {
          const modelName = model.name;
          const modelConfig = JSON.stringify({
            size: model.size,
            modified_at: model.modified_at,
            digest: model.digest,
            details: model.details,
          });

          if (existingMap.has(modelName)) {
            // 更新现有模型
            await db.query(
              `UPDATE ai_models
               SET endpoint_url = $1, model_config = $2, is_active = true, updated_at = CURRENT_TIMESTAMP
               WHERE model_name = $3 AND model_type = 'ollama'`,
              [this.baseUrl, modelConfig, modelName],
            );
            syncResults.push({
              model: modelName,
              action: "updated",
              model_id: existingMap.get(modelName),
            });
            existingMap.delete(modelName);
          } else {
            const result = await db.query(
              `INSERT INTO ai_models (model_name, model_type, endpoint_url, model_config, is_active)
               VALUES ($1, 'ollama', $2, $3, true)
               RETURNING model_id`,
              [modelName, this.baseUrl, modelConfig],
            );
            syncResults.push({
              model: modelName,
              action: "added",
              model_id: result.rows[0].model_id,
            });
          }
        } catch (modelError) {
          console.error(`Ollama 同步模型 ${model.name} 失败\n`, modelError);
          syncResults.push({
            model: model.name,
            action: "error",
            error: modelError.message,
          });
        }
      }

      // 将 Ollama 中不存在的模型标记为非活跃
      for (const [name, id] of existingMap) {
        await db.query(
          "UPDATE ai_models SET is_active = false WHERE model_id = $1",
          [id],
        );
        syncResults.push({
          model: name,
          action: "deactivated",
          model_id: id,
        });
      }

      return {
        success: true,
        results: syncResults,
        total: models.length,
      };
    } catch (error) {
      console.error("Ollama 同步过程失败\n", error);
      throw new Error("同步模型失败");
    }
  }

  // 获取指定模型信息
  async getModelInfo(modelName) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/show`,
        {
          name: modelName,
        },
        {
          timeout: 10000,
        },
      );
      return {
        success: true,
        info: response.data,
      };
    } catch (error) {
      console.error("获取指定模型信息失败\n", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 测试模型生成
  async testModel(modelName, prompt) {
    const startTime = Date.now();
    try {
      await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: modelName,
          prompt: prompt,
          stream: false,
        },
        {
          timeout: 30000,
        },
      );
      return {
        success: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime,
      };
    }
  }

  // 全健康检查
  async healthCheck() {
    try {
      const serviceCheck = await this.checkService();

      if (!serviceCheck.available) {
        return {
          status: "unhealthy",
          message: "Ollama 服务不可用",
          error: serviceCheck.error,
        };
      }

      const models = serviceCheck.models;
      const modelTests = [];

      // 仅测试默认模型或第一个可用模型以节省资源
      const targetModel =
        this.defaultModel || (models.length > 0 ? models[0].name : null);

      if (targetModel) {
        const testResult = await this.testModel(targetModel, "Hi");
        modelTests.push({
          model: targetModel,
          working: testResult.success,
          responseTime: testResult.responseTime,
          error: testResult.error,
        });
      }

      const workingModels = modelTests.filter((test) => test.working).length;

      const status =
        workingModels > 0 || models.length > 0 ? "healthy" : "degraded";

      return {
        status,
        message: `服务存在并发现 ${models.length} 个模型`,
        details: {
          service: "available",
          totalModels: models.length,
          modelTests,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        message: "健康检查执行失败",
        error: error.message,
      };
    }
  }
}

module.exports = OllamaManager;

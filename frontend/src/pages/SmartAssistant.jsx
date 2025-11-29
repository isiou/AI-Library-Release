import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Layout,
  Card,
  Input,
  Button,
  List,
  Avatar,
  Typography,
  Space,
  Spin,
  Select,
  Tooltip,
  Modal,
  Divider,
  Tag,
  App,
} from "antd";
import {
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { aiAssistantAPI } from "../services/api";
import useAuthStore from "../stores/authStore";
import useAppStore from "../stores/appStore";
import MarkdownRenderer from "../components/MarkdownRenderer";
import "./SmartAssistant.css";

const { Content, Sider } = Layout;
const { TextArea } = Input;
const { Text, Title } = Typography;
const { Option } = Select;

const SmartAssistant = () => {
  const { user } = useAuthStore();
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const { message, modal } = App.useApp();
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  // 格式化消息时间
  const formatMessageTime = (timestamp) => {
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - messageTime) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInDays === 0) {
      if (diffInMinutes < 1) {
        return "刚刚";
      } else if (diffInMinutes < 60) {
        return `${diffInMinutes}分钟前`;
      } else {
        return messageTime.toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
      }
    } else if (diffInDays === 1) {
      return `昨天 ${messageTime.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })}`;
    } else if (diffInDays < 7) {
      const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
      return `${weekdays[messageTime.getDay()]} ${messageTime.toLocaleTimeString(
        "zh-CN",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        },
      )}`;
    } else {
      return messageTime.toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }
  };

  // 格式化会话时间
  const formatSessionTime = (timestamp) => {
    if (!timestamp) return "暂无消息";
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  // 检测移动设备
  const [sessionLoading, setSessionLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const messagesEndRef = useRef(null);
  const eventSourceRef = useRef(null);
  const inputRef = useRef(null);

  // 检测是否为移动设备
  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    const checkMobile = () => {
      const isMobileDevice =
        window.innerWidth <= 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const loadMessages = useCallback(
    async (sessionId) => {
      try {
        const response = await aiAssistantAPI.getMessages(sessionId);
        setMessages(response.messages || []);

        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
          }
        }, 100);
      } catch (error) {
        console.error("加载消息历史失败\n", error);
        message.error("加载消息历史失败");
      }
    },
    [message],
  );

  const loadSessions = useCallback(async () => {
    try {
      setSessionLoading(true);
      const response = await aiAssistantAPI.getSessions();
      setSessions(response.sessions || []);
      setCurrentSession((prev) => {
        if (prev) {
          return prev;
        }
        const firstSession = response.sessions?.[0] || null;
        if (firstSession) {
          loadMessages(firstSession.session_id);
        }
        return firstSession;
      });
    } catch (error) {
      console.error("加载会话列表失败\n", error);
      message.error("加载会话列表失败");
    } finally {
      setSessionLoading(false);
    }
  }, [loadMessages, message]);

  const loadModels = useCallback(async () => {
    try {
      const response = await aiAssistantAPI.getModels();
      setModels(response.models || []);
      const availableModels = response.models || [];
      if (availableModels.length > 0) {
        setSelectedModel((prev) => prev || availableModels[0].model_id);
      }
    } catch (error) {
      console.error("加载模型失败\n", error);
      message.error("加载模型列表失败");
    }
  }, [message]);

  useEffect(() => {
    setPageTitle("智能助手");
    setBreadcrumbs([]);
    loadSessions();
    loadModels();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [loadModels, loadSessions, setBreadcrumbs, setPageTitle]);

  // 创建新会话
  const createNewSession = async () => {
    if (!selectedModel) {
      message.warning("请先选择一个模型");
      return;
    }

    try {
      const response = await aiAssistantAPI.createSession({
        model_id: selectedModel,
        session_name: `新对话 ${new Date().toLocaleString()}`,
      });

      const newSession = response.session;
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);

      // 创建系统问候消息
      const greetingContent =
        "您好，我是人工智能助手，请问有什么可以帮助您的？";
      const modelName =
        models.find((m) => m.model_id === selectedModel)?.model_name ||
        "AI 助手";

      // 将系统问候消息保存到数据库作为系统消息
      try {
        await aiAssistantAPI.saveSystemMessage(newSession.session_id, {
          content: greetingContent,
          role: "assistant",
          metadata: {
            model_name: modelName,
            is_greeting: true,
          },
        });

        // 重新加载消息以确保显示最新的数据库内容
        await loadMessages(newSession.session_id);
      } catch (messageError) {
        console.error("保存问候消息失败:", messageError);
        // 如果保存失败在前端显示问候消息
        const greetingMessage = {
          message_id: `greeting_${Date.now()}`,
          content: greetingContent,
          role: "assistant",
          created_at: new Date().toISOString(),
          model_name: modelName,
        };
        setMessages([greetingMessage]);
      }

      message.success("创建新会话成功");

      // 自动聚焦到输入框
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 100);
    } catch (error) {
      console.error("创建会话失败\n", error);
      message.error("创建会话失败");
    }
  };

  // 删除会话
  const deleteSession = async (sessionId) => {
    try {
      await aiAssistantAPI.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));

      if (currentSession?.session_id === sessionId) {
        const remainingSessions = sessions.filter(
          (s) => s.session_id !== sessionId,
        );
        if (remainingSessions.length > 0) {
          setCurrentSession(remainingSessions[0]);
          loadMessages(remainingSessions[0].session_id);
        } else {
          setCurrentSession(null);
          setMessages([]);
        }
      }

      message.success("删除会话成功");
    } catch (error) {
      console.error("删除会话失败\n", error);
      message.error("删除会话失败");
    }
  };

  // 处理输入框键盘事件
  const handleInputKeyPress = (e) => {
    if (e.key === "Enter") {
      if (isMobile) {
        if (!e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      } else {
        if (!e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      }
    }
  };

  // 发送消息
  const sendMessage = async () => {
    if (
      !inputMessage.trim() ||
      !currentSession ||
      !selectedModel ||
      loading ||
      isStreaming
    ) {
      return;
    }

    const messageContent = inputMessage.trim();
    setInputMessage("");
    setLoading(true);
    setIsStreaming(true);
    setStreamingMessage("");

    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(
        `/api/ai-assistant/sessions/${currentSession.session_id}/messages/stream?` +
          new URLSearchParams({
            message: messageContent,
            model_id: selectedModel,
          }),
      );

      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "user_message") {
          setMessages((prev) => [...prev, data.message]);
        } else if (data.type === "content") {
          setStreamingMessage((prev) => prev + data.content);
        } else if (data.type === "done") {
          const aiMessage = {
            message_id: data.message_id,
            content: data.full_content,
            role: "assistant",
            created_at: data.created_at,
            model_name: data.model_name,
          };

          setMessages((prev) => [...prev, aiMessage]);
          setStreamingMessage("");
          setIsStreaming(false);
          setLoading(false);

          setSessions((prev) =>
            prev.map((s) =>
              s.session_id === currentSession.session_id
                ? { ...s, last_message_at: data.created_at }
                : s,
            ),
          );

          eventSource.close();
          eventSourceRef.current = null;
        } else if (data.type === "error") {
          message.error(data.message || "发送消息失败");
          setIsStreaming(false);
          setLoading(false);
          setStreamingMessage("");
          eventSource.close();
          eventSourceRef.current = null;
        }
      };

      eventSource.onerror = (error) => {
        console.error("连接中断请重试\n", error);
        message.error("连接中断请重试");
        setIsStreaming(false);
        setLoading(false);
        setStreamingMessage("");
        eventSource.close();
      };
    } catch (error) {
      console.error("发送消息失败\n", error);
      message.error("发送消息失败");
      setLoading(false);
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  // 渲染消息项
  const renderMessage = (msg) => {
    const isUser = msg.role === "user";
    const isStreaming =
      msg.role === "assistant" && msg.message_id === "streaming";

    return (
      <div
        key={msg.message_id}
        className={`message-item ${isUser ? "user-message" : "ai-message"}`}
      >
        <div className="message-avatar">
          <Avatar
            icon={isUser ? <UserOutlined /> : <RobotOutlined />}
            style={{
              backgroundColor: isUser ? "#1890ff" : "#52c41a",
            }}
          />
        </div>
        <div className="message-content">
          <div className="message-header">
            <Text strong className="message-sender">
              {isUser ? user?.nickname || "我" : msg.model_name || "智能助手"}
            </Text>
            <span className="message-time">
              {formatMessageTime(msg.created_at)}
            </span>
          </div>
          <div className="message-text">
            {isUser ? (
              // 用户消息直接显示文本
              <>
                {msg.content}
                {isStreaming && <span className="streaming-cursor">|</span>}
              </>
            ) : (
              // Markdown 渲染
              <MarkdownRenderer
                content={msg.content}
                className={isStreaming ? "streaming-content" : ""}
              />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout className="smart-assistant-layout">
      {/* 左侧会话列表 */}
      <Sider width={300} className="session-sider">
        <div className="session-header">
          <Title level={4}>智能助手</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={createNewSession}
            disabled={!selectedModel}
          >
            新对话
          </Button>
        </div>

        <div className="model-selector">
          <Text strong>选择模型：</Text>
          <Select
            value={selectedModel}
            onChange={setSelectedModel}
            style={{ width: "100%", marginTop: 8 }}
            placeholder="选择模型"
          >
            {models.map((model) => (
              <Option key={model.model_id} value={model.model_id}>
                <Space>
                  <Tag color={model.model_type === "ollama" ? "blue" : "green"}>
                    {model.model_type}
                  </Tag>
                  {model.model_name}
                </Space>
              </Option>
            ))}
          </Select>
        </div>

        <div className="session-list">
          <Spin spinning={sessionLoading}>
            <List
              dataSource={sessions}
              renderItem={(session) => (
                <List.Item
                  className={`session-item ${
                    currentSession?.session_id === session.session_id
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    setCurrentSession(session);
                    loadMessages(session.session_id);
                  }}
                >
                  <div className="session-item-content">
                    <Text ellipsis className="session-name">
                      {session.session_name}
                    </Text>
                    <span className="session-time">
                      {formatSessionTime(session.last_message_at)}
                    </span>
                    <Tooltip title="删除会话">
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          modal.confirm({
                            title: "确认删除",
                            content: "确定要删除这个会话吗？",
                            onOk: () => deleteSession(session.session_id),
                          });
                        }}
                      />
                    </Tooltip>
                  </div>
                </List.Item>
              )}
            />
          </Spin>
        </div>
      </Sider>

      {/* 右侧聊天区域 */}
      <Content className="chat-content">
        {currentSession ? (
          <>
            {/* 消息列表 */}
            <div className="messages-container">
              <div className="messages-list">
                {messages.map(renderMessage)}

                {/* 流式传输中的消息 */}
                {isStreaming &&
                  streamingMessage &&
                  renderMessage({
                    message_id: "streaming",
                    content: streamingMessage,
                    role: "assistant",
                    created_at: new Date().toISOString(),
                    model_name: models.find((m) => m.model_id === selectedModel)
                      ?.model_name,
                  })}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* 输入区域 */}
            <div className="input-area">
              <div className="input-container">
                <TextArea
                  ref={inputRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="请输入您的问题..."
                  autoSize={{ minRows: 1, maxRows: isMobile ? 3 : 4 }}
                  onPressEnter={handleInputKeyPress}
                  disabled={loading || !selectedModel}
                  style={{
                    fontSize: isMobile ? "16px" : "14px",
                  }}
                />
                <Button
                  type="primary"
                  icon={loading ? <Spin size="small" /> : <SendOutlined />}
                  onClick={sendMessage}
                  disabled={loading || !inputMessage.trim() || !selectedModel}
                  className="send-button"
                >
                  发送
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-content">
              <RobotOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />
              <Title level={3} type="secondary">
                欢迎使用智能助手
              </Title>
              <Text type="secondary">选择一个模型并创建新对话开始聊天</Text>
            </div>
          </div>
        )}
      </Content>
    </Layout>
  );
};

export default SmartAssistant;

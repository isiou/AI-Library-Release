import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Row,
  Col,
  Card,
  Statistic,
  Button,
  List,
  Avatar,
  Typography,
  Space,
  Spin,
} from "antd";
import {
  BookOutlined,
  HistoryOutlined,
  BulbOutlined,
  TrophyOutlined,
  ArrowRightOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../stores/authStore";
import useAppStore from "../stores/appStore";
import { userAPI, borrowAPI, bookAPI } from "../services/api";

const { Title, Text } = Typography;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [recentBorrows, setRecentBorrows] = useState([]);
  const [popularBooks, setPopularBooks] = useState([]);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // 并行加载数据
      const [userStatsRes, recentBorrowsRes, popularBooksRes] =
        await Promise.allSettled([
          userAPI.getStats(),
          borrowAPI.getRecords({ page: 1, limit: 5 }),
          bookAPI.getPopular({ limit: 5 }),
        ]);

      // 处理用户统计
      if (userStatsRes.status === "fulfilled") {
        setStats((prev) => ({ ...prev, ...userStatsRes.value }));
      }

      // 处理最近借阅
      if (recentBorrowsRes.status === "fulfilled") {
        setRecentBorrows(recentBorrowsRes.value.data || []);
      }

      // 处理热门书籍
      if (popularBooksRes.status === "fulfilled") {
        const popularData = popularBooksRes.value?.data || [];
        setPopularBooks(Array.isArray(popularData) ? popularData : []);
      }
    } catch (error) {
      console.error("加载仪表板数据失败\n", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setPageTitle("仪表板");
    setBreadcrumbs([]);
  }, [setPageTitle, setBreadcrumbs]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const quickActions = [
    {
      title: "图书查询",
      description: "搜索和浏览图书馆藏书",
      icon: <BookOutlined />,
      path: "/books",
      color: "#85C1E9",
    },
    {
      title: "借阅记录",
      description: "查看我的借阅历史",
      icon: <HistoryOutlined />,
      path: "/borrow",
      color: "#7DCEA0",
    },
    {
      title: "AI推荐",
      description: "获取个性化图书推荐",
      icon: <BulbOutlined />,
      path: "/recommendations",
      color: "#F7DC6F",
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <style>{`
      .custom-scroll-card .ant-card-body::-webkit-scrollbar {
          width: 6px;
      }

      .custom-scroll-card .ant-card-body::-webkit-scrollbar-track {
          background: transparent;
      }

      .custom-scroll-card .ant-card-body::-webkit-scrollbar-thumb {
          background: #e8e8e8;
          border-radius: 10px;
      }

      .custom-scroll-card .ant-card-body::-webkit-scrollbar-thumb:hover {
          background: #d1d1d1;
      }

      .dashboard-card .ant-card-body {
          padding: 24px 20px !important;
      }

      @media (max-width: 480px) {
          .dashboard-card .ant-card-body {
              padding: 24px 18px !important;
          }

          .dashboard-card .ant-list-item {
              padding: 14px 0;
          }
      }

      @media (min-width: 992px) {
          .dashboard-card .ant-card-body {
              padding: 28px 24px !important;
          }
      }

      .dashboard-card .ant-statistic-title {
          margin-bottom: 8px;
      }

      .dashboard-card .ant-list-item {
          padding: 12px 0;
      }

      .welcome-card .welcome-title {
          margin-bottom: 10px !important;
      }

      .welcome-card .welcome-subtext {
          display: block;
          margin-top: 6px !important;
          line-height: 1.6;
      }

      .welcome-card .welcome-button {
          width: auto;
          margin-top: 0;
      }

      @media (max-width: 480px) {
          .welcome-card .welcome-button {
              width: 100%;
              margin-top: 12px;
          }
      }

      .quick-actions-card .ant-card-head {
          padding: 12px 16px;
      }

      @media (max-width: 480px) {
          .quick-actions-card .ant-card-head {
              padding: 10px 14px;
          }
      }

      .quick-actions-card .ant-card-body {
          padding-top: 14px !important;
      }

      @media (min-width: 992px) {
          .quick-actions-card .ant-card-body {
              padding-top: 16px !important;
          }
      }

      .list-card .ant-card-body {
          padding-top: 14px !important;
      }

      @media (min-width: 992px) {
          .list-card .ant-card-body {
              padding-top: 16px !important;
          }
      }
      `}</style>
      {/* 欢迎信息 */}
      <Card
        className="dashboard-card welcome-card"
        style={{ marginBottom: 24 }}
      >
        <Row align="middle" gutter={[0, 12]}>
          <Col xs={24} sm={18}>
            <Title level={3} className="welcome-title" style={{ margin: 0 }}>
              欢迎回来，{user?.nickname}！
            </Title>
            <Text type="secondary" className="welcome-subtext">
              今天是个读书的好日子，让我们一起探索知识的海洋吧
            </Text>
          </Col>
          <Col xs={24} sm={6} style={{ textAlign: "right" }}>
            <Button
              className="welcome-button"
              type="primary"
              icon={<BulbOutlined />}
              onClick={() => navigate("/recommendations")}
            >
              获取 AI 推荐
            </Button>
          </Col>
        </Row>
      </Card>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-card">
            <Statistic
              title="当前借阅"
              value={stats.currentBorrows || 0}
              prefix={<BookOutlined />}
              valueStyle={{ color: "#85C1E9" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-card">
            <Statistic
              title="历史借阅"
              value={stats.totalBorrows || 0}
              prefix={<HistoryOutlined />}
              valueStyle={{ color: "#7DCEA0" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-card">
            <Statistic
              title="逾期图书"
              value={stats.overdueCount || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#F1948A" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="dashboard-card">
            <Statistic
              title="推荐接受"
              value={stats.acceptedRecommendations || 0}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: "#F7DC6F" }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 快捷操作 */}
        <Col xs={24} lg={8}>
          <Card
            className="custom-scroll-card dashboard-card quick-actions-card"
            title="快捷操作"
            style={{ height: 500, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1, overflowY: "auto" } }}
          >
            <Space direction="vertical" style={{ width: "100%" }} size="small">
              {quickActions.map((action, index) => (
                <Card
                  key={index}
                  size="small"
                  hoverable
                  onClick={() => navigate(action.path)}
                  style={{ cursor: "pointer" }}
                  styles={{ body: { padding: "12px 12px" } }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        backgroundColor: action.color + "15",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        color: action.color,
                        flex: "0 0 40px",
                      }}
                    >
                      {action.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        strong
                        style={{
                          display: "block",
                          marginBottom: 6,
                          lineHeight: 1.35,
                        }}
                      >
                        {action.title}
                      </Text>
                      <Text
                        type="secondary"
                        style={{ fontSize: 12, lineHeight: 1.5 }}
                      >
                        {action.description}
                      </Text>
                    </div>
                    <div style={{ flex: "0 0 22px", textAlign: "right" }}>
                      <ArrowRightOutlined style={{ color: "#ccc" }} />
                    </div>
                  </div>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>

        {/* 最近借阅 */}
        <Col xs={24} lg={8}>
          <Card
            className="custom-scroll-card dashboard-card list-card"
            title="最近借阅"
            extra={
              <Button type="link" onClick={() => navigate("/borrow")}>
                查看全部
              </Button>
            }
            style={{ height: 500, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1, overflowY: "auto" } }}
          >
            <List
              dataSource={recentBorrows}
              renderItem={(item) => (
                <List.Item style={{ padding: "12px 0" }}>
                  <List.Item.Meta
                    avatar={<Avatar icon={<BookOutlined />} />}
                    title={item.title}
                    description={
                      <Space direction="vertical" size={6}>
                        <Text type="secondary">{item.author}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          借阅时间：{item.borrow_date}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: "暂无借阅记录" }}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            className="custom-scroll-card dashboard-card list-card"
            title="热门图书"
            extra={
              <Button type="link" onClick={() => navigate("/books")}>
                查看更多
              </Button>
            }
            style={{ height: 500, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1, overflowY: "auto" } }}
          >
            <List
              dataSource={popularBooks}
              renderItem={(item, index) => (
                <List.Item style={{ padding: "12px 0" }}>
                  <List.Item.Meta
                    avatar={
                      <Avatar
                        style={{
                          backgroundColor: index < 3 ? "#F7DC6F" : "#d9d9d9",
                          color: "#fff",
                        }}
                      >
                        {index + 1}
                      </Avatar>
                    }
                    title={item.title}
                    description={
                      <Space direction="vertical" size={6}>
                        <Text type="secondary">{item.author}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          借阅次数：{item.borrow_count || 0}
                        </Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: "暂无数据" }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;

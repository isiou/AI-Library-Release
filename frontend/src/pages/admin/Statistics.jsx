import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Space,
  Button,
  Table,
  Tag,
  Progress,
  List,
  Avatar,
  Typography,
  Divider,
  Alert,
  Empty,
  App as AntdApp,
} from "antd";
import {
  UserOutlined,
  BookOutlined,
  ReadOutlined,
  TrophyOutlined,
  RiseOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CalendarOutlined,
  BarChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import useAppStore from "../../stores/appStore";
import { adminAPI, borrowAPI } from "../../services/api";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const Statistics = () => {
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const { message } = AntdApp.useApp();

  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(1, "year"),
    dayjs(),
  ]);
  const [timeGranularity, setTimeGranularity] = useState("day");

  // 添加图表重渲染状态
  const [chartKey, setChartKey] = useState(Date.now());
  const fullscreenChangeRef = useRef(null);

  // 统计数据
  const [overview, setOverview] = useState({});
  const [borrowTrends, setBorrowTrends] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [popularBooks, setPopularBooks] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    setPageTitle("数据统计");
    setBreadcrumbs([
      { title: "管理员", path: "/admin" },
      { title: "数据统计" },
    ]);
  }, [setBreadcrumbs, setPageTitle]);

  const loadStatistics = useCallback(async () => {
    setLoading(true);
    try {
      const [start, end] =
        Array.isArray(dateRange) && dateRange?.[0] && dateRange?.[1]
          ? dateRange
          : [dayjs().subtract(1, "year"), dayjs()];

      const params = {
        start_date: start.format("YYYY-MM-DD"),
        end_date: end.format("YYYY-MM-DD"),
        granularity: timeGranularity,
      };

      const results = await Promise.allSettled([
        adminAPI.getOverviewStats(params),
        adminAPI.getBorrowTrends(params),
        adminAPI.getCategoryStats(params),
        adminAPI.getUserActivity(params),
        adminAPI.getPopularBooks(params),
        adminAPI.getRecentActivity(params),
        borrowAPI.getAdminStats(),
      ]);

      const [
        overviewRes,
        trendsRes,
        categoryRes,
        activityRes,
        popularRes,
        recentRes,
        borrowStatsRes,
      ] = results;

      const overviewData =
        overviewRes.status === "fulfilled" ? overviewRes.value.data || {} : {};
      const trendsData =
        trendsRes.status === "fulfilled" ? trendsRes.value.data || [] : [];
      const categoryData =
        categoryRes.status === "fulfilled" ? categoryRes.value.data || [] : [];
      const activityData =
        activityRes.status === "fulfilled" ? activityRes.value.data || [] : [];
      const popularData =
        popularRes.status === "fulfilled" ? popularRes.value.data || [] : [];
      const recentData =
        recentRes.status === "fulfilled" ? recentRes.value.data || [] : [];
      const borrowStats =
        borrowStatsRes.status === "fulfilled" ? borrowStatsRes.value || {} : {};

      setOverview({
        ...overviewData,
        overdue_count: borrowStats.overdue ?? 0,
      });
      setBorrowTrends(trendsData);
      const normalizedCategory = (categoryData || [])
        .map((d) => ({
          ...d,
          count: Number(d?.count ?? 0),
        }))
        .filter((d) => d.category && d.count >= 0);
      setCategoryStats(normalizedCategory);
      setUserActivity(activityData);
      setPopularBooks(popularData);
      setRecentActivity(recentData);

      try {
        const maxBorrow = trendsData.reduce(
          (acc, cur) => (cur.borrow_count > acc.borrow_count ? cur : acc),
          { borrow_count: -1, date: null },
        );
        const weekdayMap = [
          "周日",
          "周一",
          "周二",
          "周三",
          "周四",
          "周五",
          "周六",
        ];
        const peakDay = maxBorrow.date
          ? weekdayMap[dayjs(maxBorrow.date).day()]
          : undefined;
        const popularCategory = categoryData?.[0]?.category;
        setOverview((prev) => ({
          ...prev,
          peak_day: peakDay,
          popular_category: popularCategory,
        }));
      } catch (summaryError) {
        console.warn("统计摘要计算失败\n", summaryError);
      }

      const failedCount = results.filter((r) => r.status === "rejected").length;
      if (failedCount > 0) {
        message.warning({
          content: `有 ${failedCount} 项数据加载失败，其余已显示`,
          key: "stats-load-fail",
          duration: 3,
        });
      }
    } catch (error) {
      console.error("加载统计数据失败\n", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, message, timeGranularity]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStatistics();
    }, 400);
    return () => clearTimeout(timer);
  }, [loadStatistics]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }
    const handleFullscreenChange = () => {
      setTimeout(() => {
        setChartKey(Date.now());
      }, 100);
    };

    const handleResize = () => {
      // 窗口尺寸变化时防抖重绘图表
      if (fullscreenChangeRef.current) {
        clearTimeout(fullscreenChangeRef.current);
      }
      fullscreenChangeRef.current = setTimeout(() => {
        setChartKey(Date.now());
      }, 150);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange,
      );
      window.removeEventListener("resize", handleResize);

      if (fullscreenChangeRef.current) {
        clearTimeout(fullscreenChangeRef.current);
      }
    };
  }, []);

  const handleExportReport = async () => {
    try {
      const [start, end] =
        Array.isArray(dateRange) && dateRange?.[0] && dateRange?.[1]
          ? dateRange
          : [dayjs().subtract(1, "year"), dayjs()];

      const params = {
        start_date: start.format("YYYY-MM-DD"),
        end_date: end.format("YYYY-MM-DD"),
        format: "excel",
      };

      const response = await adminAPI.exportStatistics(params);

      // 创建下载链接
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `library_statistics_${dayjs().format("YYYY-MM-DD")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error(
        "导出报告失败: " + (error.response?.data?.message || error.message),
      );
    }
  };

  // 强制刷新图表渲染
  const handleRefreshCharts = () => {
    setChartKey(Date.now());
    message.success({
      content: "图表已刷新",
      key: "chart-refresh",
      duration: 2,
    });
  };

  const COLORS = [
    "#1890ff",
    "#52c41a",
    "#faad14",
    "#f5222d",
    "#722ed1",
    "#13c2c2",
  ];

  const popularBooksColumns = [
    {
      title: "排名",
      key: "rank",
      width: 60,
      render: (_, __, index) => (
        <div style={{ textAlign: "center" }}>
          {index < 3 ? (
            <TrophyOutlined
              style={{
                color:
                  index === 0 ? "#ffd700" : index === 1 ? "#c0c0c0" : "#cd7f32",
                fontSize: 16,
              }}
            />
          ) : (
            <span>{index + 1}</span>
          )}
        </div>
      ),
    },
    {
      title: "图书信息",
      key: "book_info",
      render: (_, record) => (
        <Space>
          <Avatar
            src={record.cover_url}
            icon={<BookOutlined />}
            size="large"
            shape="square"
          />
          <div>
            <div style={{ fontWeight: "bold" }}>{record.title}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{record.author}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "借阅次数",
      dataIndex: "borrow_count",
      key: "borrow_count",
      width: 100,
      render: (count) => (
        <Statistic value={count} valueStyle={{ fontSize: 16 }} suffix="次" />
      ),
    },
    {
      title: "当前状态",
      dataIndex: "available_copies",
      key: "available_copies",
      width: 120,
      render: (available, record) => {
        const total = Number(record?.total_copies);
        const avail = Number(available);
        const valid =
          Number.isFinite(total) &&
          total > 0 &&
          Number.isFinite(avail) &&
          avail >= 0;
        if (valid) {
          const percent = Math.round((avail / total) * 100);
          return (
            <div>
              <Progress
                percent={percent}
                size="small"
                status={
                  avail === 0
                    ? "exception"
                    : avail < total * 0.3
                      ? "active"
                      : "success"
                }
              />
              <Text style={{ fontSize: 12 }}>
                可借: {avail}/{total}
              </Text>
            </div>
          );
        }
        return <Tag>库存未知</Tag>;
      },
    },
  ];

  const activityColumns = [
    {
      title: "时间",
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
      render: (date) => dayjs(date).format("MM-DD HH:mm"),
    },
    {
      title: "用户",
      dataIndex: "user_name",
      key: "user_name",
      width: 100,
    },
    {
      title: "操作",
      dataIndex: "action",
      key: "action",
      width: 80,
      render: (action) => {
        const actionMap = {
          borrow: { color: "blue", text: "借阅" },
          return: { color: "green", text: "归还" },
          renew: { color: "orange", text: "续借" },
          overdue: { color: "red", text: "逾期" },
        };
        const config = actionMap[action] || { color: "default", text: action };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: "图书",
      dataIndex: "book_title",
      key: "book_title",
      ellipsis: true,
    },
  ];

  return (
    <div>
      {/* 控制面板 */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="large">
              <div>
                <Text strong>时间范围: </Text>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) =>
                    setDateRange(
                      dates || [dayjs().subtract(1, "year"), dayjs()],
                    )
                  }
                  style={{ marginLeft: 8 }}
                />
              </div>
              <div>
                <Text strong>时间粒度：</Text>
                <Select
                  value={timeGranularity}
                  onChange={setTimeGranularity}
                  style={{ marginLeft: 8, width: 100 }}
                >
                  <Option value="day">按天</Option>
                  <Option value="week">按周</Option>
                  <Option value="month">按月</Option>
                </Select>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={loadStatistics}
                loading={loading}
              >
                刷新数据
              </Button>
              <Button
                icon={<BarChartOutlined />}
                onClick={handleRefreshCharts}
                title="如果图表显示异常，点击强制刷新"
              >
                刷新图表
              </Button>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExportReport}
              >
                导出报告
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 概览统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={overview.total_users}
              prefix={<UserOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总图书数"
              value={overview.total_books}
              prefix={<BookOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总借阅次数"
              value={overview.total_borrows}
              prefix={<ReadOutlined />}
              valueStyle={{ color: "#faad14" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前借阅数"
              value={overview.current_borrows}
              prefix={<RiseOutlined />}
              valueStyle={{ color: "#f5222d" }}
            />
          </Card>
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* 借阅趋势 */}
        <Col span={16}>
          <Card
            title={
              <Space>
                <LineChartOutlined />
                <span>借阅趋势</span>
              </Space>
            }
          >
            <ResponsiveContainer
              width="100%"
              height={300}
              key={`borrow-trends-${chartKey}-${dateRange?.[0]?.format("YYYYMMDD") || "none"}-${dateRange?.[1]?.format("YYYYMMDD") || "none"}-${timeGranularity}`}
              debounce={50}
            >
              <AreaChart
                data={borrowTrends}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => dayjs(value).format("YYYY-MM")}
                  minTickGap={40}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #d9d9d9",
                    borderRadius: "6px",
                  }}
                  labelFormatter={(value) => dayjs(value).format("YYYY-MM-DD")}
                />
                <Legend wrapperStyle={{ paddingTop: "20px" }} />
                <Area
                  type="monotone"
                  dataKey="borrow_count"
                  stroke="#1890ff"
                  fill="#1890ff"
                  fillOpacity={0.3}
                  name="借阅次数"
                  animationDuration={300}
                />
                <Area
                  type="monotone"
                  dataKey="return_count"
                  stroke="#52c41a"
                  fill="#52c41a"
                  fillOpacity={0.3}
                  name="归还次数"
                  animationDuration={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* 分类统计 */}
        <Col span={8}>
          <Card
            title={
              <Space>
                <PieChartOutlined />
                <span>分类分布</span>
              </Space>
            }
          >
            {(() => {
              const pieData = (categoryStats || []).filter(
                (d) => (Number(d.count) || 0) > 0,
              );
              if (pieData.length === 0) {
                return (
                  <div
                    style={{
                      height: 300,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Empty description="暂无分类数据" />
                  </div>
                );
              }
              return (
                <ResponsiveContainer
                  width="100%"
                  height={300}
                  key={`${dateRange?.[0]?.format("YYYYMMDD") || "none"}-${dateRange?.[1]?.format("YYYYMMDD") || "none"}-${timeGranularity}`}
                >
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      nameKey="category"
                      label={({ name, percent }) =>
                        Number.isFinite(percent) && percent >= 0.08
                          ? `${name} ${(percent * 100).toFixed(0)}%`
                          : null
                      }
                      outerRadius={100}
                      paddingAngle={2}
                      minAngle={4}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                    />
                  </PieChart>
                </ResponsiveContainer>
              );
            })()}
          </Card>
        </Col>
      </Row>

      {/* 用户活跃度 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <LineChartOutlined />
                <span>用户活跃度</span>
              </Space>
            }
          >
            <ResponsiveContainer
              width="100%"
              height={300}
              key={`user-activity-${chartKey}-${dateRange?.[0]?.format("YYYYMMDD") || "none"}-${dateRange?.[1]?.format("YYYYMMDD") || "none"}-${timeGranularity}`}
              debounce={50}
            >
              <LineChart
                data={userActivity}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => dayjs(value).format("YYYY-MM")}
                  minTickGap={40}
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid #d9d9d9",
                    borderRadius: "6px",
                  }}
                  labelFormatter={(value) => dayjs(value).format("YYYY-MM-DD")}
                />
                <Legend
                  // 优化图例显示
                  wrapperStyle={{ paddingTop: "20px" }}
                />
                <Line
                  type="monotone"
                  dataKey="active_users"
                  stroke="#1890ff"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                  name="活跃用户"
                  animationDuration={1000}
                />
                <Line
                  type="monotone"
                  dataKey="new_users"
                  stroke="#52c41a"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                  name="新增用户"
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* 热门图书和最近活动 */}
      <Row gutter={16}>
        <Col span={14}>
          <Card
            title={
              <Space>
                <TrophyOutlined />
                <span>热门图书排行</span>
              </Space>
            }
            style={{ height: 400, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1, overflowY: "auto" } }}
          >
            <Table
              columns={popularBooksColumns}
              dataSource={popularBooks}
              rowKey="book_id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col span={10}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>最近活动</span>
              </Space>
            }
            extra={
              <Button type="link" size="small">
                查看更多
              </Button>
            }
            style={{ height: 400, display: "flex", flexDirection: "column" }}
            styles={{ body: { flex: 1, overflowY: "auto" } }}
          >
            <Table
              columns={activityColumns}
              dataSource={recentActivity}
              rowKey={(record) =>
                `${record.reader_id}-${record.book_title}-${record.created_at}`
              }
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* 数据洞察 */}
      <Card title="数据洞察" style={{ marginTop: 24 }}>
        {(() => {
          const totalBorrows = Number(overview.total_borrows || 0);
          const overdueCount = Number(overview.overdue_count || 0);
          const overdueRate =
            totalBorrows > 0
              ? ((overdueCount / totalBorrows) * 100).toFixed(1)
              : "0.0";

          const sortedTrends = (borrowTrends || [])
            .filter((d) => Number(d.borrow_count) >= 0)
            .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
          const firstTrend = sortedTrends[0];
          const lastTrend = sortedTrends[sortedTrends.length - 1];
          const peakBorrow = sortedTrends.reduce(
            (acc, cur) =>
              cur.borrow_count > (acc.borrow_count || -1) ? cur : acc,
            { borrow_count: -1, date: null },
          );
          const borrowGrowth =
            firstTrend && lastTrend && Number(firstTrend.borrow_count) > 0
              ? (
                  ((Number(lastTrend.borrow_count) -
                    Number(firstTrend.borrow_count)) /
                    Number(firstTrend.borrow_count)) *
                  100
                ).toFixed(1)
              : "0.0";
          const peakBorrowDay = peakBorrow.date
            ? dayjs(peakBorrow.date).format("YYYY-MM-DD")
            : undefined;
          const peakBorrowWeekday = peakBorrow.date
            ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][
                dayjs(peakBorrow.date).day()
              ]
            : undefined;

          const categoryData = (categoryStats || []).filter(
            (d) => d.category && Number(d.count) > 0,
          );
          const categoryTotal = categoryData.reduce(
            (sum, d) => sum + Number(d.count),
            0,
          );
          const topCategory = categoryData[0];
          const topCategoryName = topCategory?.category;
          const topCategoryShare =
            categoryTotal > 0 && topCategory
              ? ((Number(topCategory.count) / categoryTotal) * 100).toFixed(1)
              : undefined;

          const activityData = (userActivity || []).filter(
            (d) => Number(d.active_users) >= 0,
          );
          const peakActivity = activityData.reduce(
            (acc, cur) =>
              cur.active_users > (acc.active_users || -1) ? cur : acc,
            { active_users: -1, date: null },
          );
          const peakActiveDate = peakActivity.date
            ? dayjs(peakActivity.date).format("YYYY-MM-DD")
            : undefined;

          const topBook = (popularBooks || [])[0];

          return (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Alert
                    message="借阅高峰"
                    description={
                      peakBorrowDay
                        ? `最高 ${Number(peakBorrow.borrow_count)} 次，出现在 ${peakBorrowDay}（${peakBorrowWeekday}）`
                        : "暂无借阅趋势数据"
                    }
                    type="info"
                    showIcon
                  />
                </Col>
                <Col span={8}>
                  <Alert
                    message="热门分类"
                    description={
                      topCategoryName && topCategoryShare
                        ? `${topCategoryName} 占比约 ${topCategoryShare}%`
                        : "暂无分类占比数据"
                    }
                    type="success"
                    showIcon
                  />
                </Col>
                <Col span={8}>
                  <Alert
                    message="逾期率"
                    description={`逾期 ${overdueCount} 本，占总借阅约 ${overdueRate}%`}
                    type="warning"
                    showIcon
                  />
                </Col>
              </Row>

              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={8}>
                  <Alert
                    message="借阅增长"
                    description={
                      firstTrend && lastTrend
                        ? `${Number(borrowGrowth) >= 0 ? "增长" : "下降"} ${Math.abs(Number(borrowGrowth)).toFixed(1)}%（${dayjs(firstTrend.date).format("MM/DD")} → ${dayjs(lastTrend.date).format("MM/DD")}）`
                        : "暂无增长数据"
                    }
                    type={Number(borrowGrowth) >= 0 ? "success" : "error"}
                    showIcon
                  />
                </Col>
                <Col span={8}>
                  <Alert
                    message="活跃峰值"
                    description={
                      peakActiveDate
                        ? `最高活跃用户 ${Number(peakActivity.active_users)}，出现在 ${peakActiveDate}`
                        : "暂无活跃数据"
                    }
                    type="info"
                    showIcon
                  />
                </Col>
                <Col span={8}>
                  <Alert
                    message="热门图书"
                    description={
                      topBook
                        ? `${topBook.title} 借阅 ${Number(topBook.borrow_count || 0)} 次`
                        : "暂无热门图书数据"
                    }
                    type="success"
                    showIcon
                  />
                </Col>
              </Row>
            </>
          );
        })()}
      </Card>
    </div>
  );
};

export default Statistics;

import React, { useEffect, useState, useCallback } from "react";
import {
  Table,
  Card,
  Button,
  Space,
  Input,
  Select,
  DatePicker,
  Tag,
  Row,
  Col,
  Statistic,
  Avatar,
  Tooltip,
  Descriptions,
  Modal,
} from "antd";
import {
  UserOutlined,
  BookOutlined,
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import useAppStore from "../../stores/appStore";
import { borrowAPI, adminAPI } from "../../services/api";
import dayjs from "dayjs";

const { Option } = Select;
const { RangePicker } = DatePicker;

const UserBorrowRecords = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { setPageTitle, setBreadcrumbs } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    startDate: null,
    endDate: null,
  });
  const { current: currentPage, pageSize } = pagination;
  const { search, status, startDate, endDate } = filters;
  const [searchText, setSearchText] = useState("");
  const [statistics, setStatistics] = useState({
    total: 0,
    borrowed: 0,
    returned: 0,
    overdue: 0,
  });

  const loadUserInfo = useCallback(async () => {
    if (!userId) {
      return;
    }
    try {
      const response = await adminAPI.getStudent(userId);
      setUserInfo(response.data.user);
    } catch (error) {
      console.error("加载用户信息失败\n", error);
    }
  }, [userId]);

  const loadBorrowRecords = useCallback(async () => {
    if (!userId) {
      return;
    }
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        search: search || undefined,
        status: status || undefined,
        startDate: startDate ? startDate.format("YYYY-MM-DD") : undefined,
        endDate: endDate ? endDate.format("YYYY-MM-DD") : undefined,
      };

      const response = await borrowAPI.getUserRecords(userId, params);
      setRecords(response.data.records || []);
      setUserInfo(response.data.user);
      setPagination((prev) => ({
        ...prev,
        total: response.data.pagination?.total || 0,
      }));

      const stats = {
        total: response.data.pagination?.total || 0,
        borrowed: 0,
        returned: 0,
        overdue: 0,
      };

      (response.data.records || []).forEach((record) => {
        if (record.status === "borrowed") {
          stats.borrowed++;
          if (dayjs().isAfter(dayjs(record.due_date))) {
            stats.overdue++;
          }
        } else if (record.status === "returned") {
          stats.returned++;
        }
      });

      setStatistics(stats);
    } catch (error) {
      console.error("加载借阅记录失败\n", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, endDate, pageSize, search, startDate, status, userId]);

  useEffect(() => {
    if (userId) {
      loadUserInfo();
      loadBorrowRecords();
    }
  }, [loadBorrowRecords, loadUserInfo, userId]);

  useEffect(() => {
    if (userInfo) {
      setPageTitle(`${userInfo.name}的借阅记录`);
      setBreadcrumbs([
        { title: "管理员", path: "/admin" },
        { title: "学生管理", path: "/admin/users" },
        { title: `${userInfo.name}的借阅记录` },
      ]);
    }
  }, [userInfo, setPageTitle, setBreadcrumbs]);

  const handleSearch = (value) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleDateRangeChange = (dates) => {
    setFilters((prev) => ({
      ...prev,
      startDate: dates ? dates[0] : null,
      endDate: dates ? dates[1] : null,
    }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleTableChange = (paginationInfo) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationInfo.current,
      pageSize: paginationInfo.pageSize,
    }));
  };

  const getStatusTag = (status, dueDate) => {
    const map = {
      borrowed: {
        color: dayjs().isAfter(dayjs(dueDate)) ? "red" : "blue",
        text: dayjs().isAfter(dayjs(dueDate)) ? "逾期" : "借阅中",
      },
      returned: { color: "green", text: "已归还" },
      overdue: { color: "orange", text: "逾期归还" },
      renewed: { color: "orange", text: "已续借" },
    };
    const cfg = map[status] || { color: "default", text: status };
    return <Tag color={cfg.color}>{cfg.text}</Tag>;
  };

  const columns = [
    {
      title: "图书信息",
      dataIndex: "book",
      key: "book",
      render: (book) => (
        <div style={{ display: "flex", alignItems: "center" }}>
          <Avatar
            src={book?.cover_image}
            icon={<BookOutlined />}
            size={40}
            style={{ marginRight: 12 }}
          />
          <div>
            <div style={{ fontWeight: "bold" }}>{book?.title}</div>
            <div style={{ fontSize: "12px", color: "#666" }}>
              {book?.author} | {book?.isbn}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "借阅日期",
      dataIndex: "borrow_date",
      key: "borrow_date",
      render: (date) => dayjs(date).format("YYYY-MM-DD"),
      sorter: true,
    },
    {
      title: "应还日期",
      dataIndex: "due_date",
      key: "due_date",
      render: (date) => (
        <div>
          {dayjs(date).format("YYYY-MM-DD")}
          {dayjs().isAfter(dayjs(date)) && (
            <div style={{ color: "red", fontSize: "12px" }}>
              已逾期 {dayjs().diff(dayjs(date), "day")} 天
            </div>
          )}
        </div>
      ),
    },
    {
      title: "归还日期",
      dataIndex: "return_date",
      key: "return_date",
      render: (date) => (date ? dayjs(date).format("YYYY-MM-DD") : "-"),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status, record) => getStatusTag(status, record.due_date),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/books/${record.book?.id}`)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* 用户信息卡片 */}
      {userInfo && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col>
              <Avatar size={64} icon={<UserOutlined />} />
            </Col>
            <Col flex={1}>
              <Descriptions column={4} size="small">
                <Descriptions.Item label="姓名">
                  {userInfo.name}
                </Descriptions.Item>
                <Descriptions.Item label="账号">
                  {userInfo.student_id}
                </Descriptions.Item>
                <Descriptions.Item label="院系">
                  {userInfo.department}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={userInfo.status === "active" ? "green" : "red"}>
                    {userInfo.status === "active" ? "正常" : "禁用"}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>
        </Card>
      )}

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="总借阅次数"
              value={statistics.total}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="当前借阅"
              value={statistics.borrowed}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已归还"
              value={statistics.returned}
              prefix={<BookOutlined />}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="逾期未还"
              value={statistics.overdue}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: "#ff4d4f" }}
            />
          </Card>
        </Col>
      </Row>

      {/* 主要内容卡片 */}
      <Card>
        {/* 搜索和筛选 */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="搜索图书名称、作者、ISBN..."
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onPressEnter={() => handleSearch(searchText)}
              />
              <Button type="primary" onClick={() => handleSearch(searchText)}>
                搜索
              </Button>
            </Space.Compact>
          </Col>
          <Col span={4}>
            <Select
              placeholder="选择状态"
              allowClear
              style={{ width: "100%" }}
              onChange={(value) => handleFilterChange("status", value)}
            >
              <Option value="borrowed">借阅中</Option>
              <Option value="returned">已归还</Option>
              <Option value="overdue">逾期归还</Option>
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              placeholder={["开始日期", "结束日期"]}
              style={{ width: "100%" }}
              onChange={handleDateRangeChange}
            />
          </Col>
          <Col span={4}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadBorrowRecords}>
                刷新
              </Button>
              <Button onClick={() => navigate("/admin/users")}>返回</Button>
            </Space>
          </Col>
        </Row>

        {/* 借阅记录表格 */}
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
};

export default UserBorrowRecords;

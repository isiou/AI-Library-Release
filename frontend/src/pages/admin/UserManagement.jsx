import React, { useEffect, useState, useCallback } from "react";
import {
  Table,
  Card,
  Button,
  Space,
  Input,
  Select,
  Modal,
  Form,
  Tag,
  Popconfirm,
  DatePicker,
  Row,
  Col,
  Statistic,
  Avatar,
  Tooltip,
  Upload,
  Divider,
  App as AntdApp,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  ImportOutlined,
  UploadOutlined,
  DownloadOutlined,
  UserAddOutlined,
  TeamOutlined,
  CrownOutlined,
  KeyOutlined,
} from "@ant-design/icons";
import useAppStore from "../../stores/appStore";
import { adminAPI } from "../../services/api";

const { Option } = Select;

const UserManagement = () => {
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const { message, modal } = AntdApp.useApp();

  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    search: "",
    department: "",
  });
  const [statistics, setStatistics] = useState({
    total: 0,
    admins: 0,
  });
  const [departments, setDepartments] = useState([]);
  const [searchValue, setSearchValue] = useState("");
  const { current: currentPage, pageSize } = pagination;
  const { search, department } = filters;

  const [userModalVisible, setUserModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm] = Form.useForm();
  const [importForm] = Form.useForm();

  useEffect(() => {
    setPageTitle("用户管理");
    setBreadcrumbs([
      { title: "管理员", path: "/admin" },
      { title: "用户管理" },
    ]);
  }, [setBreadcrumbs, setPageTitle]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        search: search || undefined,
        department: department || undefined,
      };

      const response = await adminAPI.getStudents(params);
      setUsers(response.data || []);
      setPagination((prev) => ({
        ...prev,
        total: response.pagination?.total || 0,
      }));
    } catch (error) {
      message.error("加载用户列表失败: " + (error.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  }, [currentPage, department, message, pageSize, search]);

  const loadStatistics = useCallback(async () => {
    try {
      const [statsResponse, adminsResponse] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getAdmins(),
      ]);
      setStatistics({
        total: statsResponse.readers || 0,
        admins: adminsResponse.length || 0,
      });
    } catch (error) {
      console.error("加载统计数据失败\n", error);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const response = await adminAPI.getDepartments();
      setDepartments(response || []);
    } catch (error) {
      console.error("加载院系列表失败\n", error);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    loadStatistics();
    loadDepartments();
  }, [loadDepartments, loadStatistics]);

  const handleSearch = (value) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleTableChange = (paginationConfig) => {
    setPagination((prev) => ({
      ...prev,
      current: paginationConfig.current,
      pageSize: paginationConfig.pageSize,
    }));
  };

  const handleCreateUser = () => {
    setEditingUser(null);
    userForm.resetFields();
    setUserModalVisible(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    userForm.setFieldsValue(user);
    setUserModalVisible(true);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await adminAPI.deleteStudent(userId);
      message.success("删除用户成功");
      loadUsers();
      loadStatistics();
    } catch (error) {
      message.error("删除用户失败: " + (error.message || "未知错误"));
    }
  };

  const handleUserSubmit = async (values) => {
    try {
      if (editingUser) {
        await adminAPI.updateStudent(editingUser.reader_id, values);
        message.success("用户更新成功");
      } else {
        await adminAPI.createStudent(values);
        message.success("用户创建成功");
      }

      setUserModalVisible(false);
      userForm.resetFields();
      loadUsers();
      loadStatistics();
    } catch (error) {
      message.error(
        (editingUser ? "更新" : "创建") +
          " 用户失败: " +
          (error.message || "未知错误"),
      );
    }
  };

  const handleResetPassword = async (readerId) => {
    try {
      await adminAPI.resetPassword(readerId, { newPassword: readerId });
      modal.info({
        title: "密码已重置",
        content: `用户 ${readerId} 的密码已重置为 ${readerId}`,
        okText: "好的",
      });
    } catch (error) {
      message.error("重置密码失败: " + (error.message || "未知错误"));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await adminAPI.downloadStudentTemplate();
      const blob = new Blob([response], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "user_import_template.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success("模板下载成功");
    } catch (error) {
      message.error("模板下载失败: " + (error.message || "未知错误"));
    }
  };

  const handleImportUsers = async (values) => {
    try {
      const formData = new FormData();
      formData.append("file", values.file.file);
      await adminAPI.importStudents(formData);
      message.success("用户导入成功");
      setImportModalVisible(false);
      importForm.resetFields();
      loadUsers();
      loadStatistics();
    } catch (error) {
      message.error("导入失败: " + (error.message || "未知错误"));
    }
  };

  const handleToggleAdmin = async (readerId, makeAdmin) => {
    try {
      const id = String(readerId).trim();
      const make = !!makeAdmin;
      if (!id) {
        message.error("无效的用户 ID");
        return;
      }
      await adminAPI.toggleAdmin(id, { makeAdmin: make });
      message.success(makeAdmin ? "已设为管理员" : "已取消管理员权限");
      loadUsers();
      loadStatistics();
    } catch (error) {
      message.error("操作失败: " + (error.message || "未知错误"));
    }
  };

  const columns = [
    { title: "读者 ID", dataIndex: "reader_id", key: "reader_id", width: 150 },
    { title: "昵称", dataIndex: "nickname", key: "nickname", width: 150 },
    {
      title: "性别",
      dataIndex: "gender",
      key: "gender",
      width: 80,
      render: (g) => (g === "M" ? "男" : g === "F" ? "女" : g),
    },
    { title: "院系", dataIndex: "department", key: "department", width: 150 },
    {
      title: "入学年份",
      dataIndex: "enroll_year",
      key: "enroll_year",
      width: 100,
    },
    {
      title: "读者类型",
      dataIndex: "reader_type",
      key: "reader_type",
      width: 120,
    },
    {
      title: "权限",
      dataIndex: "is_admin",
      key: "is_admin",
      width: 100,
      render: (isAdmin) => (
        <Tag
          color={isAdmin ? "gold" : "default"}
          icon={isAdmin ? <CrownOutlined /> : null}
        >
          {isAdmin ? "管理员" : "普通用户"}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 280,
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => handleEditUser(record)}
            />
          </Tooltip>
          <Tooltip title={record.is_admin ? "取消管理员" : "设为管理员"}>
            <Button
              type="link"
              icon={<CrownOutlined />}
              onClick={() =>
                handleToggleAdmin(record.reader_id, !record.is_admin)
              }
              style={{
                color: record.is_admin ? "#faad14" : "#d9d9d9",
              }}
            />
          </Tooltip>
          <Tooltip title="重置密码">
            <Button
              type="link"
              icon={<KeyOutlined />}
              onClick={() => handleResetPassword(record.reader_id)}
              style={{ color: "#1890ff" }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除该用户吗？"
            onConfirm={() => handleDeleteUser(record.reader_id)}
            okText="是"
            cancelText="否"
          >
            <Tooltip title="删除">
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="总用户数"
              value={statistics.total}
              prefix={<TeamOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="管理员数"
              value={statistics.admins}
              prefix={<CrownOutlined />}
              valueStyle={{ color: "#faad14" }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="搜索读者 ID 或昵称"
                allowClear
                value={searchValue}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchValue(val);
                  if (val === "") handleSearch("");
                }}
                onPressEnter={() => handleSearch(searchValue)}
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={() => handleSearch(searchValue)}
              />
            </Space.Compact>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              placeholder="院系"
              allowClear
              style={{ width: "100%" }}
              onChange={(value) => handleFilterChange("department", value)}
            >
              {departments.map((dept) => (
                <Option key={dept} value={dept}>
                  {dept}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
        <Divider />
        <Row justify="space-between">
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={handleCreateUser}
              >
                新增用户
              </Button>
              <Button
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                批量导入
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
              >
                下载模板
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  loadUsers();
                  loadStatistics();
                }}
              >
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="reader_id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1300 }}
        />
      </Card>

      <Modal
        title={editingUser ? "编辑用户" : "新增用户"}
        open={userModalVisible}
        onCancel={() => setUserModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={userForm} layout="vertical" onFinish={handleUserSubmit}>
          <Form.Item
            label="读者 ID"
            name="reader_id"
            rules={[{ required: true, message: "请输入读者 ID" }]}
          >
            <Input placeholder="输入读者ID" disabled={!!editingUser} />
          </Form.Item>
          {editingUser && (
            <Form.Item label="昵称" name="nickname">
              <Input placeholder="输入昵称" />
            </Form.Item>
          )}
          <Form.Item
            label="性别"
            name="gender"
            rules={[{ required: true, message: "请选择性别" }]}
          >
            <Select placeholder="选择性别">
              <Option value="M">男</Option>
              <Option value="F">女</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="入学年份"
            name="enroll_year"
            rules={[{ required: true, message: "请输入入学年份" }]}
          >
            <Input placeholder="输入入学年份" type="number" />
          </Form.Item>
          <Form.Item
            label="读者类型"
            name="reader_type"
            rules={[{ required: true, message: "请选择读者类型" }]}
          >
            <Select placeholder="选择读者类型">
              <Option value="本科生">本科生</Option>
              <Option value="教师">教师</Option>
              <Option value="公共读者">公共读者</Option>
              <Option value="管理员">管理员</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="院系"
            name="department"
            rules={[{ required: true, message: "请选择院系" }]}
          >
            <Select placeholder="选择院系">
              {departments.map((dept) => (
                <Option key={dept} value={dept}>
                  {dept}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={() => setUserModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingUser ? "更新" : "创建"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量导入用户"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
      >
        <Form form={importForm} layout="vertical" onFinish={handleImportUsers}>
          <Form.Item
            label="CSV文件"
            name="file"
            rules={[{ required: true, message: "请选择 CSV 文件" }]}
          >
            <Upload beforeUpload={() => false} accept=".csv" maxCount={1}>
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
              >
                下载模板
              </Button>
              <Space>
                <Button onClick={() => setImportModalVisible(false)}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  导入
                </Button>
              </Space>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;

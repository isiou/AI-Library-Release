import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Avatar,
  Row,
  Col,
  Descriptions,
  Tabs,
  Statistic,
  List,
  Tag,
  Space,
  message,
  Modal,
  Upload,
  Select,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  SaveOutlined,
  UploadOutlined,
  BookOutlined,
  HistoryOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import useAuthStore from "../stores/authStore";
import useAppStore from "../stores/appStore";
import { userAPI, borrowAPI } from "../services/api";

const { TabPane } = Tabs;
const { Option } = Select;

const Profile = () => {
  const { user, updateUser } = useAuthStore();
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [borrowHistory, setBorrowHistory] = useState([]);
  const [passwordForm] = Form.useForm();
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  const loadUserData = useCallback(async () => {
    try {
      const statsRes = await userAPI.getStats();
      setStats(statsRes);
      const borrowRes = await borrowAPI.getRecords({ page: 1, limit: 10 });
      setBorrowHistory(borrowRes.data || []);
      form.setFieldsValue({
        nickname: user?.nickname,
        gender: user?.gender,
        department: user?.department,
        reader_type: user?.readerType,
      });
    } catch (error) {
      console.error("加载用户数据失败\n", error);
    }
  }, [form, user]);

  useEffect(() => {
    setPageTitle("个人资料");
    setBreadcrumbs([]);
    loadUserData();
  }, [loadUserData, setBreadcrumbs, setPageTitle]);

  const handleSave = async (values) => {
    setLoading(true);
    try {
      const allowedValues = {
        nickname: values.nickname,
        gender: values.gender,
      };
      await userAPI.updateProfile(allowedValues);
      updateUser(allowedValues);
      message.success("个人信息更新成功");
      setEditing(false);
    } catch (error) {
      message.error(
        "更新失败: " + (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (values) => {
    setLoading(true);
    try {
      await userAPI.changePassword(values);
      message.success("密码修改成功");
      setPasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error) {
      message.error(
        "密码修改失败: " + (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  const getBorrowStatusTag = (status) => {
    const statusMap = {
      借阅中: { color: "blue", text: "借阅中" },
      已归还: { color: "green", text: "已归还" },
      已逾期: { color: "red", text: "已逾期" },
      已续借: { color: "orange", text: "已续借" },
      borrowed: { color: "blue", text: "借阅中" },
      returned: { color: "green", text: "已归还" },
      overdue: { color: "red", text: "已逾期" },
      renewed: { color: "orange", text: "已续借" },
    };
    const config = statusMap[status] || { color: "default", text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <div>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <Card>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <Avatar
                size={100}
                icon={<UserOutlined />}
                style={{ marginBottom: 16 }}
              />
            </div>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="昵称">
                {user?.nickname}
              </Descriptions.Item>
              <Descriptions.Item label="性别">
                {user?.gender === "M"
                  ? "男"
                  : user?.gender === "F"
                    ? "女"
                    : user?.gender}
              </Descriptions.Item>
              <Descriptions.Item label="院系">
                {user?.department}
              </Descriptions.Item>
              <Descriptions.Item label="读者类型">
                {user?.readerType}
              </Descriptions.Item>
              <Descriptions.Item label="入学年份">
                {user?.enrollYear}
              </Descriptions.Item>
            </Descriptions>
            <div style={{ marginTop: 24 }}>
              <Button
                type="primary"
                block
                onClick={() => setPasswordModalVisible(true)}
              >
                修改密码
              </Button>
            </div>
          </Card>
          <Card title="我的统计" style={{ marginTop: 24 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="当前借阅"
                  value={stats.currentBorrows || 0}
                  prefix={<BookOutlined />}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="历史借阅"
                  value={stats.totalBorrows || 0}
                  prefix={<HistoryOutlined />}
                  valueStyle={{ color: "#52c41a" }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="逾期次数"
                  value={stats.overdueCount || 0}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: "#ff4d4f" }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="接受推荐"
                  value={stats.acceptedRecommendations || 0}
                  prefix={<TrophyOutlined />}
                  valueStyle={{ color: "#faad14" }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card>
            <Tabs defaultActiveKey="info">
              <TabPane tab="基本信息" key="info">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <h3>个人信息</h3>
                  {!editing ? (
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => setEditing(true)}
                    >
                      编辑
                    </Button>
                  ) : (
                    <Space>
                      <Button onClick={() => setEditing(false)}>取消</Button>
                      <Button
                        type="primary"
                        icon={<SaveOutlined />}
                        loading={loading}
                        onClick={() => form.submit()}
                      >
                        保存
                      </Button>
                    </Space>
                  )}
                </div>
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSave}
                  disabled={!editing}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        label="昵称"
                        name="nickname"
                        rules={[{ required: true, message: "请输入昵称" }]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label="性别"
                        name="gender"
                        rules={[{ required: true, message: "请选择性别" }]}
                      >
                        <Select>
                          <Option value="M">男</Option>
                          <Option value="F">女</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="院系" name="department">
                        <Input disabled />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="读者类型" name="reader_type">
                        <Input disabled />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </TabPane>
              <TabPane tab="借阅历史" key="history">
                <List
                  dataSource={borrowHistory}
                  renderItem={(item) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<BookOutlined />} />}
                        title={item.title}
                        description={`借阅于: ${new Date(
                          item.borrow_date,
                        ).toLocaleDateString()}`}
                      />
                      <div>{getBorrowStatusTag(item.status)}</div>
                    </List.Item>
                  )}
                  locale={{ emptyText: "暂无借阅记录" }}
                />
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>

      <Modal
        title="修改密码"
        open={passwordModalVisible}
        onCancel={() => setPasswordModalVisible(false)}
        footer={null}
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordChange}
        >
          <Form.Item
            label="当前密码"
            name="currentPassword"
            rules={[{ required: true, message: "请输入当前密码" }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "新密码至少 6 个字符" },
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[
              { required: true, message: "请确认新密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("newPassword") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={() => setPasswordModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                确认修改
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Profile;

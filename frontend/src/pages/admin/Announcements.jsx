import React, { useEffect, useState } from "react";
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Space,
  message,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import useAppStore from "../../stores/appStore";
import { announcementAPI } from "../../services/api";

const { Option } = Select;
const { TextArea } = Input;

const Announcements = () => {
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    setPageTitle("全局通知管理");
    setBreadcrumbs([
      { title: "管理员", path: "/admin" },
      { title: "全局通知" },
    ]);
    loadAnnouncements();
  }, [setPageTitle, setBreadcrumbs]);

  const loadAnnouncements = async () => {
    setLoading(true);
    try {
      const data = await announcementAPI.getAll();
      setAnnouncements(data);
    } catch (error) {
      message.error("加载通知失败: " + (error.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, type: "info" });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await announcementAPI.delete(id);
      message.success("删除成功");
      loadAnnouncements();
    } catch (error) {
      message.error("删除失败: " + (error.message || "未知错误"));
    }
  };

  const handleSave = async (values) => {
    try {
      if (editingId) {
        await announcementAPI.update(editingId, values);
        message.success("更新成功");
      } else {
        await announcementAPI.create(values);
        message.success("创建成功");
      }
      setModalVisible(false);
      loadAnnouncements();
    } catch (error) {
      message.error("保存失败: " + (error.message || "未知错误"));
    }
  };

  const columns = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "内容",
      dataIndex: "content",
      key: "content",
      ellipsis: true,
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      render: (type) => {
        const colors = {
          info: "blue",
          success: "green",
          warning: "orange",
          error: "red",
        };
        return <Tag color={colors[type]}>{type.toUpperCase()}</Tag>;
      },
    },
    {
      title: "状态",
      dataIndex: "is_active",
      key: "is_active",
      render: (isActive) => (
        <Tag color={isActive ? "green" : "red"}>
          {isActive ? "启用" : "禁用"}
        </Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: "操作",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这条通知吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="通知列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadAnnouncements}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新建通知
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={announcements}
          rowKey="id"
          loading={loading}
        />
      </Card>

      <Modal
        title={editingId ? "编辑通知" : "新建通知"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: "请输入标题" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: "请输入内容" }]}
          >
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item name="type" label="类型" initialValue="info">
            <Select>
              <Option value="info">通告信息</Option>
              <Option value="success">结束信息</Option>
              <Option value="warning">警告信息</Option>
              <Option value="error">严重警告</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="is_active"
            label="是否启用"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Announcements;

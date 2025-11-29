import React, { useEffect, useState, useCallback } from "react";
import {
  Modal,
  Descriptions,
  Tag,
  Button,
  Space,
  Divider,
  Alert,
  Row,
  Col,
  Card,
  Spin,
  message,
  Popconfirm,
} from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { borrowAPI } from "../services/api";

const BorrowDetailModal = ({ visible, onCancel, borrowId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [renewLoading, setRenewLoading] = useState(false);

  const loadBorrowDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await borrowAPI.getRecordById(borrowId);
      setDetail(data);
    } catch (error) {
      message.error("加载借阅详情失败: " + (error.message || "未知错误"));
      onCancel();
    } finally {
      setLoading(false);
    }
  }, [borrowId, onCancel]);

  useEffect(() => {
    if (visible && borrowId) {
      loadBorrowDetail();
    }
  }, [visible, borrowId, loadBorrowDetail]);

  const handleRenew = async () => {
    if (!detail?.canRenew) {
      message.error("当前状态下无法续借");
      return;
    }

    setRenewLoading(true);
    try {
      await borrowAPI.renew(borrowId);
      message.success("续借成功");
      loadBorrowDetail();
      onSuccess?.();
    } catch (error) {
      message.error("续借失败: " + (error.message || "未知错误"));
    } finally {
      setRenewLoading(false);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      borrowed: { color: "blue", text: "借阅中", icon: <BookOutlined /> },
      returned: {
        color: "green",
        text: "已归还",
        icon: <CheckCircleOutlined />,
      },
      overdue: {
        color: "red",
        text: "已逾期",
        icon: <ExclamationCircleOutlined />,
      },
      renewed: {
        color: "orange",
        text: "已续借",
        icon: <ClockCircleOutlined />,
      },
    };
    const config = statusMap[status] || {
      color: "default",
      text: status,
      icon: null,
    };
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  if (loading) {
    return (
      <Modal
        open={visible}
        onCancel={onCancel}
        footer={null}
        width={800}
        title="借阅详情"
      >
        <div style={{ textAlign: "center", padding: "40px" }}>
          <Spin size="large" />
        </div>
      </Modal>
    );
  }

  if (!detail) {
    return null;
  }

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>关闭</Button>
          {detail.canRenew && (
            <Popconfirm
              title="确认续借这本书吗？"
              onConfirm={handleRenew}
              okText="确认"
              cancelText="取消"
            >
              <Button
                type="primary"
                loading={renewLoading}
                icon={<ReloadOutlined />}
              >
                续借
              </Button>
            </Popconfirm>
          )}
        </Space>
      }
      width={800}
      title="借阅详情"
    >
      <Row gutter={[16, 16]}>
        {/* 状态提示 */}
        {detail.isOverdue && (
          <Col span={24}>
            <Alert
              message={`本书已逾期 ${detail.overdueDays} 天，请尽快归还！`}
              type="error"
              showIcon
              icon={<ExclamationCircleOutlined />}
            />
          </Col>
        )}

        {/* 借阅记录基本信息 */}
        <Col span={24}>
          <Card title="借阅记录信息" size="small">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="借阅ID">
                {detail.borrow_id}
              </Descriptions.Item>
              <Descriptions.Item label="借阅状态">
                {getStatusTag(detail.status)}
              </Descriptions.Item>
              <Descriptions.Item label="借阅日期">
                {dayjs(detail.borrow_date).format("YYYY-MM-DD")}
              </Descriptions.Item>
              <Descriptions.Item label="应还日期">
                <Space>
                  {dayjs(detail.due_date).format("YYYY-MM-DD")}
                  {detail.isOverdue && (
                    <Tag color="red">逾期 {detail.overdueDays} 天</Tag>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="实际归还日期" span={2}>
                {detail.return_date
                  ? dayjs(detail.return_date).format("YYYY-MM-DD")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="借阅天数" span={2}>
                {detail.borrowDays} 天
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* 图书信息 */}
        <Col span={24}>
          <Card title="图书信息" size="small">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="书名" span={2}>
                {detail.title}
              </Descriptions.Item>
              <Descriptions.Item label="作者">
                {detail.author || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="出版社">
                {detail.publisher || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="索书号">
                {detail.call_no || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="ISBN">
                {detail.isbn || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="分类">
                {detail.category || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="出版日期">
                {detail.publication_date
                  ? dayjs(detail.publication_date).format("YYYY-MM-DD")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="页数">
                {detail.pages ? `${detail.pages} 页` : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="语言">
                {detail.language || "-"}
              </Descriptions.Item>
              {detail.description && (
                <Descriptions.Item label="简介" span={2}>
                  <div style={{ maxHeight: 100, overflow: "auto" }}>
                    {detail.description}
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        {/* 读者信息 */}
        <Col span={24}>
          <Card title="读者信息" size="small">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="读者编号">
                {detail.reader_id}
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">
                {detail.reader_email || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="电话">
                {detail.reader_phone || "-"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

export default BorrowDetailModal;

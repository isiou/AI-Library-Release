import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Form, Input, Button, Alert, Select, InputNumber, message } from "antd";
import {
  UserOutlined,
  LockOutlined,
  IdcardOutlined,
  TeamOutlined,
  CalendarOutlined,
  SolutionOutlined,
} from "@ant-design/icons";
import useAuthStore from "../../stores/authStore";
import CryptoJS from "crypto-js";

const { Option } = Select;

const Register = () => {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [form] = Form.useForm();

  const handleSubmit = async (values) => {
    clearError();
    const {
      readerId,
      password,
      nickname,
      gender,
      enrollYear,
      readerType,
      department,
    } = values;

    const hashedPassword = CryptoJS.SHA256(password).toString();

    const result = await register({
      readerId,
      password: hashedPassword,
      nickname,
      gender,
      enrollYear,
      readerType,
      department,
    });
    if (result.success) {
      message.success("注册成功，请登录");
      navigate("/auth/login");
    }
  };

  return (
    <div>
      <Form
        form={form}
        name="register"
        onFinish={handleSubmit}
        layout="vertical"
        size="large"
      >
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={clearError}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form.Item
          name="readerId"
          rules={[{ required: true, message: "请输入您的读者编号" }]}
        >
          <Input prefix={<IdcardOutlined />} placeholder="读者编号" />
        </Form.Item>

        <Form.Item
          name="nickname"
          rules={[{ required: true, message: "请输入您的昵称" }]}
        >
          <Input prefix={<UserOutlined />} placeholder="昵称" />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: "请输入您的密码" }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="密码" />
        </Form.Item>

        <Form.Item
          name="confirmPassword"
          dependencies={["password"]}
          rules={[
            { required: true, message: "请确认您的密码" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("两次输入的密码不一致请重试"));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="确认密码" />
        </Form.Item>

        <Form.Item
          name="gender"
          rules={[{ required: true, message: "请选择您的性别" }]}
        >
          <Select placeholder="选择您的性别">
            <Option value="M">男</Option>
            <Option value="F">女</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="enrollYear"
          rules={[{ required: true, message: "请输入您的入学年份" }]}
        >
          <InputNumber
            prefix={<CalendarOutlined />}
            placeholder="入学年份"
            style={{ width: "100%" }}
          />
        </Form.Item>

        <Form.Item
          name="readerType"
          rules={[{ required: true, message: "请输入您的读者类型" }]}
        >
          <Input prefix={<SolutionOutlined />} placeholder="学历" />
        </Form.Item>

        <Form.Item
          name="department"
          rules={[{ required: true, message: "请输入您所在的院系" }]}
        >
          <Input prefix={<TeamOutlined />} placeholder="院系" />
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            block
            style={{ height: 48 }}
          >
            注册
          </Button>
        </Form.Item>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span>已有帐户？</span>
          <Link to="/auth/login">立即登录</Link>
        </div>
      </Form>
    </div>
  );
};

export default Register;

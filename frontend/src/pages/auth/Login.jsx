import React, { useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Form, Input, Button, Checkbox, Alert, Space } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import useAuthStore from "../../stores/authStore";
import CryptoJS from "crypto-js";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError, isAuthenticated, initialized } =
    useAuthStore();
  const [form] = Form.useForm();

  const from = location.state?.from?.pathname || "/dashboard";

  useEffect(() => {
    if (initialized && isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [initialized, isAuthenticated, navigate, from]);

  const handleSubmit = async (values) => {
    clearError();
    const hashedPassword = CryptoJS.SHA256(values.password).toString();
    const result = await login({ ...values, password: hashedPassword });

    if (result.success) {
      navigate(from, { replace: true });
    }
  };

  return (
    <div>
      <Form
        form={form}
        name="login"
        onFinish={handleSubmit}
        autoComplete="off"
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
          rules={[
            { required: true, message: "请输入账号" },
            { min: 1, message: "账号不能为空" },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="学号"
            autoComplete="username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: "请输入密码" }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="密码"
            autoComplete="current-password"
          />
        </Form.Item>

        <Form.Item>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>记住我</Checkbox>
            </Form.Item>
            <Link to="/auth/forgot-password" style={{ fontSize: 14 }}>
              忘记密码？
            </Link>
          </div>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            block
            style={{ height: 48 }}
          >
            登录
          </Button>
        </Form.Item>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Space>
            <span style={{ color: "#666" }}>还没有账号？</span>
            <Link to="/auth/register">立即注册</Link>
          </Space>
        </div>
      </Form>
    </div>
  );
};

export default Login;

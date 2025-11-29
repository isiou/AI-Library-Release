import React, { useEffect, useState } from "react";
import {
  Card,
  Row,
  Col,
  Upload,
  Button,
  Progress,
  Alert,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Select,
  Switch,
  Divider,
  Steps,
  Result,
  Typography,
  List,
  Statistic,
  App as AntdApp,
} from "antd";
import {
  UploadOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  BookOutlined,
  UserOutlined,
  HistoryOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import useAppStore from "../../stores/appStore";
import { adminAPI } from "../../services/api";
import dayjs from "dayjs";

const { Step } = Steps;
const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const DataImport = () => {
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const { message, modal } = AntdApp.useApp();

  const [activeTab, setActiveTab] = useState("books");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [importConfig, setImportConfig] = useState({
    update_existing: false,
    skip_errors: true,
    batch_size: 100,
  });

  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);

  const [configForm] = Form.useForm();

  useEffect(() => {
    setPageTitle("数据导入");
    setBreadcrumbs([
      { title: "管理员", path: "/admin" },
      { title: "数据导入" },
    ]);
    loadImportHistory();
  }, [setPageTitle, setBreadcrumbs]);

  const loadImportHistory = async () => {
    try {
      const response = await adminAPI.getImportHistory();
      setImportHistory(response.data.imports || []);
    } catch (error) {
      console.error("加载导入历史失败\n", error);
    }
  };

  const importTypes = {
    books: {
      title: "图书数据",
      icon: <BookOutlined />,
      description: "批量导入图书信息，包括书名、作者、分类等",
      templateFields: [
        "book_id",
        "title",
        "author",
        "publisher",
        "publication_year",
        "call_no",
        "language",
        "doc_type",
      ],
      sampleData: {
        book_id: "BK000001",
        title: "示例图书",
        author: "示例作者",
        publisher: "示例出版社",
        publication_year: "2023",
        call_no: "TP312/100",
        language: "中文",
        doc_type: "计算机",
      },
    },
    users: {
      title: "用户数据",
      icon: <UserOutlined />,
      description: "批量导入读者信息",
      templateFields: [
        "reader_id",
        "gender",
        "enroll_year",
        "reader_type",
        "department",
      ],
      sampleData: {
        reader_id: "PCSCS20001",
        gender: "男",
        enroll_year: "2025",
        reader_type: "本科生",
        department: "机电工程与自动化学院",
      },
    },
    borrows: {
      title: "借阅记录",
      icon: <HistoryOutlined />,
      description: "批量导入借阅记录",
      templateFields: [
        "borrow_id",
        "reader_id",
        "book_id",
        "borrow_date",
        "due_date",
        "return_date",
        "status",
      ],
      sampleData: {
        borrow_id: "BR000001",
        reader_id: "PCSCS20001",
        book_id: "BK000001",
        borrow_date: "2024-03-10",
        due_date: "2024-04-10",
        return_date: "",
        status: "borrowed",
      },
    },
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    setUploadProgress(0);
    setCurrentStep(1);
    setUploadedFile(file);

    try {
      // 预览数据
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", activeTab);
      formData.append("preview_only", "true");

      const previewResponse = await adminAPI.previewImport(formData);
      setPreviewData(previewResponse.data.preview || []);
      setCurrentStep(2);
      setPreviewModalVisible(true);
    } catch (error) {
      message.error(
        "文件预览失败: " + (error.response?.data?.message || error.message),
      );
      setCurrentStep(0);
    } finally {
      setUploading(false);
    }

    return false;
  };

  const handleConfirmImport = async () => {
    setPreviewModalVisible(false);
    setUploading(true);
    setUploadProgress(0);
    setCurrentStep(3);

    try {
      if (!uploadedFile) {
        message.error("未找到已上传文件，请重新选择文件");
        setCurrentStep(0);
        setUploading(false);
        return;
      }
      const formData = new FormData();
      formData.append("file", uploadedFile);
      formData.append("type", activeTab);
      formData.append("config", JSON.stringify(importConfig));

      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 10;
        });
      }, 500);

      const response = await adminAPI.importData(formData);

      clearInterval(progressInterval);
      setUploadProgress(100);
      setImportResult(response.data);
      setCurrentStep(4);

      loadImportHistory();
    } catch (error) {
      setImportResult({
        success: false,
        message: error.response?.data?.message || error.message,
      });
      setCurrentStep(4);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (activeTab === "users") {
      try {
        const response = await adminAPI.downloadStudentTemplate();
        const blob = new Blob([response], { type: "text/csv;charset=utf-8;" });
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
      return;
    }

    const type = importTypes[activeTab];
    const headers = type.templateFields.join(",");
    const sample = type.templateFields
      .map((field) => type.sampleData[field])
      .join(",");
    const csvContent = `\ufeff${headers}\n${sample}`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeTab}_import_template.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setUploadProgress(0);
    setImportResult(null);
    setPreviewData([]);
    setUploadedFile(null);
  };

  const getStatusTag = (status) => {
    const statusMap = {
      success: { color: "green", text: "成功" },
      failed: { color: "red", text: "失败" },
      partial: { color: "orange", text: "部分成功" },
      processing: { color: "blue", text: "处理中" },
    };
    const config = statusMap[status] || { color: "default", text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const previewColumns = [
    {
      title: "行号",
      key: "index",
      width: 60,
      render: (_, __, index) => index + 1,
    },
    ...Object.keys(importTypes[activeTab].sampleData).map((field) => ({
      title: field,
      dataIndex: field,
      key: field,
      ellipsis: true,
    })),
    {
      title: "状态",
      key: "status",
      width: 80,
      render: (_, record) =>
        record.errors && record.errors.length > 0 ? (
          <Tag color="red">错误</Tag>
        ) : (
          <Tag color="green">正常</Tag>
        ),
    },
  ];

  const historyColumns = [
    {
      title: "导入时间",
      dataIndex: "created_at",
      key: "created_at",
      render: (date) => dayjs(date).format("YYYY-MM-DD HH:mm:ss"),
    },
    {
      title: "数据类型",
      dataIndex: "type",
      key: "type",
      render: (type) => importTypes[type]?.title || type,
    },
    {
      title: "文件名",
      dataIndex: "filename",
      key: "filename",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status) => getStatusTag(status),
    },
    {
      title: "成功/总数",
      key: "stats",
      render: (_, record) => `${record.success_count}/${record.total_count}`,
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Button
          type="link"
          onClick={() => {
            modal.info({
              title: "导入详情",
              width: 600,
              content: (
                <div>
                  <p>文件名: {record.filename}</p>
                  <p>
                    导入时间:{" "}
                    {dayjs(record.created_at).format("YYYY-MM-DD HH:mm:ss")}
                  </p>
                  <p>总记录数: {record.total_count}</p>
                  <p>成功记录数: {record.success_count}</p>
                  <p>失败记录数: {record.error_count}</p>
                  {record.errors && record.errors.length > 0 && (
                    <div>
                      <p>错误信息: </p>
                      <List
                        size="small"
                        dataSource={record.errors}
                        renderItem={(error) => (
                          <List.Item>
                            <Text type="danger">
                              第 {error.row} 行: {error.message}
                            </Text>
                          </List.Item>
                        )}
                      />
                    </div>
                  )}
                </div>
              ),
            });
          }}
        >
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* 导入类型选择 */}
      <Row
        gutter={[16, 16]}
        style={{ marginBottom: 24, alignItems: "stretch" }}
      >
        {Object.entries(importTypes).map(([key, type]) => (
          <Col xs={24} sm={12} lg={8} key={key} style={{ display: "flex" }}>
            <Card
              hoverable
              className={activeTab === key ? "selected-card" : ""}
              onClick={() => {
                setActiveTab(key);
                handleReset();
              }}
              style={{
                border:
                  activeTab === key ? "2px solid #1890ff" : "1px solid #d9d9d9",
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Card.Meta
                avatar={React.cloneElement(type.icon, {
                  style: { fontSize: 24 },
                })}
                title={type.title}
                description={type.description}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 导入步骤 */}
      <Card style={{ marginBottom: 24 }}>
        <Steps current={currentStep}>
          <Step title="选择文件" icon={<UploadOutlined />} />
          <Step title="文件验证" icon={<InfoCircleOutlined />} />
          <Step title="数据预览" icon={<FileExcelOutlined />} />
          <Step title="执行导入" icon={<CheckCircleOutlined />} />
          <Step title="导入完成" icon={<CheckCircleOutlined />} />
        </Steps>
      </Card>

      {/* 主要内容区域 */}
      <Row gutter={16}>
        <Col span={16}>
          <Card title={`${importTypes[activeTab].title} 导入`}>
            {currentStep === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Upload.Dragger
                  beforeUpload={handleFileUpload}
                  accept=".csv,.xlsx,.xls"
                  showUploadList={false}
                  disabled={uploading}
                >
                  <p className="ant-upload-drag-icon">
                    <FileExcelOutlined
                      style={{ fontSize: 48, color: "#1890ff" }}
                    />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                  <p className="ant-upload-hint">
                    支持 CSV、Excel 格式文件，单次上传文件大小不超过 10MB
                  </p>
                </Upload.Dragger>

                <Divider />

                <Space>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadTemplate}
                  >
                    下载模板
                  </Button>
                  <Button
                    icon={<InfoCircleOutlined />}
                    onClick={() => setConfigModalVisible(true)}
                  >
                    导入配置
                  </Button>
                  <Button
                    icon={<HistoryOutlined />}
                    onClick={() => setHistoryModalVisible(true)}
                  >
                    导入历史
                  </Button>
                </Space>
              </div>
            )}

            {(currentStep === 1 || currentStep === 3) && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <Progress
                  type="circle"
                  percent={Math.round(uploadProgress)}
                  status={currentStep === 3 ? "active" : "normal"}
                />
                <p style={{ marginTop: 16 }}>
                  {currentStep === 1 ? "正在验证文件..." : "正在导入数据..."}
                </p>
              </div>
            )}

            {currentStep === 4 && importResult && (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <Result
                  status={importResult.success ? "success" : "error"}
                  title={importResult.success ? "导入成功" : "导入失败"}
                  subTitle={importResult.message}
                  extra={[
                    <Button key="reset" onClick={handleReset}>
                      重新导入
                    </Button>,
                    <Button
                      key="history"
                      type="primary"
                      onClick={() => setHistoryModalVisible(true)}
                    >
                      查看历史
                    </Button>,
                  ]}
                >
                  {importResult.success && importResult.stats && (
                    <div style={{ marginTop: 16 }}>
                      <Row gutter={16} justify="center">
                        <Col>
                          <Statistic
                            title="总记录数"
                            value={importResult.stats.total}
                          />
                        </Col>
                        <Col>
                          <Statistic
                            title="成功导入"
                            value={importResult.stats.success}
                            valueStyle={{ color: "#3f8600" }}
                          />
                        </Col>
                        <Col>
                          <Statistic
                            title="失败记录"
                            value={importResult.stats.failed}
                            valueStyle={{ color: "#cf1322" }}
                          />
                        </Col>
                      </Row>
                    </div>
                  )}
                </Result>
              </div>
            )}
          </Card>
        </Col>

        <Col span={8}>
          <Card title="导入说明">
            <Title level={5}>文件格式要求</Title>
            <Paragraph>
              <ul>
                <li>支持 .csv .xlsx .xls 格式</li>
                <li>文件大小不超过 10MB</li>
              </ul>
            </Paragraph>

            <Title level={5}>字段说明</Title>
            <List
              size="small"
              dataSource={importTypes[activeTab].templateFields}
              renderItem={(field) => (
                <List.Item>
                  <Text code>{field}</Text>
                  {/* 字段解释 */}
                  {/* {field === "reader_id" && " - 读者 ID"} */}
                </List.Item>
              )}
            />

            <Title level={5}>注意事项</Title>
            <Paragraph>
              <ul>
                <li>重复数据根据配置决定是否更新</li>
                <li>错误记录会被跳过并记录日志</li>
                <li>大文件建议分批导入</li>
              </ul>
            </Paragraph>
          </Card>
        </Col>
      </Row>

      {/* 数据预览模态框 */}
      <Modal
        title="数据预览"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        width={1000}
        footer={[
          <Button key="cancel" onClick={() => setPreviewModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="config"
            onClick={() => {
              setPreviewModalVisible(false);
              setConfigModalVisible(true);
            }}
          >
            导入配置
          </Button>,
          <Button key="confirm" type="primary" onClick={handleConfirmImport}>
            确认导入
          </Button>,
        ]}
      >
        <Alert
          message={`预览前 ${Math.min(previewData.length, 10)} 条记录`}
          description="请检查数据格式是否正确，确认无误后点击确认导入"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={previewColumns}
          dataSource={previewData.slice(0, 10)}
          rowKey={(_, index) => index}
          pagination={false}
          scroll={{ x: 800 }}
          size="small"
        />
      </Modal>

      {/* 导入配置模态框 */}
      <Modal
        title="导入配置"
        open={configModalVisible}
        onCancel={() => setConfigModalVisible(false)}
        onOk={() => {
          configForm.validateFields().then((values) => {
            setImportConfig(values);
            setConfigModalVisible(false);
            if (previewData.length > 0) {
              setPreviewModalVisible(true);
            }
          });
        }}
      >
        <Form form={configForm} layout="vertical" initialValues={importConfig}>
          <Form.Item
            label="更新已存在的记录"
            name="update_existing"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="跳过错误记录"
            name="skip_errors"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item label="批处理大小" name="batch_size">
            <Select>
              <Option value={50}>50</Option>
              <Option value={100}>100</Option>
              <Option value={200}>200</Option>
              <Option value={500}>500</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入历史模态框 */}
      <Modal
        title="导入历史"
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={loadImportHistory}
          >
            刷新
          </Button>,
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={1000}
      >
        <Table
          columns={historyColumns}
          dataSource={importHistory}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
          }}
        />
      </Modal>
    </div>
  );
};

export default DataImport;

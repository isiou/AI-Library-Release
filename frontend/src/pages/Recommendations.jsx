import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Button,
  Row,
  Col,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Empty,
  Spin,
  Alert,
  Tooltip,
  App as AntdApp,
  Pagination,
  Dropdown,
} from "antd";
import {
  BulbOutlined,
  BookOutlined,
  ThunderboltOutlined,
  MoreOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import useAppStore from "../stores/appStore";
import { recommendationAPI } from "../services/api";

const { TextArea } = Input;
const { Option } = Select;

const Recommendations = () => {
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const { message, modal } = AntdApp.useApp();

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [total, setTotal] = useState(0);
  const [hoveredId, setHoveredId] = useState(null);

  const [requestForm] = Form.useForm();

  const loadRecommendationHistory = useCallback(async () => {
    setLoading(true);
    try {
      // 从数据库读取推荐历史记录
      const response = await recommendationAPI.getHistory({
        page: currentPage,
        limit: pageSize,
      });
      setRecommendations(response.recommendations || []);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      message.error("加载推荐历史失败: " + (error?.message || error));
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, message]);

  useEffect(() => {
    setPageTitle("智能推荐");
    setBreadcrumbs([]);
    loadRecommendationHistory();
  }, [setPageTitle, setBreadcrumbs, loadRecommendationHistory]);

  const handleRequestRecommendation = async (values) => {
    setGenerating(true);
    try {
      const response = await recommendationAPI.list({
        query: values.keywords || "",
        limit: values.count || 8,
      });
      const newRecommendations = response.recommendations || [];
      setRecommendations(newRecommendations);
      setCurrentPage(1);
      loadRecommendationHistory();

      setRequestModalVisible(false);
      requestForm.resetFields();
      message.success("已生成新的智能推荐");
    } catch (error) {
      message.error("生成推荐失败: " + (error?.message || error));
    } finally {
      setGenerating(false);
    }
  };

  const handleReject = async (id) => {
    if (!id) return;
    try {
      await recommendationAPI.updateHistoryStatus(id, { is_rejected: true });
      message.success("已标记为不感兴趣");
      loadRecommendationHistory();
    } catch (error) {
      message.error("操作失败: " + (error?.message || error));
    }
  };

  const confirmReject = (id) => {
    modal.confirm({
      title: "确定设置为不感兴趣吗？",
      content: "该书籍将不再出现在推荐列表中",
      okText: "确定",
      cancelText: "取消",
      onOk: () => handleReject(id),
    });
  };

  const handlePageChange = (page, size) => {
    setCurrentPage(page);
    setPageSize(size);
  };

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <BulbOutlined style={{ fontSize: 24, color: "#faad14" }} />
              <div>
                <h3 style={{ margin: 0 }}>智能推荐</h3>
                <p style={{ margin: 0, color: "#666" }}>
                  结合您的阅读历史和兴趣关键词，为您推荐个性化的优质图书
                </p>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => setRequestModalVisible(true)}
                disabled={generating}
              >
                获取新推荐
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 推荐结果 */}
      <Spin spinning={loading}>
        {recommendations.length > 0 ? (
          <>
            <Row gutter={[16, 16]}>
              {recommendations.map((recommendation, index) => (
                <Col
                  xs={24}
                  sm={12}
                  lg={8}
                  xl={6}
                  key={`${recommendation.title}-${recommendation.author}-${index}`}
                >
                  <Card
                    hoverable
                    onMouseEnter={() => setHoveredId(recommendation.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    cover={
                      <div
                        style={{
                          height: 200,
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "#f5f5f5",
                          position: "relative",
                        }}
                      >
                        {hoveredId === recommendation.id && (
                          <div
                            style={{
                              position: "absolute",
                              top: 8,
                              right: 8,
                              zIndex: 10,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Dropdown
                              menu={{
                                items: [
                                  {
                                    key: "reject",
                                    label: "不感兴趣",
                                    icon: <DeleteOutlined />,
                                    danger: true,
                                    onClick: () =>
                                      confirmReject(recommendation.id),
                                  },
                                ],
                              }}
                              trigger={["click"]}
                            >
                              <Button
                                type="text"
                                shape="circle"
                                icon={<MoreOutlined />}
                                size="small"
                                style={{
                                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                                  boxShadow: "none",
                                  outline: "none",
                                }}
                              />
                            </Dropdown>
                          </div>
                        )}
                        <BookOutlined style={{ fontSize: 48, color: "#ccc" }} />
                      </div>
                    }
                  >
                    <Card.Meta
                      title={
                        <div style={{ height: 44, overflow: "hidden" }}>
                          <Tooltip title={recommendation.title}>
                            <span>{recommendation.title}</span>
                          </Tooltip>
                        </div>
                      }
                      description={
                        <Space
                          direction="vertical"
                          size="small"
                          style={{ width: "100%" }}
                        >
                          <div style={{ height: 20, overflow: "hidden" }}>
                            作者：{recommendation.author}
                          </div>
                          <div style={{ height: 20, overflow: "hidden" }}>
                            索书号：{" "}
                            {recommendation.call_number ||
                              recommendation.call_no ||
                              "暂无"}
                          </div>
                          {recommendation.reason && (
                            <Tooltip title={recommendation.reason}>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#666",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  height: 36,
                                }}
                              >
                                推荐理由：{recommendation.reason}
                              </div>
                            </Tooltip>
                          )}
                        </Space>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
            <div style={{ marginTop: 24, textAlign: "right" }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={total}
                onChange={handlePageChange}
                showSizeChanger
                pageSizeOptions={["8", "16", "24"]}
                showQuickJumper
                showTotal={(total) => `共 ${total} 条推荐`}
                locale={{ items_per_page: "条/页" }}
              />
            </div>
          </>
        ) : !generating ? (
          <Card>
            <Empty
              image={<BulbOutlined style={{ fontSize: 64, color: "#ccc" }} />}
              description={
                <div>
                  <p>还没有推荐记录</p>
                  <p style={{ color: "#666" }}>
                    点击"获取新推荐"开始您的关键词探索之旅
                  </p>
                </div>
              }
            >
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={() => setRequestModalVisible(true)}
              >
                获取推荐
              </Button>
            </Empty>
          </Card>
        ) : null}
      </Spin>

      {/* 请求推荐模态框 */}
      <Modal
        title="获取智能推荐"
        open={requestModalVisible}
        onCancel={() => {
          setRequestModalVisible(false);
          requestForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Alert
          message="智能推荐"
          description="输入您感兴趣的关键词后智能模型将结合您的阅读历史和关键词进行书籍推荐。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={requestForm}
          layout="vertical"
          onFinish={handleRequestRecommendation}
        >
          <Form.Item label="关键词" name="keywords" extra="">
            <Input placeholder="输入您感兴趣的关键词，如：科幻、悬疑、传记、编程、心理学等" />
          </Form.Item>

          <Form.Item label="推荐数量" name="count" initialValue={8}>
            <Select>
              <Option value={8}>8本</Option>
              <Option value={16}>16本</Option>
              <Option value={24}>24本</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              <Button onClick={() => setRequestModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit" loading={generating}>
                生成推荐
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Recommendations;

import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Descriptions,
  Tag,
  Space,
  message,
  Spin,
  Alert,
  Rate,
  List,
  Avatar,
} from "antd";
import {
  BookOutlined,
  ArrowLeftOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router-dom";
import useAppStore from "../stores/appStore";
import { bookAPI } from "../services/api";

const BookDetail = ({ bookId: propBookId, backPath }) => {
  const params = useParams();
  const navigate = useNavigate();
  const { setPageTitle, setBreadcrumbs } = useAppStore();

  const id = propBookId || params.id;

  const [loading, setLoading] = useState(true);
  const [book, setBook] = useState(null);
  const [relatedBooks, setRelatedBooks] = useState([]);

  const loadBookDetail = useCallback(async () => {
    if (!id) {
      return;
    }
    setLoading(true);
    try {
      const [bookRes, relatedRes] = await Promise.allSettled([
        bookAPI.getDetail(id),
        bookAPI.getRelated(id),
      ]);

      if (bookRes.status === "fulfilled") {
        setBook(bookRes.value);
      } else {
        message.error("图书不存在或已被删除");
        navigate("/books");
        return;
      }

      if (relatedRes.status === "fulfilled") {
        setRelatedBooks(relatedRes.value.data || []);
      }
    } catch (error) {
      message.error(
        "加载图书详情失败: " + (error.response?.data?.message || error.message),
      );
      navigate("/books");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadBookDetail();
  }, [loadBookDetail]);

  useEffect(() => {
    if (book) {
      setPageTitle(book.title);
      if (backPath === "/borrow") {
        setBreadcrumbs([
          { title: "首页", path: "/dashboard" },
          { title: "借阅记录", path: "/borrow" },
          { title: "详情" },
          { title: book.title },
        ]);
      } else {
        setBreadcrumbs([
          { title: "首页", path: "/dashboard" },
          { title: "图书查询", path: "/books" },
          { title: book.title },
        ]);
      }
    }
    // 组件卸载时清空面包屑
    return () => {
      setBreadcrumbs([]);
    };
  }, [book, setPageTitle, setBreadcrumbs, backPath]);

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: book.title,
        text: `推荐一本好书: ${book.title} - ${book.author}`,
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        message.success("链接已复制到剪贴板");
      });
    }
  };

  const getAvailabilityTag = (available, total) => {
    const ratio = available / total;
    let color = "red";
    let text = "无库存";

    if (available > 0) {
      if (ratio > 0.5) {
        color = "green";
        text = "充足";
      } else if (ratio > 0.2) {
        color = "orange";
        text = "紧张";
      } else {
        color = "red";
        text = "稀缺";
      }
    }

    return <Tag color={color}>{text}</Tag>;
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!book) {
    return (
      <Alert
        message="图书不存在"
        description="您访问的图书可能已被删除或不存在"
        type="error"
        showIcon
        action={
          <Button onClick={() => navigate("/books")}>返回图书列表</Button>
        }
      />
    );
  }

  return (
    <div>
      {/* 返回按钮 */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(backPath || "/books")}
        style={{ marginBottom: 16 }}
      >
        {backPath ? "返回" : "返回图书列表"}
      </Button>

      <Row gutter={[24, 24]}>
        {/* 图书基本信息 */}
        <Col xs={24} lg={16}>
          <Card>
            <Row gutter={24}>
              <Col xs={24} sm={8}>
                <div style={{ textAlign: "center" }}>
                  {book.cover_url ? (
                    <img
                      src={book.cover_url}
                      alt={book.title}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 400,
                        objectFit: "cover",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: 400,
                        backgroundColor: "#f5f5f5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 8,
                      }}
                    >
                      <BookOutlined style={{ fontSize: 64, color: "#ccc" }} />
                    </div>
                  )}
                </div>
              </Col>

              <Col xs={24} sm={16}>
                <Space
                  direction="vertical"
                  size="large"
                  style={{ width: "100%" }}
                >
                  <div>
                    <h1 style={{ margin: 0, fontSize: 24 }}>{book.title}</h1>
                    <p style={{ fontSize: 16, color: "#666", margin: "8px 0" }}>
                      {book.author}
                    </p>
                    {book.rating && (
                      <div>
                        <Rate disabled defaultValue={book.rating} />
                        <span style={{ marginLeft: 8 }}>
                          {book.rating} ({book.review_count || 0} 评价)
                        </span>
                      </div>
                    )}
                  </div>

                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="图书编号">
                      {book.book_id}
                    </Descriptions.Item>
                    <Descriptions.Item label="出版社">
                      {book.publisher}
                    </Descriptions.Item>
                    <Descriptions.Item label="出版年份">
                      {book.publication_year}
                    </Descriptions.Item>
                    <Descriptions.Item label="语言">
                      {book.language}
                    </Descriptions.Item>
                    <Descriptions.Item label="分类">
                      {book.doc_type}
                    </Descriptions.Item>
                    <Descriptions.Item label="索书号">
                      {book.call_no}
                    </Descriptions.Item>
                    <Descriptions.Item label="库存状态">
                      {getAvailabilityTag(
                        book.available_count,
                        book.total_count,
                      )}
                      <span style={{ marginLeft: 8 }}>
                        可借: {book.available_count} / 总数: {book.total_count}
                      </span>
                    </Descriptions.Item>
                  </Descriptions>

                  <Space wrap>
                    <Button type="primary" size="large" disabled>
                      暂未开通在线借阅
                    </Button>
                    <Button icon={<ShareAltOutlined />} onClick={handleShare}>
                      分享
                    </Button>
                  </Space>
                  <Alert
                    type="info"
                    message="如需借阅请前往图书馆柜台办理"
                    showIcon
                    style={{ marginTop: 8 }}
                  />
                </Space>
              </Col>
            </Row>
          </Card>

          {/* 图书简介 */}
          {book.description && (
            <Card title="图书简介" style={{ marginTop: 24 }}>
              <div style={{ lineHeight: 1.8, fontSize: 14 }}>
                {book.description}
              </div>
            </Card>
          )}
        </Col>

        {/* 相关推荐 */}
        <Col xs={24} lg={8}>
          <Card title="相关推荐">
            <List
              dataSource={relatedBooks}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      item.cover_url ? (
                        <Avatar src={item.cover_url} shape="square" size={48} />
                      ) : (
                        <Avatar
                          icon={<BookOutlined />}
                          shape="square"
                          size={48}
                        />
                      )
                    }
                    title={
                      <a onClick={() => navigate(`/books/${item.book_id}`)}>
                        {item.title}
                      </a>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <span>{item.author}</span>
                        <Tag color="blue">{item.doc_type || "未知类型"}</Tag>
                      </Space>
                    }
                  />
                </List.Item>
              )}
              locale={{ emptyText: "暂无相关推荐" }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default BookDetail;

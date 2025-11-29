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
  Row,
  Col,
  Statistic,
  Upload,
  Tooltip,
  App as AntdApp,
} from "antd";
import {
  BookOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  ImportOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import useAppStore from "../../stores/appStore";
import { bookAPI } from "../../services/api";

const { Option } = Select;

const BookManagement = () => {
  const { setPageTitle, setBreadcrumbs } = useAppStore();
  const { message } = AntdApp.useApp();

  const [loading, setLoading] = useState(false);
  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    search: "",
    doc_type: "",
  });
  const { current: currentPage, pageSize } = pagination;
  const { search, doc_type } = filters;
  const [categories, setCategories] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const [bookModalVisible, setBookModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [bookForm] = Form.useForm();
  const [importForm] = Form.useForm();

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: pageSize,
        search: search || undefined,
        doc_type: doc_type || undefined,
      };

      const response = await bookAPI.getAll(params);
      setBooks(response.data || []);
      setPagination((prev) => ({
        ...prev,
        total: response.pagination?.total || 0,
      }));
    } catch (error) {
      message.error("加载图书列表失败: " + (error.message || "未知错误"));
    } finally {
      setLoading(false);
    }
  }, [currentPage, doc_type, message, pageSize, search]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await bookAPI.getCategories();
      setCategories(response.data || []);
    } catch (error) {
      message.error(error.response?.data?.message || "类别加载失败");
    }
  }, [message]);

  useEffect(() => {
    setPageTitle("图书管理");
    setBreadcrumbs([
      { title: "管理员", path: "/admin" },
      { title: "图书管理" },
    ]);
  }, [setBreadcrumbs, setPageTitle]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

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

  const handleAddBook = () => {
    setEditingBook(null);
    bookForm.resetFields();
    setBookModalVisible(true);
  };

  const handleEditBook = (book) => {
    setEditingBook(book);
    bookForm.setFieldsValue(book);
    setBookModalVisible(true);
  };

  const handleDeleteBook = async (bookId) => {
    try {
      await bookAPI.delete(bookId);
      message.success("删除图书成功");
      loadBooks();
    } catch (error) {
      message.error("删除图书失败: " + (error.message || "未知错误"));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning("请选择要删除的图书");
      return;
    }

    try {
      await bookAPI.batchDelete(selectedRowKeys);
      message.success(`成功删除 ${selectedRowKeys.length} 本图书`);
      setSelectedRowKeys([]);
      loadBooks();
    } catch (error) {
      message.error("批量删除失败: " + (error.message || "未知错误"));
    }
  };

  const handleBookSubmit = async (values) => {
    try {
      if (editingBook) {
        await bookAPI.update(editingBook.book_id, values);
        message.success("图书更新成功");
      } else {
        await bookAPI.create(values);
        message.success("图书添加成功");
      }

      setBookModalVisible(false);
      loadBooks();
    } catch (error) {
      message.error(
        (editingBook ? "更新" : "添加") +
          " 图书失败: " +
          (error.message || "未知错误"),
      );
    }
  };

  const handleImport = async (values) => {
    try {
      const formData = new FormData();
      formData.append("file", values.file.file);

      await bookAPI.import(formData);
      message.success("导入成功");
      setImportModalVisible(false);
      importForm.resetFields();
      loadBooks();
    } catch (error) {
      message.error("导入失败: " + (error.message || "未知错误"));
    }
  };

  const columns = [
    { title: "书籍 ID", dataIndex: "book_id", key: "book_id", width: 150 },
    { title: "书名", dataIndex: "title", key: "title", sorter: true },
    { title: "作者", dataIndex: "author", key: "author", sorter: true },
    { title: "出版社", dataIndex: "publisher", key: "publisher" },
    {
      title: "出版年份",
      dataIndex: "publication_year",
      key: "publication_year",
      sorter: true,
      width: 100,
    },
    {
      title: "文献类型",
      dataIndex: "doc_type",
      key: "doc_type",
      render: (doc_type) => <Tag color="blue">{doc_type}</Tag>,
    },
    { title: "语言", dataIndex: "language", key: "language" },
    { title: "索书号", dataIndex: "call_no", key: "call_no" },
    {
      title: "操作",
      key: "action",
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEditBook(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这本书吗？"
            onConfirm={() => handleDeleteBook(record.book_id)}
            okText="是"
            cancelText="否"
          >
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="总图书数"
              value={pagination.total}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="已选择"
              value={selectedRowKeys.length}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                placeholder="搜索书名、作者..."
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
              placeholder="选择文档类型"
              allowClear
              style={{ width: "100%" }}
              value={filters.doc_type || undefined}
              onChange={(value) => handleFilterChange("doc_type", value)}
            >
              {categories.map((category) => {
                const value = category?.doc_type || category?.value || category;
                const label =
                  category?.name ||
                  category?.label ||
                  category?.doc_type ||
                  category;
                return (
                  <Option key={value} value={value}>
                    {label}
                  </Option>
                );
              })}
            </Select>
          </Col>
          <Col span={12}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddBook}
              >
                添加图书
              </Button>
              <Button
                icon={<ImportOutlined />}
                onClick={() => setImportModalVisible(true)}
              >
                导入
              </Button>
              <Popconfirm
                title={`确定要删除选中的 ${selectedRowKeys.length} 本图书吗？`}
                onConfirm={handleBatchDelete}
                disabled={selectedRowKeys.length === 0}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={selectedRowKeys.length === 0}
                >
                  批量删除
                </Button>
              </Popconfirm>
              <Button icon={<ReloadOutlined />} onClick={loadBooks}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>

        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={books}
          rowKey="book_id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingBook ? "编辑图书" : "添加图书"}
        open={bookModalVisible}
        onCancel={() => setBookModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form form={bookForm} layout="vertical" onFinish={handleBookSubmit}>
          <Form.Item
            name="book_id"
            label="书籍 ID"
            rules={[{ required: true, message: "请输入书籍 ID" }]}
          >
            <Input placeholder="输入书籍 ID" disabled={!!editingBook} />
          </Form.Item>
          <Form.Item
            name="title"
            label="书名"
            rules={[{ required: true, message: "请输入书名" }]}
          >
            <Input placeholder="输入书名" />
          </Form.Item>
          <Form.Item
            name="author"
            label="作者"
            rules={[{ required: true, message: "请输入作者" }]}
          >
            <Input placeholder="输入作者" />
          </Form.Item>
          <Form.Item name="publisher" label="出版社">
            <Input placeholder="输入出版社" />
          </Form.Item>
          <Form.Item name="publication_year" label="出版年份">
            <Input type="number" placeholder="输入出版年份" />
          </Form.Item>
          <Form.Item name="language" label="语言">
            <Input placeholder="输入语言" />
          </Form.Item>
          <Form.Item name="doc_type" label="文档类型">
            <Input placeholder="输入文档类型" />
          </Form.Item>
          <Form.Item name="call_no" label="索书号">
            <Input placeholder="输入索书号" />
          </Form.Item>
          <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setBookModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingBook ? "更新" : "添加"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入图书"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
      >
        <Form form={importForm} layout="vertical" onFinish={handleImport}>
          <Form.Item
            name="file"
            label="选择 CSV 文件"
            rules={[{ required: true, message: "请选择要导入的 CSV 文件" }]}
          >
            <Upload beforeUpload={() => false} accept=".csv" maxCount={1}>
              <Button icon={<UploadOutlined />}>选择文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setImportModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                导入
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BookManagement;

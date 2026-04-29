import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Card, Button, Modal, Form, Input, message, Upload, Alert, Spin } from 'antd';
import { PlusOutlined, MessageOutlined, DeleteOutlined, UploadOutlined, FileOutlined } from '@ant-design/icons';
import { getKnowledgeBases, createKnowledgeBase, deleteKnowledgeBase, uploadDocument, getDocuments } from '../services/api';

const KnowledgeBaseList = () => {
  const [kbs, setKbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKb, setSelectedKb] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // 获取知识库列表
  const fetchKnowledgeBases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getKnowledgeBases();
      setKbs(response.items);
    } catch (error) {
      console.error('获取知识库列表失败:', error);
      setError('无法连接到服务器，请确保后端服务已启动 (python -m uvicorn app.main:app --reload)');
      message.error('获取知识库列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  // 创建知识库
  const handleCreate = async (values) => {
    try {
      await createKnowledgeBase(values);
      message.success('创建成功');
      setIsModalOpen(false);
      form.resetFields();
      fetchKnowledgeBases();
    } catch (error) {
      message.error('创建失败: ' + (error.message || '未知错误'));
      console.error(error);
    }
  };

  // 删除知识库
  const handleDelete = async (id) => {
    try {
      await deleteKnowledgeBase(id);
      message.success('删除成功');
      fetchKnowledgeBases();
    } catch (error) {
      message.error('删除失败: ' + (error.message || '未知错误'));
      console.error(error);
    }
  };

  // 查看文档列表
  const handleViewDocs = async (kb) => {
    setSelectedKb(kb);
    setIsDocModalOpen(true);
    try {
      const response = await getDocuments(kb.id);
      setDocuments(response.items);
    } catch (error) {
      message.error('获取文档列表失败');
      console.error(error);
    }
  };

  // 上传文档
  const handleUpload = async (file, kbId) => {
    setUploadLoading(true);
    try {
      await uploadDocument(kbId, file);
      message.success('上传成功');
      // 刷新文档列表
      const response = await getDocuments(kbId);
      setDocuments(response.items);
      // 刷新知识库列表以更新文档计数
      fetchKnowledgeBases();
    } catch (error) {
      message.error('上传失败: ' + (error.message || '未知错误'));
      console.error(error);
    } finally {
      setUploadLoading(false);
    }
    return false; // 阻止默认上传行为
  };

  // 显示错误信息
  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="连接错误"
          description={
            <div>
              <p>{error}</p>
              <p>后端服务启动命令：</p>
              <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px' }}>
                cd backend && python -m uvicorn app.main:app --reload --port 8000
              </pre>
              <Button type="primary" onClick={fetchKnowledgeBases} style={{ marginTop: '16px' }}>
                重试
              </Button>
            </div>
          }
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
        >
          新建知识库
        </Button>
      </div>

      <Spin spinning={loading} tip="加载中...">
        <List
          grid={{ gutter: 16, column: 3 }}
          dataSource={kbs}
          renderItem={(kb) => (
            <List.Item>
              <Card
                title={kb.name}
                actions={[
                  <Button
                    icon={<MessageOutlined />}
                    onClick={() => navigate(`/knowledge/${kb.id}/chat`)}
                  >
                    对话
                  </Button>,
                  <Button
                    icon={<FileOutlined />}
                    onClick={() => handleViewDocs(kb)}
                  >
                    文档({kb.document_count})
                  </Button>,
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(kb.id)}
                  >
                    删除
                  </Button>,
                ]}
              >
                <p>{kb.description}</p>
                <p>分块数: {kb.total_chunks}</p>
              </Card>
            </List.Item>
          )}
        />
      </Spin>

      {/* 新建知识库弹窗 */}
      <Modal
        title="新建知识库"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 文档管理弹窗 */}
      <Modal
        title={`${selectedKb?.name} - 文档管理`}
        open={isDocModalOpen}
        onCancel={() => setIsDocModalOpen(false)}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Upload
            beforeUpload={(file) => handleUpload(file, selectedKb?.id)}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />} loading={uploadLoading}>
              上传文档
            </Button>
          </Upload>
          <span style={{ marginLeft: 8, color: '#999', fontSize: 12 }}>
            支持: txt, md, pdf, docx, doc (最大50MB)
          </span>
        </div>
        
        <List
          dataSource={documents}
          renderItem={(doc) => (
            <List.Item>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>{doc.filename}</span>
                <span style={{ color: '#999' }}>
                  {(doc.file_size / 1024).toFixed(1)} KB | {doc.status}
                </span>
              </div>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
};

export default KnowledgeBaseList;

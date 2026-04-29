import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Card, Button, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, MessageOutlined, DeleteOutlined } from '@ant-design/icons';

// 模拟知识库数据
const mockKnowledgeBases = [
  {
    id: '1',
    name: '产品文档',
    description: '包含产品规格、用户手册等技术文档',
    document_count: 12,
    total_chunks: 156,
    org_id: '1',
    created_by: '1',
    status: 'active',
    created_at: '2024-01-01',
    updated_at: '2024-01-01'
  },
  {
    id: '2',
    name: '销售资料',
    description: '销售话术、客户案例、竞品分析',
    document_count: 8,
    total_chunks: 89,
    org_id: '1',
    created_by: '1',
    status: 'active',
    created_at: '2024-01-02',
    updated_at: '2024-01-02'
  }
];

const KnowledgeBaseList = () => {
  const [kbs, setKbs] = useState(mockKnowledgeBases);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleCreate = async (values: { name: string; description?: string }) => {
    const newKB = {
      id: Date.now().toString(),
      ...values,
      org_id: '1',
      created_by: '1',
      status: 'active',
      document_count: 0,
      total_chunks: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setKbs(prev => [newKB, ...prev]);
    message.success('创建成功');
    setIsModalOpen(false);
    form.resetFields();
  };

  const handleDelete = (id: string) => {
    setKbs(prev => prev.filter(kb => kb.id !== id));
    message.success('删除成功');
  };

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
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(kb.id)}
                >
                  删除
                </Button>,
              ]}
            >
              <p>{kb.description}</p>
              <p>文档数: {kb.document_count}</p>
              <p>分块数: {kb.total_chunks}</p>
            </Card>
          </List.Item>
        )}
      />

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
    </div>
  );
};

export default KnowledgeBaseList;

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { List, Card, Button, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, MessageOutlined } from '@ant-design/icons';
import {
  getKnowledgeBases,
  createKnowledgeBase,
} from '../services/api';
import type { KnowledgeBase, CreateKnowledgeBaseInput } from '../types';

const KnowledgeBaseList = () => {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const { getToken } = useAuth();
  const navigate = useNavigate();

  const fetchKnowledgeBases = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getKnowledgeBases(getToken);
      setKbs(response.items);
    } catch (error) {
      console.error('API Error:', error);
      message.error('获取知识库列表失败');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  const handleCreate = async (values: CreateKnowledgeBaseInput) => {
    try {
      await createKnowledgeBase(getToken, values);
      message.success('创建成功');
      setIsModalOpen(false);
      form.resetFields();
      fetchKnowledgeBases();
    } catch (error) {
      message.error('创建失败');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <div>加载中...</div>
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
              ]}
            >
              <p>{kb.description}</p>
              <p>文档数: {kb.document_count}</p>
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

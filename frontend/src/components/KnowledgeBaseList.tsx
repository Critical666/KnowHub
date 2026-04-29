import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { List, Card, Button, Modal, Form, Input, message } from 'antd';
import { PlusOutlined, MessageOutlined } from '@ant-design/icons';
import { useKnowledgeBases } from '../hooks';

const KnowledgeBaseList = () => {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { knowledgeBases, loading, create } = useKnowledgeBases(getToken);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async (values: { name: string; description?: string }) => {
    const result = await create(values);
    if (result) {
      message.success('创建成功');
      setIsModalOpen(false);
      form.resetFields();
    } else {
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
        dataSource={knowledgeBases}
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

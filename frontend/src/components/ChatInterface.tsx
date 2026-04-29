import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Input, Button, List, Card } from 'antd';
import { SendOutlined } from '@ant-design/icons';

// 模拟消息数据
const mockMessages = [
  {
    id: '1',
    role: 'assistant',
    content: '您好！我是您的 AI 助手。我可以帮您查询知识库中的信息。请告诉我您想了解什么？'
  }
];

const ChatInterface = () => {
  const { kbId } = useParams<{ kbId: string }>();
  const [messages, setMessages] = useState(mockMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // 模拟 AI 回复
    setTimeout(() => {
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `这是关于您提问 "${input}" 的回答。\n\n基于知识库中的文档，我找到了以下相关信息...\n\n（这是模拟回复，实际应调用后端 API）`
      };
      setMessages(prev => [...prev, assistantMessage]);
      setLoading(false);
    }, 1000);
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card
        style={{
          height: 'calc(100vh - 200px)',
          display: 'flex',
          flexDirection: 'column',
        }}
        bodyStyle={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
          <List
            dataSource={messages}
            renderItem={(msg: any) => (
              <List.Item
                style={{
                  justifyContent:
                    msg.role === 'user' ? 'flex-end' : 'flex-start',
                  padding: '8px 0',
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background:
                      msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                    color: msg.role === 'user' ? 'white' : 'black',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {msg.content}
                </div>
              </List.Item>
            )}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input.TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default ChatInterface;

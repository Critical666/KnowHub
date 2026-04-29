import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Input, Button, List, Card, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { sendChatMessage } from '../services/api';
import type { Message, ChatMessageResponse } from '../types';

const ChatInterface = () => {
  const { kbId } = useParams<{ kbId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();

  const handleSend = useCallback(async () => {
    if (!input.trim() || !kbId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response: ChatMessageResponse = await sendChatMessage(getToken, kbId, {
        message: input,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: response.id,
          role: 'assistant',
          content: response.content,
          sources: response.sources,
        },
      ]);
    } catch (error) {
      message.error('发送消息失败');
    } finally {
      setLoading(false);
    }
  }, [input, kbId, getToken]);

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
            renderItem={(msg) => (
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

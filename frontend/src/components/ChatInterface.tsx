import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Input, Button, List, Card, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { sendChatMessage, getChatMessages } from '../services/api';

const ChatInterface = () => {
  const { kbId } = useParams<{ kbId: string }>();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  // 发送消息
  const handleSend = useCallback(async () => {
    if (!input.trim() || !kbId) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(kbId, {
        message: input.trim(),
        session_id: sessionId || undefined,
      });

      // 保存 session_id
      if (!sessionId) {
        setSessionId(response.session_id);
      }

      const assistantMessage = {
        id: response.id,
        role: response.role,
        content: response.content,
        sources: response.sources,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      message.error('发送消息失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [input, kbId, sessionId]);

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
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  padding: '8px 0',
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: msg.role === 'user' ? '#1890ff' : '#f0f0f0',
                    color: msg.role === 'user' ? 'white' : 'black',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                  {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 8 }}>
                        参考来源:
                      </div>
                      {msg.sources.map((source: any, idx: number) => (
                        <div key={idx} style={{ marginTop: 4 }}>
                          [{idx + 1}] 相关度: {(source.score * 100).toFixed(1)}%
                        </div>
                      ))}
                    </div>
                  )}
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

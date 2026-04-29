import { useParams } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Input, Button, List, Card } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useChat } from '../hooks';

const ChatInterface = () => {
  const { kbId } = useParams<{ kbId: string }>();
  const { getToken } = useAuth();

  const { messages, loading, sendMessage, input, setInput } = useExtendedChat({
    kbId: kbId || '',
    getToken,
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
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
            onClick={() => sendMessage(input)}
            loading={loading}
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  );
};

// 扩展 useChat hook 以包含 input 状态
import { useState } from 'react';

interface UseExtendedChatOptions {
  kbId: string;
  getToken: () => Promise<string | null>;
}

interface UseExtendedChatReturn {
  messages: ReturnType<typeof useChat>['messages'];
  loading: boolean;
  sendMessage: (content: string) => Promise<void>;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
}

function useExtendedChat(options: UseExtendedChatOptions): UseExtendedChatReturn {
  const [input, setInput] = useState('');
  const chat = useChat(options);

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    await chat.sendMessage(content);
    setInput('');
  };

  return {
    messages: chat.messages,
    loading: chat.loading,
    sendMessage,
    input,
    setInput,
  };
}

export default ChatInterface;

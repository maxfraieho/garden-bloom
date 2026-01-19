import { Layout } from '@/components/garden/Layout';
import { ChatCanvas } from '@/components/garden/ChatCanvas';

export default function ChatPage() {
  return (
    <Layout>
      <div className="container py-6">
        <div className="max-w-4xl mx-auto h-[calc(100vh-200px)]">
          <ChatCanvas 
            title="💬 Colleagues Chat" 
            className="h-full"
          />
        </div>
      </div>
    </Layout>
  );
}

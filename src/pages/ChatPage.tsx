import { useState } from 'react';
import { Layout } from '@/components/garden/Layout';
import { ChatCanvas } from '@/components/garden/ChatCanvas';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotebookLMChatTab } from '@/components/notebooklm/NotebookLMChatTab';
import { AccessZonesWall } from '@/components/garden/AccessZonesWall';
import { ProposalsInbox } from '@/components/garden/ProposalsInbox';
import { useMediaQuery } from '@/hooks/useMediaQuery';

function MobileChatLayout() {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      <TabsList className="w-full grid grid-cols-3">
        <TabsTrigger value="chat">Chat</TabsTrigger>
        <TabsTrigger value="zones">Zones</TabsTrigger>
        <TabsTrigger value="proposals">Proposals</TabsTrigger>
      </TabsList>

      <TabsContent value="chat" className="flex-1 mt-4" forceMount style={{ display: activeTab === 'chat' ? undefined : 'none' }}>
        <ChatCanvas title="💬 Colleagues Chat" className="h-full" />
      </TabsContent>

      <TabsContent value="zones" className="flex-1 mt-4" forceMount style={{ display: activeTab === 'zones' ? undefined : 'none' }}>
        <AccessZonesWall className="h-full" />
      </TabsContent>

      <TabsContent value="proposals" className="flex-1 mt-4" forceMount style={{ display: activeTab === 'proposals' ? undefined : 'none' }}>
        <ProposalsInbox className="h-full" />
      </TabsContent>
    </Tabs>
  );
}

function DesktopChatLayout() {
  return (
    <div className="h-full grid grid-cols-[1fr_340px_300px] gap-4">
      <ChatCanvas title="💬 Colleagues Chat" className="h-full" />
      <AccessZonesWall className="h-full" />
      <ProposalsInbox className="h-full" />
    </div>
  );
}

export default function ChatPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <Layout>
      <div className="container py-6">
        <div className="max-w-6xl mx-auto min-h-[calc(100vh-200px)]">
          <Tabs defaultValue="people" className="h-full flex flex-col">
            <TabsList className="w-fit">
              <TabsTrigger value="people">People</TabsTrigger>
              <TabsTrigger value="notebooklm">NotebookLM</TabsTrigger>
            </TabsList>

            <TabsContent value="people" className="flex-1 mt-4">
              {isDesktop ? <DesktopChatLayout /> : <MobileChatLayout />}
            </TabsContent>

            <TabsContent value="notebooklm" className="flex-1 mt-4">
              <NotebookLMChatTab className="h-full" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}

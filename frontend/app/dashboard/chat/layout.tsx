import { ConversationList } from "@/components/chat/conversation-list";

export default function ChatLayout({ children }: LayoutProps<"/dashboard/chat">) {
  return (
    <div className="flex h-[calc(100svh-3.5rem)]">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar/50 lg:block">
        <ConversationList />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

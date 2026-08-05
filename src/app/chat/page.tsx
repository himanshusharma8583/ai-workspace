import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/workspace";
import { AuroraBackground } from "@/components/auth/AuthShell";
import { AppHeader } from "@/components/AppHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";

export default async function ChatPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect("/login");

  return (
    <main className="relative flex h-screen flex-col bg-[#07070d] text-white">
      <AuroraBackground />
      <AppHeader orgName={ctx.organization.name} email={null} active="chat" />
      <ChatPanel orgName={ctx.organization.name} />
    </main>
  );
}

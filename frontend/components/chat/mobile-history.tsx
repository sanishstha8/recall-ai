"use client";

import { History } from "lucide-react";
import { useState } from "react";

import { ConversationList } from "@/components/chat/conversation-list";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function MobileHistoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Chat history" onClick={() => setOpen(true)}>
        <History />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Chat history</SheetTitle>
          <ConversationList onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

export function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

export function Providers({ children, client = makeClient() }: { children: ReactNode; client?: QueryClient }) {
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(ui: ReactElement, client = makeClient()) {
  return { client, ...render(<Providers client={client}>{ui}</Providers>) };
}

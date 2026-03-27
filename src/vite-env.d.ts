/// <reference types="vite/client" />

interface Navigator {
  modelContext?: {
    registerTool: (tool: {
      name: string;
      description?: string;
      inputSchema?: any;
      execute: (args: any) => Promise<any>;
    }) => void;
    unregisterTool?: (name: string) => void;
  };
}

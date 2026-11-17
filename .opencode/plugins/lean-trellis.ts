import type { Plugin } from "@opencode-ai/plugin";

export const LeanTrellisPlugin: Plugin = async ({ $ }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        try {
          await $`python3 .opencode/hooks/session-start.py`;
        } catch (_) {}
      }
    }
  };
};

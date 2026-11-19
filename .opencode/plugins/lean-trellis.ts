import { spawn } from "node:child_process";

const HOOK = ".opencode/hooks/session-start.py";

function runSessionStart(cwd: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const child = spawn("python3", [HOOK], { cwd, stdio: "ignore" });
      child.on("error", () => resolve());
      child.on("close", () => resolve());
    } catch {
      resolve();
    }
  });
}

// OpenCode v1 (legacy) server plugin.
export const LeanTrellisPlugin = async ({ directory }: { directory?: string }) => ({
  event: async ({ event }: { event: { type: string } }) => {
    if (event.type === "session.created") {
      await runSessionStart(directory ?? process.cwd());
    }
  },
});

// OpenCode v2 plugin definition: { id, setup }.
async function setup(ctx: any): Promise<void> {
  const cwd: string = ctx?.location?.directory ?? process.cwd();
  try {
    const stream = await ctx?.event?.subscribe?.({ types: ["session.created"] });
    if (stream && typeof stream[Symbol.asyncIterator] === "function") {
      (async () => {
        try {
          for await (const _event of stream) await runSessionStart(cwd);
        } catch {}
      })();
    }
  } catch {}
}

export default {
  id: "lean-trellis",
  setup,
  server: LeanTrellisPlugin,
};

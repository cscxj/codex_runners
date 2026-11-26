import { execFile } from "node:child_process";

export type Notify = (title: string, message: string) => Promise<void>;

export const notifySystem: Notify = async (title, message) => {
  if (process.env.CODEX_RUNNERS_DISABLE_NOTIFICATIONS === "1") return;
  const safeTitle = title.slice(0, 120);
  const safeMessage = message.slice(0, 240);

  if (process.platform === "darwin") {
    await run("osascript", [
      "-e",
      "on run argv",
      "-e",
      "display notification (item 2 of argv) with title (item 1 of argv)",
      "-e",
      "end run",
      safeTitle,
      safeMessage,
    ]);
    return;
  }
  if (process.platform === "linux") {
    await run("notify-send", [safeTitle, safeMessage]);
  }
};

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve) => {
    execFile(command, args, { timeout: 3_000 }, () => resolve());
  });
}

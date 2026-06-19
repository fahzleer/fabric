#!/usr/bin/env bun
// Pre-flight: start the Firebase RTDB/Storage emulators if `firebase` is on PATH,
// so cf-api and cf-commerce can read/write without a real Firebase project.
// If firebase-tools isn't installed, emit a one-line instruction and continue —
// the dev servers will still start; cf-api/cf-commerce will just return 500s
// on RTDB-touching endpoints until the emulator is running.

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const EMULATOR_PORTS = [4000, 9000, 9080, 9199, 9099];
const READY_TIMEOUT_MS = 30_000;

async function portIsOpen(port: number): Promise<boolean> {
  try {
    const conn = await Bun.connect({
      hostname: "127.0.0.1",
      port,
      socket: { data: () => {}, open: () => {}, close: () => {}, error: () => {} },
    });
    conn.end();
    return true;
  } catch {
    return false;
  }
}

async function isEmulatorRunning(): Promise<boolean> {
  for (const port of EMULATOR_PORTS) {
    if (await portIsOpen(port)) return true;
  }
  return false;
}

async function waitForEmulator(): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < READY_TIMEOUT_MS) {
    if (await portIsOpen(9000)) return true;
    await sleep(500);
  }
  return false;
}

async function firebaseIsInstalled(): Promise<boolean> {
  try {
    const proc = spawn("firebase", ["--version"], { stdio: "ignore" });
    return await new Promise<boolean>((resolve) => {
      proc.on("error", () => resolve(false));
      proc.on("exit", (code) => resolve(code === 0));
    });
  } catch {
    return false;
  }
}

console.log("\u{1F527}  fabric dev pre-flight");
console.log("─".repeat(50));

if (await isEmulatorRunning()) {
  console.log("\u2705  Firebase emulator already running (one of ports 4000/9000/9080/9199/9099 is open).\n");
} else if (!(await firebaseIsInstalled())) {
  console.log("\u26A0\uFE0F  Firebase emulator is not running and firebase-tools is not installed.");
  console.log("    cf-api and cf-commerce will fail on every Firebase RTDB/Storage call.");
  console.log("    In a separate terminal run:  bun add -g firebase-tools && bun run emulator");
  console.log("    Continuing to start dev servers anyway so you can see them come up.\n");
} else {
  console.log("\u{1F4E1}  Starting Firebase emulator (database, storage) in the background...");
  const child = spawn("firebase", ["emulators:start", "--only", "database,storage"], {
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  child.unref();
  child.stdout?.on("data", (chunk) => process.stdout.write(`  [emulator] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`  [emulator] ${chunk}`));

  const ready = await waitForEmulator();
  if (ready) {
    console.log("\u2705  Firebase emulator is up (RTDB :9000 ready).\n");
  } else {
    console.log("\u26A0\uFE0F  Firebase emulator did not become ready within 30s.");
    console.log("    Check the firebase process output. Dev servers will start anyway.\n");
  }
}

// Hand off to turbo dev. Replace this process so signals (Ctrl-C) propagate.
const turbo = spawn("bunx", ["turbo", "dev", "--filter=!worker"], {
  stdio: "inherit",
  env: process.env,
});
turbo.on("exit", (code) => process.exit(code ?? 0));
turbo.on("signal", (sig) => {
  // @ts-expect-error - signal types
  process.kill(process.pid, sig);
});

// SPDX-FileCopyrightText: 2026 Marko Ivankovic
// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/**
 * Run each scenario file in a bun of its own.
 *
 * Not merely tidy — it is the difference between a suite that passes and one
 * that stalls. Bun runs every file given to one `bun test` in a single
 * process and, at each file boundary, kills the processes that file spawned.
 * It says so, in one line: `killed 1 dangling process`. That is right for a
 * test that leaked a subprocess and wrong for these, where the browser the
 * *next* file has just launched is caught by the sweep — watched live, a
 * scenario sat at its first navigation with no browser left on the machine,
 * a dev server answering in a millisecond, and memory pressure at zero.
 *
 * A process per file also means the module state in `harness.ts` — the dev
 * server, the port it settled on — belongs to exactly one file, which is
 * what it always assumed and never had.
 *
 * Files run in order and the first failure stops the run, because a scenario
 * suite is read from the top and a second failure is rarely news.
 */

const files = [...new Bun.Glob("e2e/*.e2e.ts").scanSync(".")].sort();
if (files.length === 0) throw new Error("no scenario files in e2e/");

for (const file of files) {
  const run = Bun.spawn(["bun", "test", `./${file}`], { stdout: "inherit", stderr: "inherit" });
  const code = await run.exited;
  if (code !== 0) process.exit(code);
}

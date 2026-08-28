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
 * Files run in order and every one of them runs, even after a failure.
 *
 * It used to stop at the first, on the argument that a suite is read from the
 * top and a second failure is rarely news. That argument holds when somebody
 * is watching it run and does not hold in CI: the first file is the biggest
 * and slowest one, and when it failed there the answer to "what about the
 * other nineteen" was nothing at all. A run that stops early is a run whose
 * result is one bit wide.
 */

const files = [...new Bun.Glob("e2e/*.e2e.ts").scanSync(".")].sort();
if (files.length === 0) throw new Error("no scenario files in e2e/");

const failed: string[] = [];
for (const file of files) {
  const run = Bun.spawn(["bun", "test", `./${file}`], { stdout: "inherit", stderr: "inherit" });
  if ((await run.exited) !== 0) failed.push(file);
}

if (failed.length > 0) {
  // Said again at the end, because by then the failure itself has scrolled
  // past several thousand lines of the files that came after it.
  console.error(`\n${failed.length} of ${files.length} scenario files failed:`);
  for (const file of failed) console.error(`  ${file}`);
  process.exit(1);
}
console.error(`\nall ${files.length} scenario files passed`);

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

const every = [...new Bun.Glob("e2e/*.e2e.ts").scanSync(".")].sort();
if (every.length === 0) throw new Error("no scenario files in e2e/");
const files = shard(every, process.env.E2E_SHARD);
if (files.length < every.length) {
  console.error(`this is shard ${process.env.E2E_SHARD}: ${files.length} of ${every.length} files`);
}

// Built once, here, for all of them. The scenarios are served the built site
// rather than a dev server — see `serve` — and twenty files each spending ten
// seconds building the same thing is three minutes of a suite that is slow
// enough already.
console.error("building the site the scenarios will be served…");
const build = Bun.spawn(["bun", "run", "build"], { stdout: "ignore", stderr: "inherit" });
if ((await build.exited) !== 0) process.exit(1);

const failed: string[] = [];
for (const file of files) {
  const run = Bun.spawn(["bun", "test", `./${file}`], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env, E2E_PREBUILT: "1" },
  });
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

/**
 * The files this runner is responsible for, when the suite is split across
 * several: `E2E_SHARD=2/3` is the second of three.
 *
 * The whole suite in one job crossed CI's forty-five-minute cap on
 * 2026-09-09 and stayed over it for three pushes running, each shown as
 * *cancelled* rather than as a failure anybody would read — the last runs
 * that finished at all had taken forty. So `ci.yml` runs it as a matrix,
 * and this picks a shard's share.
 *
 * Every n-th file rather than a contiguous block: the list is sorted by
 * name, which says nothing about how long a file takes, and dealing them
 * out round-robin spreads the slow ones about as evenly as anything short
 * of timing them would. Unset, or `1/1`, means all of them.
 */
function shard(all: readonly string[], spec: string | undefined): string[] {
  if (spec === undefined || spec === "") return [...all];
  const match = /^([1-9]\d*)\/([1-9]\d*)$/.exec(spec);
  if (!match) throw new Error(`E2E_SHARD should look like 2/3, not ${JSON.stringify(spec)}`);
  const index = Number(match[1]);
  const count = Number(match[2]);
  if (index > count) throw new Error(`E2E_SHARD=${spec}: there is no shard ${index} of ${count}`);
  return all.filter((_, at) => at % count === index - 1);
}

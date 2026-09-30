/**
 * Mutation runner for the sample project.
 *
 * For each mutation: copy the project to a temp directory, change exactly one
 * production line (or block), type-check it, run the full test suite, and
 * report which tests went red.
 *
 * Two rules:
 *   1. A mutation must type-check. A mutation that does not compile is not a
 *      wrong implementation, it is a broken build, and every test touching
 *      that code "fails" whether or not it checks anything.
 *   2. A test only counts as KILLED if it failed on an assertion. A test that
 *      fails with some other error (ReferenceError, TypeError, ...) proves the
 *      line runs, not that any assertion checks its behaviour.
 *
 * Usage: npm run mutate
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const BIN = join(ROOT, "node_modules", ".bin");

interface Mutation {
  name: string;
  file: string;
  original: string;
  replacement: string;
  description: string;
  targets: string[]; // test files this mutation is meant to discriminate
}

const MUTATIONS: Mutation[] = [
  {
    name: "factory_drops_forwarding",
    file: "src/service.ts",
    original: "{ forwardCorrelation: true }",
    replacement: "{ forwardCorrelation: false }",
    description: "buildService() stops forwarding the correlation ID",
    targets: ["01-shared-fixture", "02-bypassed-construction"],
  },
  {
    name: "inverted_guard",
    file: "src/service.ts",
    original: "if (order.lines.length === 0) {",
    replacement: "if (order.lines.length !== 0) {",
    description: "an inverted guard returns early, so no order lines are processed",
    targets: ["03-negative-without-execution", "04-non-empty-collection"],
  },
  {
    name: "audit_only_first_reservation",
    file: "src/service.ts",
    original: "this.audit.push([\"reservation\", line.sku]);",
    replacement: "if (i === 0) this.audit.push([\"reservation\", line.sku]);",
    description: "only the first reservation is added to the audit trail",
    targets: ["04-non-empty-collection"],
  },
  {
    name: "seq_before_write",
    file: "src/stockLog.ts",
    original:
      "    const entries: Entry[] = movements.map((m, i) => [this.#seq + i, m]);\n" +
      "    this.store.writeAll(entries);\n" +
      "    this.#seq += entries.length;\n",
    replacement:
      "    const entries: Entry[] = [];\n" +
      "    for (const m of movements) {\n" +
      "      entries.push([this.#seq, m]);\n" +
      "      this.#seq += 1;\n" +
      "    }\n" +
      "    this.store.writeAll(entries);\n",
    description: "the sequence number advances per entry, before the write",
    targets: ["05-counter-before-durable-write"],
  },
  {
    name: "parent_on_every_line",
    file: "src/service.ts",
    original: "const parent = i === 0 ? order.id : undefined;",
    replacement: "const parent = order.id;",
    description: "parentOrderId is sent on every reservation, not just the first",
    targets: ["06-unobservable-downstream"],
  },
  {
    name: "INVALID_undefined_name",
    file: "src/supplier.ts",
    original: "const headers = outboundHeaders(",
    replacement: "const headers = outboundHdrs(",
    description: "renames a call to a function that does not exist",
    targets: [],
  },
];

type Outcome = { kind: "passed" } | { kind: "assertion"; detail: string } | { kind: "error"; detail: string };

function freshCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), "mutate-"));
  for (const item of ["src", "tests", "package.json", "tsconfig.json", "mutate.ts"]) {
    cpSync(join(ROOT, item), join(dir, item), { recursive: true });
  }
  symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"), "dir");
  return dir;
}

function typeChecks(dir: string): { ok: boolean; firstError: string } {
  const r = spawnSync(join(BIN, "tsc"), ["--noEmit", "-p", "."], { cwd: dir, encoding: "utf8" });
  const firstError = (r.stdout.split("\n").find((l) => l.includes("error TS")) ?? "").trim();
  return { ok: r.status === 0, firstError };
}

function runSuite(dir: string): Map<string, Outcome> {
  const out = join(dir, "report.json");
  spawnSync(join(BIN, "vitest"), ["run", "--reporter=json", `--outputFile=${out}`], { cwd: dir, encoding: "utf8" });
  const results = new Map<string, Outcome>();
  if (!existsSync(out)) return results;
  const report = JSON.parse(readFileSync(out, "utf8"));
  for (const file of report.testResults) {
    const fileKey = basename(file.name, ".test.ts");
    for (const t of file.assertionResults) {
      const key = `${fileKey} :: ${t.title}`;
      if (t.status === "passed") {
        results.set(key, { kind: "passed" });
        continue;
      }
      const message = String(t.failureMessages?.[0] ?? "").split("\n")[0];
      if (message.startsWith("AssertionError")) {
        results.set(key, { kind: "assertion", detail: message.replace(/^AssertionError:\s*/, "") });
      } else {
        results.set(key, { kind: "error", detail: message.split(":")[0] });
      }
    }
  }
  return results;
}

function main(): void {
  const base = freshCopy();
  const baseTypes = typeChecks(base);
  const baseline = runSuite(base);
  rmSync(base, { recursive: true, force: true });
  if (!baseTypes.ok || baseline.size === 0 || [...baseline.values()].some((o) => o.kind !== "passed")) {
    console.error("Baseline is not green (type check and all tests). Fix that before mutating anything.");
    process.exit(1);
  }
  console.log(`Baseline: type check clean, ${baseline.size} tests passing.\n`);

  const summary: { mode: string; mutation: string; hollow: string; fixed: string }[] = [];

  for (const m of MUTATIONS) {
    const work = freshCopy();
    const target = join(work, m.file);
    const source = readFileSync(target, "utf8");
    const count = source.split(m.original).length - 1;
    if (count !== 1) {
      console.error(`${m.name}: expected the original text exactly once in ${m.file}, found ${count}`);
      process.exit(1);
    }
    writeFileSync(target, source.replace(m.original, m.replacement));
    const types = typeChecks(work);
    const results = runSuite(work);
    rmSync(work, { recursive: true, force: true });

    console.log(`MUTATION  ${m.name}`);
    console.log(`          ${m.description}`);

    if (!types.ok) {
      const errored = [...results.values()].filter((o) => o.kind === "error");
      const killed = [...results.values()].filter((o) => o.kind === "assertion");
      const kinds = [...new Set(errored.map((o) => (o as { detail: string }).detail))].join(", ");
      console.log(`  Type check FAILS: ${types.firstError.replace(/^.*error /, "")}`);
      console.log(`  Tests: ${errored.length} failed with an error (${kinds}), ${killed.length} on an assertion.`);
      console.log("  VERDICT   INVALID MUTATION. It does not compile, so the red build proves");
      console.log("            nothing about whether any test checks this line.\n");
      continue;
    }

    const rows: Record<string, { hollow?: string; fixed?: string }> = {};
    for (const [key, outcome] of results) {
      const mode = key.split(" :: ")[0];
      if (!m.targets.includes(mode)) continue;
      let status: string;
      let detail = "";
      if (outcome.kind === "passed") status = "SURVIVED";
      else if (outcome.kind === "assertion") {
        status = "KILLED";
        detail = `\n            -> ${outcome.detail}`;
      } else {
        status = "ERRORED";
        detail = `  (${outcome.detail})`;
      }
      console.log(`  ${status.padEnd(9)} ${key}${detail}`);
      const kind = key.includes(":: hollow") ? "hollow" : "fixed";
      (rows[mode] ??= {})[kind] = status;
    }
    for (const [mode, r] of Object.entries(rows)) {
      summary.push({ mode, mutation: m.name, hollow: r.hollow ?? "-", fixed: r.fixed ?? "-" });
    }
    console.log();
  }

  console.log("SUMMARY");
  console.log(`  ${"failure mode".padEnd(34)} ${"mutation".padEnd(26)} ${"hollow".padEnd(10)} fixed`);
  for (const s of summary.sort((a, b) => a.mode.localeCompare(b.mode))) {
    console.log(`  ${s.mode.padEnd(34)} ${s.mutation.padEnd(26)} ${s.hollow.padEnd(10)} ${s.fixed}`);
  }
}

main();

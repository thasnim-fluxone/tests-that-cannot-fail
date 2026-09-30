# Plan-stage examples

The same verification idea applies before any code exists. An agent in
plan mode produces a document that it will also report on. These two
excerpts are for the same sub-task on the sample inventory service.

## Unverified plan (as first produced)

```markdown
### Sub-task 3: make batch writes atomic

Use StockLog.appendBatch OR introduce a new writeMovements() helper.

Tests: add a failure test for the log (details TBD).

Implementation:
    for (const m of movements) {
      entries.push([this.#seq, m]);
      this.#seq += 1;
    }
    this.store.writeAll(entries);

### Security checklist
- ✅ INV-2: all user input is sanitised before database queries
```

Five problems, none of which a quick read flags:

1. **"OR"** — a decision left open. Whoever implements it will choose.
2. **"details TBD"** — a placeholder where the test should be named.
3. **No red step.** Nothing says which test fails first, or on what assertion.
4. **The implementation advances the counter before the write.** If
   `writeAll` throws, `seq` has moved past entries that were never written.
5. **INV-2 is defined wrongly and already ticked.** The project's own docs
   define INV-2 as "API keys are never written to logs." The agent did not
   look it up; it produced a plausible definition and marked it done before
   any work existed.

## Verified plan (after revision)

```markdown
### Sub-task 3: make batch writes atomic

Approach: keep StockLog.appendBatch. No new helper.

Red:
  "a failed batch leaves nothing behind"
  - FailingStore throws on writeAll
  - expect(store.entries).toEqual([])
  - expect(log.seq).toEqual(0)      <- must fail against the current code

Green:
  Build entries from this.#seq + i. Call writeAll. Advance this.#seq
  by entries.length only after writeAll returns.

Refactor:
  None planned.

### Security checklist
- [ ] INV-2: API keys are never written to logs
      (source: docs/invariants.md, "INV-2")
```

## The verification prompt

The useful part is not the revised plan. It is refusing to accept the
agent's report that the plan was revised, and checking the file instead.

```text
MODE: Plan. VERIFY ONLY. Report, do not fix. Do not create, edit,
rename or delete any file.

1. Find every file matching the plan's name pattern. Report path, size
   and last-modified time for each. State which one you wrote to.

2. Read that file. Do not rely on your memory of the edits. For each
   check, report PASS or FAIL and quote the exact line(s) with line
   numbers as evidence. If the item is missing, report FAIL, "not found".

   a. Every sub-task has labelled Red / Green / Refactor sections, and
      the failing test comes before the production change.
   b. Every test is named, and its assertions are stated.
   c. No "OR", "either", TBD, TODO, "..." or placeholder arguments.
   d. Every checklist item is unchecked. No ticks anywhere.
   e. Every project-specific term is quoted from its source, with file
      and location. None is defined from general knowledge.
   f. Any counter or sequence advances only after the write it tracks.

3. Give the PASS and FAIL counts and list the failures by letter.
   If more than one plan file exists, say which is stale.
```

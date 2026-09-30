# Tests that cannot fail: runnable examples

Companion code for a post on test-driven development with AI coding agents.

A small, fictional inventory service in TypeScript, and six pairs of tests.
In each pair, the **hollow** test looks reasonable and passes. The **fixed**
test also passes. The difference only shows when you change one line of
production code and ask which test notices.

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm test          # all 12 tests pass
npm run mutate    # mutate one line at a time and see which tests go red
```

`sample-output.txt` holds the output of `npm run mutate`.

## The six failure modes

| # | File | Why the hollow test cannot fail | Mutation that exposes it |
|---|------|--------------------------------|--------------------------|
| 1 | `01-shared-fixture.test.ts` | The test's own client and the code under test share one recorder, so the assertion cannot tell whose request it is looking at | Factory stops forwarding the correlation ID |
| 2 | `02-bypassed-construction.test.ts` | The test builds the object graph by hand instead of using the factory production uses | Factory stops forwarding the correlation ID |
| 3 | `03-negative-without-execution.test.ts` | "Nothing bad was sent" passes when nothing was sent at all | An inverted guard returns early |
| 4 | `04-non-empty-collection.test.ts` | The collection always holds an unrelated entry, so "not empty" proves nothing | An inverted guard returns early |
| 5 | `05-counter-before-durable-write.test.ts` | Checks the store but not the counter; the "redundant" assertion is the one that matters | Counter advances before the write |
| 6 | `06-unobservable-downstream.test.ts` | The downstream fake ignores the field after the first call, so the behaviour is invisible from there | Parent ID sent on every call |

## What counts as a failing test

`npm run mutate` enforces two rules:

1. **A mutation must type-check.** It has to be a valid wrong implementation.
2. **Only an assertion failure counts as a kill.** Any other error proves the
   line runs, not that a test checks what it does.

The last mutation renames a function call to one that does not exist. The
type check fails, ten tests go red with `ReferenceError`, and the runner
reports the mutation as **invalid**. A compile error or missing symbol is the
easiest way to fake a red test, for a person or an agent.

## Plan-stage examples

`plan-examples.md` shows the same idea one step earlier: an unverified plan,
the revised plan, and the verify-only prompt that checks the plan file itself
rather than the agent's account of it.

## Note

All names, code and scenarios here are invented for illustration. They
reproduce the *shape* of problems met in real work, not the work itself.

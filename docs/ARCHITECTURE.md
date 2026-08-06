# Architecture

> **Precedence:** CONTEXT.md > GOVERNANCE.md > **ARCHITECTURE.md** > feature docs.
>
> **AI agents — read this file when:** adding signals, changing layering, modifying CloudFormation, or altering data flow.

---

## Overview

The Blockbuster Index MCP Server calculates per-state retail/digital commerce signals and aggregates them into the Blockbuster Index. Each signal runs as an independent **AWS ECS Fargate** task on a schedule, persists data in **DynamoDB**, and publishes results to **S3** for the website.

---

## High-level data flow

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Signal tasks │ → │  DynamoDB    │ → │     S3       │
│ (ECS daily)  │   │  (records)   │   │ (scores JSON)│
└──────────────┘   └──────────────┘   └──────────────┘
        │                                     │
        └──────────────┬──────────────────────┘
                       ▼
            ┌────────────────────┐
            │ Blockbuster Index  │
            │ aggregator task    │
            └────────────────────┘
                       │
                       ▼
                 S3 + DynamoDB
```

1. Signal tasks fetch/process data independently (often in parallel).
2. Signal-specific records land in DynamoDB tables.
3. Versioned signal results upload to S3.
4. Index task reads signal outputs and computes the final index.
5. Final index publishes to S3 (website) and DynamoDB (history).

---

## Code layering

```
entrypoint → service → repository
```

| Layer                    | Location                                       | Responsibility                         |
| ------------------------ | ---------------------------------------------- | -------------------------------------- |
| Entrypoint               | `src/signals/<signal>/entrypoint.ts`           | Bootstrap, orchestration, process exit |
| Calculation modules      | `src/signals/<signal>/*.ts`                    | Signal-specific compute helpers        |
| Service                  | `src/services/<signal>/`                       | Business logic, aggregation            |
| Repository               | `src/repositories/<signal>/`                   | DynamoDB access                        |
| Shared job orchestration | `src/signals/shared-job-signal-orchestration/` | Cross-signal scrape/job patterns       |
| Util                     | `src/util/`                                    | Logger, S3, retry, normalization       |
| Config                   | `src/config/config.ts`                         | Env-backed configuration               |
| Types / Constants        | `src/types/`, `src/constants/`                 | Shared contracts                       |

### Boundary rules

- Signals **must not** import other signals' directories.
- Repositories must not contain scoring policy.
- Entrypoints should not embed large business formulas — call services/helpers.
- Breaking S3 output shapes requires downstream coordination + human review.

---

## Signals

| Signal              | Role                                                |
| ------------------- | --------------------------------------------------- |
| `amazon`            | E-commerce / tech vs physical jobs + sliding window |
| `walmart`           | Physical retail vs tech jobs + sliding window       |
| `broadband`         | Connectivity metrics                                |
| `census`            | Retail establishments per population                |
| `bls`               | Historical retail employment trends                 |
| `blockbuster-index` | Weighted aggregation of signals                     |

See `docs/SIGNALS.md` for calculation details.

---

## Build & deploy shape

- **Webpack** bundles one entry per `SIGNAL_TYPE` → `src/signals/<signal>/entrypoint.ts`.
- **Docker** image builds with `SIGNAL_TYPE` arg; runs `node dist/index.js`.
- **CloudFormation** defines cluster, task definitions, EventBridge schedules, DynamoDB tables, S3 buckets, IAM.
- Environments: `dev` / `prod` parameter mappings in templates.

---

## Local development

| Mechanism           | Path                                             |
| ------------------- | ------------------------------------------------ |
| Dev runners         | `dev/runners/<signal>.dev.ts`                    |
| Local scores output | `dev/scores/`                                    |
| Scripts             | `scripts/run-signal.js`, container + ECS helpers |

```bash
make signal SIGNAL=amazon
```

---

## Scheduling

- EventBridge triggers signal tasks on staggered daily schedules.
- Index task runs after signals complete.
- Failures: retries with backoff; CloudWatch monitoring; rollback workflow available.

---

## Extension guide

Adding a signal requires code + infra + docs updates. Follow `.cursor/skills/signal-development/SKILL.md` and obtain human approval for new signals and CloudFormation changes.

# Dependency Layer Model

This project enforces a strict dependency layer order. All code must respect this hierarchy.

---

## The Six-Layer Model

```
┌──────────────────────────────────────────────────────────┐
│                        UI Layer                          │
│              (views, components, pages)                  │
├──────────────────────────────────────────────────────────┤
│                     Runtime Layer                        │
│          (servers, workers, entrypoints, CLI)            │
├──────────────────────────────────────────────────────────┤
│                     Service Layer                        │
│         (business logic, use cases, workflows)           │
├──────────────────────────────────────────────────────────┤
│                      Repo Layer                          │
│      (data access, storage adapters, external APIs)      │
├──────────────────────────────────────────────────────────┤
│                     Config Layer                         │
│            (configuration, environment, flags)           │
├──────────────────────────────────────────────────────────┤
│                     Types Layer                          │
│         (types, interfaces, schemas, constants)          │
└──────────────────────────────────────────────────────────┘
         ← each layer imports only from below →
```

**Import direction:** `Types → Config → Repo → Service → Runtime → UI`

Each layer may only import from layers *below* (earlier in the sequence) it.

---

## Layer Definitions

### Types
- **Purpose:** Foundation. Shared type definitions, interfaces, constants, enums.
- **Typical location:** `src/types/`
- **Allowed imports:** None (no internal imports)
- **Examples:** `User`, `OrderStatus`, `ApiResponse<T>`

### Config
- **Purpose:** Configuration, environment variables, feature flags.
- **Typical location:** `src/config/`
- **Allowed imports:** `types`
- **Examples:** `DatabaseConfig`, `loadEnv()`, `featureFlags`

### Repo
- **Purpose:** Data access. Storage adapters, database queries, external API clients.
- **Typical location:** `src/repo/`
- **Allowed imports:** `types`, `config`
- **Examples:** `UserRepository`, `PaymentApiClient`, `CacheAdapter`

### Service
- **Purpose:** Business logic. Use cases, workflows, domain operations.
- **Typical location:** `src/service/`
- **Allowed imports:** `types`, `config`, `repo`
- **Examples:** `AuthService`, `OrderService`, `NotificationService`

### Runtime
- **Purpose:** Entrypoints. Servers, workers, schedulers, CLI.
- **Typical location:** `src/runtime/`
- **Allowed imports:** `types`, `config`, `repo`, `service`
- **Examples:** `HttpServer`, `BackgroundWorker`, `main()`

### UI
- **Purpose:** User interface. Views, components, pages, client-side code.
- **Typical location:** `src/ui/`
- **Allowed imports:** all layers
- **Examples:** React components, templates, CLI output formatters

---

## Enforcement

### At Commit Time
The `harness/hooks/pre-commit` hook runs `harness/linters/lint-layers.sh` before every commit.

### In CI
`.github/workflows/ci.yml` runs `harness/scripts/validate.sh` which includes layer linting.

### Machine-Readable Rules
`harness/rules/dependency-layers.json` defines the layer model in a format both linters and agents can consume.

---

## Common Violations & Fixes

### Violation: Service imports from UI
```
# Bad
import { formatCurrency } from '../ui/formatters'  # service importing from ui

# Fix: move the formatter to types/ or create a shared util
import { formatCurrency } from '../types/formatters'
```

### Violation: Repo imports from Service
```
# Bad
import { validateOrder } from '../service/orderService'  # repo importing from service

# Fix: pass validated data down from the service layer
# The repo should receive already-validated data
```

### Violation: Types import from Config
```
# Bad
import { env } from '../config/env'  # types importing from config

# Fix: types should be pure — no runtime dependencies
# Move env-dependent logic to config layer
```

---

## Adapting to Your Stack

The layer model is language-agnostic. Map it to your conventions:

| Generic Layer | Node.js | Python | Go |
|---------------|---------|--------|----|
| types | `src/types/` | `src/models/` | `pkg/domain/` |
| config | `src/config/` | `src/config/` | `pkg/config/` |
| repo | `src/repo/` | `src/repositories/` | `pkg/store/` |
| service | `src/service/` | `src/services/` | `pkg/service/` |
| runtime | `src/runtime/` | `src/app/` | `cmd/` |
| ui | `src/ui/` | `src/views/` | `pkg/handler/` |

Update `harness/rules/dependency-layers.json` with your actual directory mappings.

---

*Machine-readable rules: `harness/rules/dependency-layers.json`*
*Linter: `harness/linters/lint-layers.sh`*

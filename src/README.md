# Source Code

Your application source code lives here. Organize it following the dependency layer model.

## Recommended Layer Structure

```
src/
├── types/      # Layer 0: Type definitions, interfaces, schemas, constants
├── config/     # Layer 1: Configuration, environment variables, feature flags
├── repo/       # Layer 2: Data access, storage adapters, external API clients
├── service/    # Layer 3: Business logic, use cases, workflows
├── runtime/    # Layer 4: Servers, workers, entrypoints, CLI
└── ui/         # Layer 5: Views, components, pages (imports from all layers)
```

**Rule:** Each layer may only import from layers below it.
`Types → Config → Repo → Service → Runtime → UI`

## Adapting to Your Stack

The layer model is language-agnostic. Adapt directory names to your conventions:

| Generic Layer | Node.js | Python | Go |
|---------------|---------|--------|----|
| types | `src/types/` | `src/models/` | `pkg/domain/` |
| config | `src/config/` | `src/config/` | `pkg/config/` |
| repo | `src/repo/` | `src/repositories/` | `pkg/store/` |
| service | `src/service/` | `src/services/` | `pkg/service/` |
| runtime | `src/runtime/` | `src/app/` | `cmd/` |
| ui | `src/ui/` | `src/views/` | `pkg/handler/` |

After adapting, update `harness/rules/dependency-layers.json` with your actual directory paths.

## See Also

- [Dependency Layer Model](../docs/internal/dependency-layers.md)
- [Architecture](../docs/architecture.md)

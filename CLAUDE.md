# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository shape

`yato` is an early-stage monorepo combining a Bazel-built Go backend with a pnpm-workspace TypeScript frontend. The two halves are built by different toolchains and do not share a build graph — Bazel explicitly excludes `frontend`, `deploy`, `devenv`, `infra`, and `docs` via `# gazelle:exclude` directives in the root `BUILD.bazel`.

```
backend/apis/               protobuf definitions + generated Go (own Go module)
backend/library/framework/  in-house microservice framework (own Go module)
frontend/apps/admin/        Next.js 16 admin app (@kairo/admin)
frontend/apps/mobile/       Expo / React Native app (@kairo/nativeapp)
frontend/packages/shadcn/   shared UI kit (@kairo/shadcn), Base UI + Tailwind v4
frontend/packages/chat/     chat UI + TipTap editor (@kairo/chat), depends on shadcn
deploy/kustomize/           base + development/staging/production overlays
infra/terraform/            Kubernetes provider Terraform
docs/                       mdbook, built via Bazel
```

Go modules are wired through `go.work` (`./backend/apis`, `./backend/library/framework`); Bazel's Go SDK and `go_deps` are both sourced `from_file(go_work = "//:go.work")`, so adding a Go module means editing `go.work` — not just `MODULE.bazel`.

## Commands

Bazel is pinned via `.bazelversion` (9.1.1) and driven through bazelisk. There is **no committed `.bazelrc`** — `README.md` holds a remote-cache snippet you can paste into one locally.

```bash
# Go dependency management (always via Bazel's Go, not a system go)
bazel run @rules_go//go -- mod tidy -v
bazel run @rules_go//go -- get <module>@<version>

# Regenerate BUILD.bazel files after adding/moving Go or proto sources
bazel run //:gazelle

bazel build //...
bazel test  //...
bazel test  //backend/library/framework/rest:all          # one package (no test targets exist yet)
bazel test  //<pkg>:<target> --test_filter=TestName       # single test

# Protos (buf drives codegen; Bazel drives proto_library/go_proto_library)
buf lint
buf breaking --against '.git#branch=main'
cd backend/apis && buf generate

# Docs (mdbook)
bazel build //docs:book
bazel run   //docs:server

buildifier path/to/BUILD.bazel   # format Bazel files
```

Frontend (pnpm 11.9.0, declared in root `package.json` `packageManager`; workspace globs `frontend/**`). Note pnpm is not currently on PATH in this environment — install via corepack if needed.

```bash
pnpm install
pnpm --filter @kairo/admin dev     # Next.js on port 8080
pnpm --filter @kairo/admin build
pnpm --filter @kairo/nativeapp start   # expo start (also :ios / :android)
pnpm --filter @kairo/nativeapp lint    # expo lint — the only lint script in the repo
```

Git hooks run through lefthook (`lefthook.yaml`), but both `pre-commit` and `pre-push` jobs are still `echo` placeholders.

## Backend architecture

`backend/library/framework` is a nascent service framework, most of it stubbed. `README.md` in that directory lists the intended surface (circuit breaking, config center, discovery, rate limiting, load balancing, logging, REST, gRPC, telemetry, timeout, retry, cache, datasource); only `conf`, `logging`, `rest`, and `rpc` have files, and `rest`/`rpc` servers are empty structs satisfying the `Transport` interface (`Start`/`Stop` in `transport.go`).

- `app.go` — `framework.New(Name(...), Version(...))` returns an `App` holding a `*grpc.Server`, `*http.Server`, and a Viper config, plus start/shutdown hook slices. `Run()` is still a stub.
- `conf/conf.go` — Viper with `AutomaticEnv` plus an **etcd3 remote provider hardcoded to `http://127.0.0.1:4001`**, and it `panic`s if the remote config can't be read. Any code path that calls `framework.New` therefore requires a local etcd.
- `logging/logger.go` — logr over zap, JSON encoder, epoch-millis timestamps, tee'd so `>= Error` goes to stderr and everything else to stdout. `datapol/` mirrors Kubernetes' data-policy annotation approach for redaction.

Protos live under `backend/apis/<service>/v1/*.proto`. `buf.gen.yaml` uses remote plugins for protobuf-go, grpc-go, and grpc-gateway with `paths=source_relative`, so generated `.pb.go` files sit next to the `.proto`. Bazel additionally builds `proto_library` + `go_proto_library` targets — keep both paths in mind when a proto changes.

### Known inconsistencies (rename in flight)

The project was renamed from `kairo` to `yato` and the rename is incomplete. Do not "fix" these opportunistically without checking scope, but be aware:

- `backend/library/framework/app.go` imports `github.com/qhai-dev/kairo/backend/library/framework/conf` while the module declares `github.com/qhai-dev/yato/...` — this does not compile as-is.
- `buf.yaml` points at `modules: - path: backend/kapis`, but the protos are in `backend/apis`. Proto `go_package` and the generated Bazel `importpath` also say `backend/kapis`.
- `backend/library/framework/go.mod` has no `require` block despite importing viper, zap, logr, and etcd — run `mod tidy` before expecting a build.
- Frontend packages are still named `@kairo/*`.

## Frontend architecture

Both apps consume the workspace packages by source (`main`/`exports` point at `./src/index.ts`, no build step), so changes in `packages/shadcn` or `packages/chat` are picked up directly by the app's bundler. `@kairo/chat` depends on `@kairo/shadcn`.

`frontend/apps/admin` follows a Feature-Sliced Design layout under `src/layers/` (`app`, `widgets`, `shared`), with Next's App Router in `src/app/` acting only as thin route entries that pull from the layers. `@/*` maps to `./src/*`.

- Provider nesting is fixed in `src/app/layout.tsx`: `NextIntlProvider` → `NextThemesProvider` → `TanstackQueryProvider` → `ShadcnProvider` (the last takes a `dir` prop).
- i18n is next-intl with a **cookie-based** locale (`layers/shared/i18n/cookie.ts` → `request.ts`), not a URL segment. Locales are declared in `layers/shared/i18n/config.ts` with an explicit `dir` field; Arabic is RTL, so components must respect `dir` — `@kairo/shadcn` re-exports Base UI's `DirectionProvider`/`useDirection` for this.
- `next.config.ts` sets `output: "standalone"` (container-friendly) and wires the next-intl plugin to the non-default `requestConfig` path.
- Styling is Tailwind v4 via PostCSS; shared design tokens live in `packages/shadcn/src/token.css`, consumed through the packages' exported `styles.css`.

`frontend/apps/mobile` is Expo Router with typed routes and the React Compiler enabled in `app.config.ts`.

## Deployment

`deploy/kustomize` has a `base` (deployment/service) with `development`, `staging`, and `production` overlays applying patches. Container base image is `gcr.io/distroless/static-debian13`, pulled by digest in `MODULE.bazel` via `rules_img` — image builds go through Bazel, not Dockerfiles.

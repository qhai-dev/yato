# 后端目录结构

本文说明 `back-end/` 下各目录的用途、命名含义和组织约定，用于回答两个问题：新代码该放哪，以及看到某个目录时该期待什么。不涉及具体业务逻辑。

## 顶层分层

```
back-end/
├── admin/          管理后台服务
├── service/        业务服务
├── interface/      接口层
├── job/            定时任务
├── library/        公共库
└── api-gateway/    网关
```

| 目录 | 含义 | 组织方式 |
| --- | --- | --- |
| `admin/` | 管理后台服务，面向运营与管理人员 | 域 / 服务 两级 |
| `service/` | 业务服务 | 以域为一级 |
| `interface/` | 接口层 | 以域为一级 |
| `job/` | 定时任务、批处理 | 以域为一级 |
| `library/` | 公共库，被各服务复用 | 按功能划分，不分域 |
| `api-gateway/` | 统一入口网关 | 独立，不分域 |

目录形状有两种，注意区分：

- **`admin/` 是「域 / 服务」两级**——一个域下可以挂多个服务，例如 `admin/fnd/` 下的 `manager` 和 `member`，每个都是独立的部署单元。
- **`service/`、`interface/`、`job/` 是「域即服务」一级**——每个域目录本身就是一个部署单元，不再往下分服务。

## 域代号

域代号直接用作目录名，取业务的英文缩写：

| 代号 | 业务 |
| --- | --- |
| `ast` | 资产 |
| `inv` | 招商 |
| `mkt` | 营销 |
| `ops` | 运营 |
| `fnd` | 基础业务 |

`fnd` 是基础业务，目前只在 `admin/` 层有服务；`service/`、`interface/`、`job/` 下还没有它的目录。

## 单个服务的内部结构

以 `back-end/admin/fnd/manager` 为例：

```
manager/
├── cmd/               程序入口
│   ├── main.go            main 函数
│   └── wire.go            wire.Build 依赖组装
├── internal/          实现细节
│   ├── adapter/          适配层
│   ├── application/      应用层
│   ├── domain/           领域层
│   └── infra/            基础设施层
└── pkg/               对外暴露的包
```

| 目录 | 放什么 |
| --- | --- |
| `cmd/` | 只做启动与依赖组装，不写业务逻辑 |
| `internal/` | 利用 Go 的 `internal` 语义，其他模块无法 import |
| `internal/adapter/` | 适配层：把外部输入（HTTP、gRPC 请求、消息）转换成内部调用 |
| `internal/application/` | 应用层：用例编排，串联领域对象与基础设施 |
| `internal/domain/` | 领域层：业务规则、实体、值对象 |
| `internal/infra/` | 基础设施层：数据库、缓存、消息队列等具体实现 |
| `pkg/` | 有意对外暴露的包，不放实现细节 |

约定的依赖方向：`adapter → application → domain`；`infra` 实现 `domain` 与 `application` 定义的接口。`domain` 不反向依赖其他层。

依赖注入使用 [Google Wire](https://github.com/google/wire)：每层在自己的 `provider.go` 中定义 `wire.NewSet(...)` 汇总本层构造，`cmd/wire.go` 中用 `wire.Build(...)` 组装完整依赖图，再由 `main.go` 调用。

## 公共库

```
library/
├── framework/     Web / gRPC 框架封装
│   ├── app.go         应用生命周期（New / Run / Shutdown）
│   ├── options.go     函数式选项
│   ├── transport.go   Transport 接口（Start / Stop）
│   ├── rest/          HTTP server / client
│   ├── rpc/           gRPC server / client
│   └── log/           日志；datapol 基于 datapolicy tag 检测敏感数据
└── sso/           单点登录
```

`library/` 下的包被各服务 import，自身不分域，也不依赖 `back-end/` 下的其他目录。

## BUILD.bazel

每个目录都带一个 `BUILD.bazel`。构建由 Bazel 驱动（`MODULE.bazel` 中声明了 rules_go、gazelle、protobuf 等）。

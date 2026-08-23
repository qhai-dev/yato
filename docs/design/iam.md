# Yato IAM 设计文档

> 状态: **设计中（v0，未实现）** · 最后更新: 2026-08-22
> 下游产物: 见 §13 「后续 session 计划」

---

## 0. 元信息

| 项 | 值 |
|---|---|
| 文档范围 | `iam` 域的端到端设计 |
| 目标读者 | 平台架构组、即将接手 iam 实现的后端工程师、合规/SRE 复核 |
| 关联代码 | `backend/library/framework/`、`backend/apis/iam/`（待建） |
| 取代关系 | 本文档取代任何散落于聊天 / 旧文档的 iam 草案 |

---

## 1. 背景

### 1.1 平台架构

`yato` 后端的四类进程：

- `backend/admin/` —— **运营管理系统**（BFF + 后台 UI 后端）。仅服务运营/客户成功团队。
- `backend/apiserver/` —— **对外 HTTP BFF**。对终端用户 / 第三方客户端 / 合作方暴露。
- `backend/service/` —— **内部 RPC 服务域**。不直接对外，由 admin / apiserver / worker 调用。
- `backend/worker/` —— **定时任务 / 后台作业**。异步消费、跑批、调度。

这套拆分决定了 iam 在网络拓扑里是**最底层 peer 服务**——admin / apiserver / worker 都通过 RPC 调用它，iam 不回调它们，iam 也**不**通过 admin 或 apiserver 中转。

### 1.2 为什么需要独立的 iam 服务

不把账号逻辑塞进 admin 或 apiserver 的原因：

- 多个进程都要鉴权（admin / apiserver / worker 内部任务）
- B2E + B2C 双群体共存，且需要多租户隔离
- 多个外部 IdP 需要接入（飞书 / 企业微信 / 钉钉）
- 账号逻辑高频迭代（密码策略、MFA、SSO 配置）会拖慢上游进程
- 安全/合规要求独立审计边界

### 1.3 用户群体

| 群体 | user_type | 来源 | 量级期望 |
|---|---|---|---|
| 内部员工 | `staff` | 平台自建 + 飞书/企微/钉钉同步 | 数十到数百 |
| 外部客户 | `customer` | 平台自注册 | 数千到百万 |

两类用户共处一个 `users` 表，通过 `user_type` 区分。profile 按类型拆表，避免在一张表里堆不属于一方的字段。

---

## 2. 设计目标 & 非目标

### 2.1 目标

1. **单一身份权威**：账号/凭据/角色/审计只有一处来源。
2. **多租户隔离**：每个外部客户公司是一个 tenant；隔离边界包括数据可见性、配置、IdP 凭据。
3. **三种 IdP 接入**：飞书、企业微信、钉钉，每客户可独立选择哪几家开启。
4. **登录多形态**：邮箱密码、手机验证码、OAuth/SSO（每家 IdP）、MFA 强制（员工）。
5. **后台同步**：JIT 用户配置 + 定时增量 + 每日全量对账 + webhook 实时事件。
6. **横向身份联邦**：未来接入通用 OIDC（Azure AD / Okta / Keycloak）和 SAML 不破坏现有架构。
7. **审计完备**：登录、敏感操作、权限变更、外部同步事件全部留痕。

### 2.2 非目标（v1 不做）

- 计费 / 用量配额（属于计费域）
- 跨租户用户身份冒充（v1 不支持 super-admin 跨租户跳转）
- 多因素策略可视化配置（v1 只支持固定强制度）
- 自助 MFA 设备注销流程（v1 走管理员协助）
- IdP 双向同步（v1 仅 IdP → IAM 单向）
- SAML（接口预留，实现推迟）

---

## 3. 架构总览

```
                     ┌─────────────────────────────────────┐
                     │        三家 IdP (客户侧)              │
                     │  ┌──────┐ ┌──────┐ ┌──────┐          │
                     │  │ 飞书  │ │企微  │ │ 钉钉 │          │
                     │  └──┬───┘ └──┬───┘ └──┬───┘          │
                     └─────┼────────┼────────┼──────────────┘
                           │        │        │
                OAuth 跳转 │        │        │ REST API + Webhook
                           ▼        ▼        ▼
   ┌──────────┐    ┌────────────────────────────────────┐    ┌───────────────┐
   │  admin   │───▶│            iam (RPC)               │◀───│   worker      │
   │  BFF     │    │ ┌──────┐ ┌──────┐ ┌──────────┐   │    │ - 增量同步     │
   └──────────┘    │ │ auth │ │ user │ │ tenant   │   │    │ - 全量对账     │
                   │ └──────┘ └──────┘ └──────────┘   │    │ - webhook 消费│
   ┌──────────┐    │ ┌──────┐ ┌──────┐ ┌────────────┐ │    │ - 健康监控    │
   │apiserver │───▶│ │ rbac │ │audit │ │provisioning│ │    └───────────────┘
   │  BFF     │    │ └──────┘ └──────┘ └────────────┘ │
   └──────────┘    │         ↕ 数据层                    │
                   │     shared PostgreSQL              │
                   └────────────────────────────────────┘
                              ▲
                              │ RPC 消费
                              │
                       (admin / apiserver / worker)
```

**信任域**：

- `iam` 是信任根。所有需要身份解析的请求都经过它。
- admin / apiserver / worker 是 iam 的消费者。它们持有 iam 的 RPC client，通过 gRPC metadata 透传用户 token。
- IdP 是 iam 的数据源（拉取）和 OAuth 目标（浏览器跳转）。iam 不向 IdP 写任何东西。

---

## 4. 子域拆分

iam 不是一个 service 一个文件，而是 6 个内部子域。在 proto 层拆包，在 Go 层共进程、共享数据库。

| 子域 | 职责 | 主要消费者 |
|---|---|---|
| `auth` | 登录/注销/token 签发/吊销/MFA | admin / apiserver 浏览器入口 |
| `user` | 用户主表 + profile（按 user_type 拆分） | auth / rbac / provisioning / 各业务域 |
| `tenant` | 租户 CRUD + 成员管理 + 上下文传递 | admin（管理员）、provisioning |
| `rbac` | 角色、权限码、用户/组绑定 | auth（签 token 解析权限）、admin UI |
| `audit` | 审计写入与查询 | admin（合规后台）、SRE |
| `provisioning` | IdP 适配、用户目录同步、webhook 消费 | worker / auth（OAuth 回调）/ web 入口 |

每个子域对应一份 proto：

```
backend/apis/iam/
├── DESIGN.md                              ← 本文档
├── common/v1/common.proto                 ← 共享 message
├── auth/v1/auth.proto
├── user/v1/user.proto
├── tenant/v1/tenant.proto
├── rbac/v1/rbac.proto
├── audit/v1/audit.proto
└── provisioning/v1/
    ├── idp.proto
    └── sync.proto
```

> 子域共进程但允许独立演进——单子域 RPC 调用频繁时，可以未来拆成独立 service，不破坏消费方代码。

---

## 5. 数据模型

### 5.1 总 ER 图

```
                  ┌─────────────────────┐
                  │   permissions       │  权限码字典
                  │   (id, code, ...)   │
                  └──────────┬──────────┘
                             │ N:M
                  ┌──────────┴──────────┐
       ┌──────────┤   roles             │  角色 (per-tenant)
       │          │   (id, tenant_id,  │
       │          │    code, is_system) │
       │          └──────────┬──────────┘
       │                     │ N:M (user_tenants.role_id)
       │          ┌──────────┴──────────┐
       │          │   user_tenants      │  成员关系
       │          │  (user_id, tenant,  │
       │          │   role_id)          │
       │          └──────────┬──────────┘
       │                     │
   ┌───┴──────────┐    ┌─────┴────────────┐
   │  groups       │◀──▶│   user_staff_   │
   │ (镜像 IdP)    │ N:M│   profile        │
   └─────┬─────────┘    │   user_customer_ │
         │ N:M          │   profile        │
   ┌─────┴───────┐      └──────────────────┘
   │ group_members│
   └─────────────┘
         ▲
         │
   ┌─────┴──────────────────────────────┐
   │              users                  │
   │  (id, user_type, status, ...)       │◀──────┐
   └─────┬──────────────────────────────┘       │
         │ 1:N                                 │
   ┌─────┴──────────────────────────────┐       │
   │  user_credentials                   │       │
   │  user_contact_points                │       │
   │  user_mfa_factors                   │       │
   │  refresh_tokens                     │       │
   └────────────────────────────────────┘       │
                                                  │
   ┌──────────────────────────────────────────────┴──┐
   │        provisioning 域                          │
   │ ┌────────────────┐ ┌─────────────────────────┐ │
   │ │ idp_connections │ │ webhook_endpoints       │ │
   │ └────────────────┘ └─────────────────────────┘ │
   │ ┌────────────────┐ ┌─────────────────────────┐ │
   │ │ sync_jobs       │ │ sync_state              │ │
   │ └────────────────┘ └─────────────────────────┘ │
   └─────────────────────────────────────────────────┘
                                                  │
   ┌──────────────────────────────────────────────┴──┐
   │        audit_logs (append-only, 引用任意 actor)  │
   └─────────────────────────────────────────────────┘
```

### 5.2 核心 IAM 表（13 张）

#### 5.2.1 `users` —— 身份根

```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY,
  user_type   SMALLINT NOT NULL,         -- 1=staff, 2=customer
  status      SMALLINT NOT NULL DEFAULT 1,
                                      -- 1=active 2=suspended 3=locked
                                      -- 4=pending 5=disabled
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_user_type_status ON users(user_type, status);
```

设计要点：
- **不放 PII**。邮箱/手机放在 `user_contact_points`，姓名放在 profile。
- `user_type` 是 discriminator，profile 表按它 1:1 拆，避免一张表塞两类用户属性。
- `status = disabled` 用于外部 IdP 同步过来的"软禁用"——不删行。

#### 5.2.2 `user_credentials` —— 凭据

```sql
CREATE TABLE user_credentials (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_type SMALLINT NOT NULL,
                                       -- 1=password  2=oauth  3=sso
                                       -- 11=oauth_feishu 12=oauth_wecom
                                       -- 13=oauth_dingtalk
                                       -- 21=magic_link
  identifier      TEXT NOT NULL,        -- email / phone / union_id / subject
  secret_hash     TEXT,                 -- bcrypt(opaque); NULL for OAuth
  is_primary      BOOLEAN NOT NULL,
  metadata        JSONB,                -- oauth provider 元数据、 MFA 因子 ref
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (credential_type, identifier)  -- 登录查询核心索引
);

CREATE INDEX idx_credentials_user ON user_credentials(user_id);
```

设计要点：
- **凭据统一一张表 + 类型字段**而非多张表。set / revoke / 审计逻辑统一。
- 登录查询走 `(credential_type, identifier)` 唯一索引，O(1)。
- OAuth 场景下 `identifier` 存 IdP 的稳定外部 ID（如飞书 `union_id`），**不要**用 `open_id`——后者随 app 失效。

#### 5.2.3 `user_contact_points` —— 联系方式

```sql
CREATE TABLE user_contact_points (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel     SMALLINT NOT NULL,        -- 1=email  2=phone
  value       TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

独立建表的理由：联系方式随时间变化（用户换号、改邮箱），要做"邮箱变更"审计时一张 events 表关联更省事；以及未来支持"一个用户多邮箱"的多联系人场景。

#### 5.2.4 `user_mfa_factors` —— MFA 因子

```sql
CREATE TABLE user_mfa_factors (
  id          UUID PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        SMALLINT NOT NULL,        -- 1=totp 2=sms 3=webauthn
  handle      TEXT,                     -- TOTP secret / SMS phone / WebAuthn cred id
  status      SMALLINT NOT NULL,        -- 1=active 2=pending_enrollment 3=revoked
  enrolled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);
```

员工强制 MFA（v1 规则），外部用户可选。

#### 5.2.5 `user_staff_profile` / `user_customer_profile` —— 拆分 profile

```sql
CREATE TABLE user_staff_profile (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  employee_id    TEXT,                  -- 工号（可空，未必每个员工都有）
  full_name      TEXT NOT NULL,
  department     TEXT,
  position       TEXT,
  manager_user_id UUID REFERENCES users(id),
  hire_date      DATE
);

CREATE TABLE user_customer_profile (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nickname          TEXT NOT NULL,
  full_name         TEXT,
  avatar_url        TEXT,
  locale            TEXT NOT NULL DEFAULT 'zh-CN',
  phone_verified_at TIMESTAMPTZ,
  real_name_status  SMALLINT NOT NULL DEFAULT 0   -- 0=未实名 1=已实名 2=待审
);
```

拆分理由：员工和客户的属性集合几乎不相交，硬塞会让 JSON 失控。后续要加字段时只动对应的表。

#### 5.2.6 `refresh_tokens` —— 服务端可吊销的 refresh token

```sql
CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,    -- 存的是 SHA256(token)，不是 token 本身
  device_label TEXT,
  ip           INET,
  user_agent   TEXT,
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  revoked_reason TEXT,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_refresh_user_active ON refresh_tokens(user_id) WHERE revoked_at IS NULL;
```

不透明 refresh token 的核心：**可以被强制吊销**。用户离职、设备丢失、检测到异常登录时一行 UPDATE 就行。纯 JWT 做不到。

#### 5.2.7 `tenants`

```sql
CREATE TABLE tenants (
  id          UUID PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,    -- 短业务码，如 'acme_corp'
  name        TEXT NOT NULL,
  status      SMALLINT NOT NULL DEFAULT 1,
  settings    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 5.2.8 `user_tenants` —— 用户 ↔ 租户成员关系

```sql
CREATE TABLE user_tenants (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id),
  status     SMALLINT NOT NULL DEFAULT 1,
                                       -- 1=active 2=invited 3=suspended
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tenant_id)
);
```

一个用户可属于多个租户——员工跨租户运营 + B2B 客户多子公司场景都需要。

#### 5.2.9 `roles` / `permissions` / `role_permissions` —— RBAC

```sql
CREATE TABLE roles (
  id         UUID PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,             -- 'admin' / 'viewer' / 自定义
  name       TEXT NOT NULL,
  is_system  BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE permissions (
  id            UUID PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,   -- 'customer.view' / 'order.refund'
  resource_type TEXT NOT NULL,
  action        TEXT NOT NULL,           -- read/create/update/delete/execute
  description   TEXT
);

CREATE TABLE role_permissions (
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
```

**iam 不懂业务权限语义**——只存权限**码**与归属。`order.refund` 这个码是 order 域启动时通过 `RegisterPermission` RPC 注册进 iam 的；iam 只负责"用户有没有这个码"，具体拦截由 order 服务执行。

#### 5.2.10 `audit_logs` —— 追加写

```sql
CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID,                   -- 触发者；NULL 表示系统/IdP 触发
  actor_tenant_id UUID,                 -- 触发时所在的租户上下文
  action        TEXT NOT NULL,          -- 'user.login' / 'permission.grant'
  target_type   TEXT,
  target_id     TEXT,
  source_ip     INET,
  user_agent    TEXT,
  payload       JSONB,                  -- 操作参数（敏感字段由 datapol 脱敏后写入）
  prev_hash     BYTEA,                  -- 链式哈希，篡改可见
  row_hash      BYTEA NOT NULL
) PARTITION BY RANGE (occurred_at);
```

按月分区。链式 hash 让事后审计能发现"中间有人改过日志"。`payload` 写之前过 `datapol` 的 redaction（已存在于 `backend/library/framework/logging/datapol`）。

### 5.3 Provisioning 表（6 张）

#### 5.3.1 `idp_connections` —— 每租户的 IdP 凭证

```sql
CREATE TABLE idp_connections (
  id          UUID PRIMARY KEY,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider    SMALLINT NOT NULL,        -- 1=feishu 2=wecom 3=dingtalk 11=oidc
  status      SMALLINT NOT NULL DEFAULT 1,
                                      -- 1=active 2=testing 3=disabled 4=error
  config      JSONB NOT NULL,          -- 加密的 { app_id, app_secret/corp_secret, ... }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);
```

`config` 中的 secret 字段在落库前必须用 KMS-managed key AES-256-GCM 加密，读取时再解密。任何时候数据库 dump 都不应该出现明文 secret。

#### 5.3.2 `webhook_endpoints` —— webhook 订阅状态

```sql
CREATE TABLE webhook_endpoints (
  id            UUID PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      SMALLINT NOT NULL,
  callback_url  TEXT NOT NULL,
  sign_key_hash BYTEA NOT NULL,         -- HMAC 验签用 key 的哈希；原值加密存 settings JSONB
  status        SMALLINT NOT NULL DEFAULT 1,
  last_event_at TIMESTAMPTZ
);
```

飞书/钉钉的回调加密 key、企微的回调 secret 都在这里。每家验签方式不同（见 §7.3）。

#### 5.3.3 `groups` —— 镜像 IdP 的部门

```sql
CREATE TABLE groups (
  id            UUID PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      SMALLINT NOT NULL,
  external_id   TEXT NOT NULL,          -- IdP 那边 department_id
  name          TEXT NOT NULL,
  parent_external_id TEXT,              -- IdP 端父子关系；本地由同步任务转换
  parent_id     UUID REFERENCES groups(id),
  last_synced_at TIMESTAMPTZ,
  is_deleted    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (tenant_id, provider, external_id)
);
```

#### 5.3.4 `group_members`

```sql
CREATE TABLE group_members (
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT false,   -- 飞书"主部门"
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members(user_id);
```

#### 5.3.5 `sync_jobs` —— 同步任务轨迹

```sql
CREATE TABLE sync_jobs (
  id               UUID PRIMARY KEY,
  tenant_id        UUID NOT NULL,
  provider         SMALLINT NOT NULL,
  kind             SMALLINT NOT NULL,  -- 1=incremental 2=full 3=jit 4=webhook
  status           SMALLINT NOT NULL,  -- 1=running 2=success 3=failed 4=partial
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  items_processed  INT,
  error_summary    JSONB
);
```

#### 5.3.6 `sync_state` —— 每 (tenant, provider) 游标

```sql
CREATE TABLE sync_state (
  tenant_id              UUID NOT NULL,
  provider               SMALLINT NOT NULL,
  cursor_value           TEXT,           -- 比如飞书 next_page_token / 事件戳
  last_success_at        TIMESTAMPTZ,
  consecutive_failures   INT NOT NULL DEFAULT 0,
  last_error             TEXT,
  PRIMARY KEY (tenant_id, provider)
);
```

`consecutive_failures` 用来触发告警（如连续失败 5 次通知 ops）。

### 5.4 索引策略摘要

登录/查找热路径：

- `(credential_type, identifier)` 唯一 → 凭据登录
- `(tenant_id, provider, external_id)` 唯一 → IdP 用户映射
- `(user_id, tenant_id)` 主键 → 多租户成员查询
- `(tenant_id, provider)` 主键 → 游标查询

冷查询：

- `audit_logs` 按 `occurred_at` 分区后按月建索引
- 各类 `*_created_at` 索引做后台对账

---

## 6. RPC 表面（概要）

> 完整 message 定义见 phase 2「proto 文件骨架」。

### 6.1 auth/v1

```protobuf
rpc Login(LoginRequest)                   returns (LoginResponse);  // 邮箱/手机 + 密码 + MFA 续
rpc LoginWithOAuth(LoginWithOAuthRequest) returns (LoginResponse);  // 飞书/企微/钉钉 OAuth 回调
rpc Logout(LogoutRequest)                 returns (Empty);
rpc RefreshToken(RefreshTokenRequest)     returns (LoginResponse);
rpc IntrospectToken(IntrospectTokenRequest)
                                          returns (IntrospectTokenResponse);
                                          // 内部消费方用：拿 token 来解析 caller
rpc EnrollMfaFactor(EnrollMfaFactorRequest)
                                          returns (EnrollMfaFactorResponse);
```

### 6.2 user/v1

```protobuf
rpc GetUser(GetUserRequest)                returns (User);
rpc CreateStaffUser(CreateStaffUserRequest) returns (User);   // 仅 staff token 可调
rpc CreateCustomerUser(...)                returns (User);
rpc UpdateUserProfile(...)                 returns (User);
rpc DisableUser(DisableUserRequest)        returns (Empty);
```

### 6.3 tenant/v1

```protobuf
rpc CreateTenant(...)                      returns (Tenant);
rpc AddUserToTenant(...)                   returns (UserTenant);
rpc RemoveUserFromTenant(...)              returns (Empty);
rpc ListUserTenants(...)                   returns (ListUserTenantsResponse);
rpc UpdateUserTenantRole(...)              returns (Empty);
```

### 6.4 rbac/v1

```protobuf
rpc RegisterPermission(...)                returns (Permission);  // 业务域启动注册
rpc CreateRole(...)                        returns (Role);
rpc AssignPermissionToRole(...)            returns (Empty);
rpc AssignRoleToUserOrGroup(...)           returns (Empty);
rpc ResolvePermissions(ResolvePermissionsRequest)
                                          returns (ResolvedPermissions);
                                          // auth 签发 token 时调
```

### 6.5 audit/v1

```protobuf
rpc WriteAuditLog(WriteAuditLogRequest)    returns (Empty);    // 流式批量写
rpc ListAuditLogs(ListAuditLogsRequest)    returns (ListAuditLogsResponse);
```

### 6.6 provisioning/v1/idp.proto

```protobuf
rpc CreateIdpConnection(...)               returns (IdpConnection);
rpc UpdateIdpConnection(...)               returns (IdpConnection);
rpc DisableIdpConnection(...)              returns (Empty);
rpc ListIdpConnections(...)                returns (ListIdpConnectionsResponse);
rpc TestIdpConnection(...)                 returns (TestIdpConnectionResponse);
                                          // 用租户提供的 secret 拉一次 /me，验证连通
```

### 6.7 provisioning/v1/sync.proto

```protobuf
rpc TriggerSync(...)                       returns (SyncJob);
rpc ListSyncJobs(...)                      returns (ListSyncJobsResponse);
rpc GetSyncCursor(...)                     returns (SyncCursor);
rpc ListGroups(...)                        returns (ListGroupsResponse);
rpc ListGroupMembers(...)                  returns (ListGroupMembersResponse);
```

---

## 7. Token 设计

### 7.1 两层 token

| | Access token | Refresh token |
|---|---|---|
| 形式 | JWT，EdDSA 签名 | 不透明随机串 |
| 寿命 | 15 分钟 | 7 天（v1） |
| 落地 | 客户端内存 | 客户端安全存储 + 服务端 `refresh_tokens` 表 |
| 用途 | 每次请求携带 | 换新 access token |
| 可吊销 | 否（短寿命兜底） | **是**（`refresh_tokens.revoked_at`） |

### 7.2 Access token claims

```jsonc
{
  "iss": "yato-iam",
  "aud": ["admin", "apiserver", "worker"],   // 受众
  "sub": "<user_uuid>",
  "ute": 1,                                  // user_type: 1=staff 2=customer
  "tns": [                                   // 用户所有租户
    {
      "tid": "<tenant_uuid>",
      "rol": "admin",
      "perms": ["user.view", "order.refund", ...]
    }
  ],
  "scp": ["iam.self.read", ...],             // 全局 scope
  "cur": "<tenant_uuid>",                    // 当前请求所在租户
  "grps": ["<group_uuid>", ...],             // 所属组（部门）
  "iat": 1700000000,
  "exp": 1700000900
}
```

签发时机（`Login` / `RefreshToken` 完成时）由 `rbac.ResolvePermissions` 一次性把所有 tenant 上所有 role 解出的 permission 都塞进 `tns[*].perms`。签发一次，校验零数据库（除吊销校验走 `refresh_tokens` 表）。

### 7.3 多租户上下文传递

请求 header：

```
X-Tenant-Id: <tenant_uuid>
Authorization: Bearer <jwt>
```

iam 收到请求时：

1. 验签 JWT
2. 在 token 的 `tns` 列表里查找 `X-Tenant-Id`
3. 不在 → 403；存在 → 把 `cur` 改写为该值并消费

**好处**：不用为每个租户签独立 token，刷新一次 token 立刻包含所有租户。租户切换零开销。

### 7.4 Token 流转（消费方 → iam）

```
[Browser]
   │ Authorization: Bearer <jwt>
   ▼
[admin / apiserver]
   │ 把同样的 Authorization 放进出站 gRPC metadata
   ▼
[iam]
   │ 拦截器解析，得知 caller
   ▼
业务 RPC
```

约定：downstream 服务的所有"需要身份解析"的 RPC 客户端一律用拦截器把入站 token 塞进 `metadata.AppendToOutgoingContext(ctx, "authorization", token)`。iam 端统一从 metadata 读。**不**通过业务层手传，避免漏传和伪造。

---

## 8. Provisioning 子域

### 8.1 适配器抽象

`backend/service/iam/provisioning/adapter/`：

```go
package adapter

type IdentityProvider interface {
    // ── OAuth 登录用 ─────────────────────────────────
    GetAuthorizationURL(state, tenantID string) string
    ExchangeCode(ctx context.Context, code string) (Profile, error)

    // ── 用户目录同步用 ───────────────────────────────
    FetchUsersDelta(ctx context.Context, since time.Time, cursor string) (
        users []RemoteUser, nextCursor string, err error)
    FetchDepartments(ctx context.Context, parentExternalID string) (
        []RemoteDept, error)
    FetchDepartmentMembers(ctx context.Context, deptExternalID string) (
        []string, error) // union_id 列表

    // ── Webhook 用 ───────────────────────────────────
    VerifyEventSignature(r *http.Request, body []byte) bool
    ParseEvents(body []byte) ([]IdpEvent, error)
}

type Profile struct {
    ExternalID  string    // union_id for feishu / userid for wecom
    OpenID      string    // per-app id；存进 metadata，可空
    Email       string
    Phone       string
    FullName    string
    DepartmentIDs []string // IdP 端部门 external_id
}

type RemoteUser struct {
    ExternalID string
    Email      string
    Phone      string
    FullName   string
    Status     string  // "active" / "deleted" / "deactivated"
    UpdatedAt  time.Time
    DeptExternalIDs []string
}

type RemoteDept struct {
    ExternalID string
    Name       string
    ParentExternalID string
}

type IdpEvent struct {
    Type       string  // "user.created" / "user.updated" / "user.deleted" / "dept.member.add"
    ExternalID string
    Payload    any
}
```

### 8.2 三家 IdP 实现差异速览

| 维度 | 飞书 | 企业微信 | 钉钉 |
|---|---|---|---|
| 稳定外部 ID | `union_id`（跨应用） | `userid`（企业内） | `unionId`（企业内） |
| 应用形态 | 自建应用（一家企业一个 app） | 自建应用 / 通讯录应用 | 微应用 / 企业内应用 |
| 通讯录 API | `/contact/v3/users`、`/contact/v3/departments` | `/cgi-bin/user/list`、`/cgi-bin/department/list` | `/topapi/v2/user/list`、`/topapi/v2/department/list` |
| 限速 | 50 req/s/app | 600 req/min/secret | 200 req/min/企业 |
| 回调加密 | AES-128-CBC（encrypt_key 派生）+ verification_token 头 | `msg_signature` URL 参数 + sha1 | 加密回调 / Stream 长连接 |
| 事件投递方式 | 加密 HTTP 回调 | 加密 HTTP 回调 | HTTP / Stream callback（需独立模式） |
| "主部门" 概念 | 有（`is_main_dept`） | 有（排序 1 为部门排序第一） | 有（`dept_order`） |

每家具体实现一个文件：`adapter/feishu/feishu.go`、`adapter/wecom/wecom.go`、`adapter/dingtalk/dingtalk.go`。

### 8.3 每客户独立 App 模式

**v1 不做"平台共用一个飞书 app"**。每个租户：

1. 在飞书开发者后台创建一个应用（自建）。
2. 把 `app_id` / `app_secret` 在 admin 后台通过 `CreateIdpConnection` 录入。
3. 在飞书应用后台把 OAuth 重定向 URL 设为：

   ```
   https://iam.example.com/oauth/feishu/{tenant_id}/callback
   ```

4. iam 后端根据 `{tenant_id}` 路由到对应的 `IdpConnection` 拿到 secret，再与飞书交互。

**好处**：

- 安全/合规/吊销粒度细到租户。
- 客户的飞书 admin 能看到"我们公司对接了 yato 平台"这件事发生，信任建立自然。
- 一个租户 secret 泄漏不会波及其它租户。

**代价**：

- 客户要自助走一遍飞书开发者流程——admin 后台要有一份"Onboarding 飞书 SSO"文档/向导。
- 每租户 secret 入库要做加密（KMS）。
- 测试覆盖率按租户隔离，不能用一个 app 全平台跑全量集成测试。

### 8.4 JIT 用户配置（首次登录）

OAuth 回调成功后：

```text
[1] auth: LoginWithOAuth(provider, code, state=tenant_id)
       ↓
[2] auth → adapter.ExchangeCode(code) → Profile{ExternalID, ...}
       ↓
[3] auth → 查 user_credentials 凭 ExternalID
       ├─ 命中 → 直接签 token 走 [8]
       └─ 未命中 ↓
[4] provisioning.JitProvision(profile, tenant_id):
       - 写 users (user_type 按 IdP 默认设; staff 类型按 tenant 配置)
       - 写 user_credentials
       - 写 user_contact_points (email/phone from Profile)
       - 拉用户所属部门 → upsert groups
       - 写 group_members
       - 若该部门绑定了 role → 写 user_tenants.role_id
       - 一笔同步审计
       ↓
[5] auth: 签 access + refresh token
       ↓
[6] refresh_tokens 表记一行
       ↓
[7] 写 audit_logs('user.login', source=oauth_xxx)
       ↓
[8] 返回 LoginResponse
```

### 8.5 同步策略

| 时机 | 行为 | 频率 |
|---|---|---|
| **JIT**（首次登录） | 拉 profile + 部门完整 upsert | 触发式 |
| **定时增量** | 拉 IdP 自 cursor 以来的变更事件，幂等 upsert | 15~60 分钟 |
| **全量对账** | 按部门逐个拉全量成员，做差异检测 | 每天 02:00 |
| **webhook** | 实时消费 IdP 推过来的事件，幂等 upsert | 实时 |

每种方式的逻辑尽量复用同一组 `applyEvent/applyUser/applyDept` 函数——它们对数据库的操作是幂等的（用 `(tenant_id, provider, external_id)` 作为 upsert key），任一时机调用都安全。

#### 8.5.1 失败处理

- 单 tenant 同步失败 → 记 `sync_jobs.status = failed`，`sync_state.consecutive_failures++`，不阻塞其他 tenant。
- 连续失败 ≥ 5 → `sync_health_monitor` 告警到 ops 频道。
- IdP 返回 429 → 按厂商文档退避。
- IdP 返回的 cursor 失效（用户改了 secret、撤销了事件订阅）→ 回退到全量对账。

### 8.6 Webhook 接入

每家 IdP 的入端点：

```
POST /webhook/feishu/{tenant_id}
POST /webhook/wecom/{tenant_id}
POST /webhook/dingtalk/{tenant_id}
```

特点：

- **不共代码**：每家验签逻辑完全不同（飞书 AES 解密、企微 SHA1、钉钉多种模式），`webhook_xxx.go` 各一份。
- **共用下游**：验签通过后解析成统一的 `IdpEvent`，入内部队列（PG `sync_jobs`，`kind = webhook`），由 worker 消费。
- **快速 200**：webhook 入口验签后立即 200，失败 401；不等到 sync 跑完才返回，避免 IdP 端超时重试风暴。

---

## 9. Worker 任务契约

worker 通过 RPC 调 iam/provisioning 的入口触发和记账。**worker 不直接调任何 IdP HTTP API**——所有 IdP 调用封在 `iam/provisioning/adapter` 里，worker 只持 `iam` 的 RPC client。

| Job | 触发方式 | RPC 入口 | 重试 | 告警条件 |
|---|---|---|---|---|
| `incremental_sync` | cron 15~60 min | `SyncEngine.RunIncremental(tenant_id, provider)` | 指数退避 3 次后进 DLQ | 失败 ≥ 5 次 |
| `full_reconciliation` | cron daily 02:00 | `SyncEngine.RunFull(tenant_id, provider, dept_root)` | 同上 | 失败 ≥ 2 次 |
| `webhook_event_processor` | webhook 入队列时 | `SyncEngine.ApplyEvents(tenant_id, provider, events)` | 立即 1 次后入 DLQ | DLQ 长度 > 50 |
| `sync_health_monitor` | cron 5 min | 读 `sync_state` 直接 DB | — | `consecutive_failures ≥ 5` 告警 |

worker 启动通过 `framework.New(...).Run()` 起，业务函数是注册的 cron。worker 进程本身是 `backend/worker/` 下一个 main，**不会**重新设计 framework 的 cron 抽象——那要等 framework 补齐。

---

## 10. 多租户隔离策略

### 10.1 v1：行级 + PostgreSQL RLS

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (id IN (
    SELECT user_id FROM user_tenants
    WHERE tenant_id = current_setting('iam.tenant_id')::uuid
  ));
```

应用层在每个事务 `BEGIN` 前调 `SET LOCAL iam.tenant_id = '...'`。**所有 IAM 内 RPC 处理函数都要在事务开头执行这一步**——这是约定，靠 code review 强制。

### 10.2 不变量

- iam 的所有 RPC 处理函数，第一步是 set tenant context，第二步才查表。
- 跨租户查询（如 admin 看全平台）走 `is_super_admin` 短路，单独的事务标识。
- `permissions`、`permissions`/`role_permissions` 仍按 tenant 维度走 `tenant_id` 列，因为 role 是 per-tenant 的——见 §5.2.9。

### 10.3 升级路径

| 阶段 | 触发条件 | 切到 |
|---|---|---|
| v1 | 默认 | 行级 + RLS |
| v2 | 某个客户合同要求 PII 数据独立物理存储 | 该租户走 schema 级（一 schema 一租户） |
| v3 | 大客户要求数据库独立 | 该租户走 DB 级（一租户一 DB） |

切换是渐进、可逆的——iam 应用层不感知。

---

## 11. 安全与合规要点

### 11.1 凭据加密

| 字段 | 存储方式 |
|---|---|
| 用户密码 | bcrypt cost ≥ 12 |
| TOTP secret | AES-256-GCM (KMS key) |
| WebAuthn credential id | 同上 |
| IdP app_secret | AES-256-GCM (KMS key)，落 `idp_connections.config` |
| Webhook 验签 key | 同上，落 `webhook_endpoints.sign_key` |
| Refresh token | SHA-256(token)，token 本体只在客户端和返回时短暂存在 |

**KMS 是 hard requirement**——不要试图用环境变量 / 配置文件密钥替代。

### 11.2 软禁用窗口

外部 IdP 删除用户 → 本地 `users.status = disabled`，`group_members` 保留。90 天后由 cron `prune_disabled_users` 匿名化（清空姓名、联系方式、profile），但保留 `audit_logs` 的外键可用。

90 天是产品/合规待定项（见 §13）。

### 11.3 审计边界

- 所有 IAM 内部写入操作都走 audit 子域入口。
- 凭据更新、权限变更、MFA 重置、IdP 同步事件全部留痕。
- 审计日志本身用链式 hash，见 §5.2.10。

### 11.4 速率限制

iam 自身（被外部 BFF 调）：

- `Login` / `LoginWithOAuth`：每 IP 5 req/min，每 user 10 req/min
- `RefreshToken`：每 user 60 req/hour
- `IntrospectToken`：不做限速（消费方内部调用）

worker 拉 IdP（被 throttle）：

- 每租户令牌桶，按 IdP 厂商文档配（飞书 50/s、企微 600/min、钉钉 200/min）。

---

## 12. Framework 依赖（前置补齐项）

不补这些，proto + DDL 都写不出来能跑的东西。本次 session 不动它们，但必须列出来便于跟踪：

1. `framework/app.go` 的 `Run()` 是 stub——实际要：load conf → init logger → 起 gRPC `:50051` + 可选 HTTP → 阻塞等 signal → 调 shutdown hooks。
2. `rpc/server.go` 的 `Start/Stop` 是空实现——要：`grpc.NewServer` 注册 reflection、health check、unary interceptor（recovery + logging + metadata parse）。
3. `conf/conf.go` etcd 硬依赖——fallback 路径：env → 本地文件。缺失 etcd 时不 panic。
4. `app.go` 导入路径仍是 `qhai-dev/kairo`（CLAUDE.md 已知）。需批量改成 `qhai-dev/yato`。
5. `framework/go.mod` 缺 require 块——`mod tidy` 不跑通不能编译。

phase 3 单独一个 session 处理这五项。

---

## 13. 待定清单（需要产品 / 合规拍板）

| # | 项 | 选项 | 推荐 | 阻塞项 |
|---|---|---|---|---|
| 1 | 员工 MFA 是否强制 | 强制 / 鼓励 / 可选 | 强制 | UI 流程 |
| 2 | refresh token 寿命 | 7d / 14d / 30d | 7d | 合规/产品 |
| 3 | 数据库选型 | Postgres / MySQL / 其他 | Postgres (RLS 支持) | 运维 |
| 4 | 软禁用窗口 | 30 / 90 / 180 天 | 90 天 | 合规 |
| 5 | 对外登录 API 暴露方式 | iam 直接 HTTP gw / apiserver 代理 | 后者（apiserver→iam RPC） | apiserver 设计 |
| 6 | 加入 SAML | v1 / v2 | v2 | — |
| 7 | Webhook retry 上限 | 3 次 / 5 次 / 不限 | 3 次后入 DLQ | — |
| 8 | 密码策略 | 长度 / 复杂度 / 历史 | ≥ 10 位 + 历史 5 次 | 合规/产品 |
| 9 | 跨租户 super-admin | v1 不做 / v2 支持 | v1 不做 | — |
| 10 | IdP secret 是否支持客户自助轮换 | 必选 / 可选 | 必选 | UI 工作量 |

> 任何一条不决定不影响 phase 2（proto + DDL），但影响 phase 4（Go 实现）的具体字段和默认值。

---

## 14. 后续 session 计划

| 阶段 | 交付物 | session 数估计 |
|---|---|---|
| **Phase 1（本次）** | DESIGN.md（本文件） | ✅ |
| **Phase 2** | 8 个 proto 文件骨架 + `iam_schema.sql` 完整 DDL + 一个跑通 `buf generate` 的 BUILD.bazel | 1 session |
| **Phase 3** | framework 5 项前置补齐（§12） | 1 session |
| **Phase 4** | `auth` + `user` 子域最小可跑通端到端 demo | 1 session |
| **Phase 5** | `tenant` + `rbac` | 1 session |
| **Phase 6** | `provisioning` 三家适配器 + worker 4 个 job | 2~3 session |
| **Phase 7** | `audit` + 数据脱敏 + 审计后台查询 | 0.5 session |

合到一起是大约 6~7 个 session 的工作量，分阶段走能让每一阶段都有可验收产物。

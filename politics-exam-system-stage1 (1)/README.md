# 政治考试随机组卷与在线答题系统

这是一个面向成人高考政治复习的响应式 Web 应用。第一阶段已经完成登录、用户同步、数据库模型、题库管理、PDF 上传检查和 OCR 任务入口。

## 当前已完成

- Supabase 邮箱注册、登录、退出和会话刷新
- 管理员与普通用户角色
- PostgreSQL + Prisma 完整数据模型和初始迁移
- 题目新增、编辑、筛选、软删除
- PDF 上传、文件哈希去重、页数与文本层检查
- 图片型 PDF 自动标记为 `PENDING_OCR`
- 导入记录与校对进度界面
- 手机、平板和电脑响应式后台布局
- 历史试卷使用独立快照的数据结构

OCR 识别、随机组卷、在线答题、自动评分、错题本和统计页面将在后续阶段接入。目前对应入口已经预留，但不会伪造未实现的数据。

## 环境要求

- Node.js 20 或更高版本
- PostgreSQL 15 或更高版本
- 一个 Supabase 项目

## 本地启动

1. 安装依赖：

   ```bash
   npm install
   ```

2. 创建环境变量：

   ```bash
   cp .env.example .env.local
   ```

3. 启动本地 PostgreSQL：

   ```bash
   docker compose up -d
   ```

4. 创建数据库表并生成客户端：

   ```bash
   npm run db:deploy
   npm run db:generate
   npm run db:seed
   ```

5. 启动开发服务器：

   ```bash
   npm run dev
   ```

浏览器打开 `http://localhost:3000`。

## Supabase 设置

1. 在 Supabase 创建项目。
2. 在 Authentication 中启用 Email 登录。
3. 将 Site URL 设置为本地或正式域名。
4. 在 Storage 新建私有 Bucket：`exam-pdfs`。
5. 把 Project URL、anon key、service role key 填入 `.env.local`。
6. 将管理员邮箱写入 `ADMIN_EMAILS`，多个邮箱用英文逗号分隔。

`SUPABASE_SERVICE_ROLE_KEY` 只允许用于服务端，禁止添加 `NEXT_PUBLIC_` 前缀。

## 常用命令

```bash
npm run dev          # 本地开发
npm run build        # 正式构建
npm run typecheck    # TypeScript 检查
npm run lint         # ESLint 检查
npm run db:migrate   # 创建新的开发迁移
npm run db:deploy    # 正式环境执行已有迁移
npm run db:studio    # 打开 Prisma 数据管理界面
```

## PDF 导入原则

导入流程为：上传原文件 → 检查文本层 → OCR → 结构化 → 重复检查 → 人工校对 → 发布。

当前提供的 2018、2019、2020 年文件正文为图片截图，因此会被标记为 `PENDING_OCR`。OCR 输出不得直接成为正式题目，只有管理员确认题干、选项、答案和解析后才能发布。

## 部署到 Vercel

1. 将项目推送到 Git 仓库并导入 Vercel。
2. 在 Vercel 配置 `.env.example` 中的全部环境变量。
3. `DATABASE_URL` 使用 Supabase PostgreSQL 的连接池地址。
4. Build Command 使用 `npm run build`。
5. 首次部署前执行 `npm run db:deploy`。
6. 在 Supabase Authentication 中添加正式域名的回调地址。

## 数据安全

- 答题接口在提交前不得返回正确答案。
- 删除题目使用软删除，历史试卷快照不会丢失。
- PDF Bucket 必须保持私有。
- API 同时检查登录状态、账号状态和管理员角色。
- service role key 不会发送到浏览器。

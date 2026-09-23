# 片刻 PIANKE

**把脑中的杂事，整理成今天能开始的一步。** 一款面向信息过载和任务启动困难的中文 AI 手机 App，基于 Expo / React Native，支持 Android 与 iOS。

## 已实现

- 思绪输入：自由写下待办和压力来源，AI 整理为标题、摘要、类别、预估时间与具体步骤。
- 可编辑计划：保存前修改 AI 输出；保存后逐步勾选，完成记录自动汇总。
- 专注计时：选择计划、开始、暂停、重置；完成后记录专注时长。
- 一周回顾：过去 7 天的专注图表、完成数量与专注次数。
- 本机存储：记录保存在设备 AsyncStorage；可通过系统分享导出 JSON，也可清除全部记录。
- 演示整理：不需要账号和密钥即可体验流程。界面明确标注，它使用本机固定规则，并非 AI。

## 快速运行

需要 Node.js 22.13+、npm，以及手机上的 Expo Go。项目使用 Expo SDK 57。

```bash
npm install
npm start
```

扫描终端二维码，在 Expo Go 打开。手机与电脑连接同一局域网。iOS 原生构建需要 macOS；通过 Expo Go 可在 iPhone 上预览。

### 接入真正的 AI

1. 在项目根目录复制 `.env.example` 为 `.env`，把 `EXPO_PUBLIC_API_URL` 改为电脑的局域网 IP，例如 `http://192.168.1.10:8787`。真机不可使用 `localhost` 指向电脑。
2. 在项目根目录运行服务端，**密钥只放在服务端环境变量中**：

   ```bash
   OPENAI_API_KEY=your_key npm run server
   ```

3. 重启 Expo 开发服务器，再点「用 AI 找到第一步」。服务端默认端口 8787；`OPENAI_MODEL` 可覆盖默认模型。

服务端调用 OpenAI Responses API，要求结构化 JSON 输出，并设置 `store: false`。服务端不保存用户输入。AI 提供方仍可能依据其数据政策处理请求；使用 AI 前应告知最终用户。**切勿把 `OPENAI_API_KEY` 写入 `EXPO_PUBLIC_*` 变量、App 代码或 GitHub 仓库。**

## 验证

```bash
npm run typecheck
npm test
```

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `App.tsx` | 四个页面、整理弹窗与交互 |
| `src/planner.ts` | AI 请求、结果校验、演示整理 |
| `src/model.ts` | 数据结构和时间统计 |
| `src/storage.ts` | 本机持久化 |
| `src/styles.ts` | 视觉样式 |
| `server/index.mjs` | OpenAI API 代理、输入限制与基础限流 |
| `docs/PRODUCT.md` | 产品定位、流程与后续路线 |

## 上线前

当前服务端适合局域网开发体验。正式发布时应部署 HTTPS 服务，添加用户身份验证、持久化限流与成本控制，并根据目标地区完成隐私政策和商店资料。计时器目前用于 App 在前台时的专注流程，后台提醒与跨设备同步留待后续版本。

本项目没有随附 API 密钥、已上线服务或安装包。

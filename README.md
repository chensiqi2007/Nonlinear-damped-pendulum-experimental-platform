# 非线性阻尼单摆实验平台

一个基于 **Vite + TypeScript + Three.js** 的 WebGL 虚拟仿真实验项目，用于演示非线性阻尼单摆的运动过程，并支持实时数据观测、能量分析、相图分析、实验记录导出以及 AI 实验助手。

## 在线能力

- 三维单摆动画展示
- RK4 数值积分模拟
- 初始角度、摆长、重力、阻尼等参数可调
- 实时角度、角速度、动能、势能、机械能显示
- 能量曲线与相图分析
- 实验记录与 CSV 导出
- 秒表计时与重力加速度测算
- AI 对话助手，可辅助解释实验现象和整理报告

## 技术栈

- [Vite](https://vitejs.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Three.js](https://threejs.org/)

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发环境

```bash
npm run dev
```

启动后，Vite 会在终端输出本地访问地址，默认通常是 `http://localhost:5173`。

## 打包发布

执行下面命令生成生产构建：

```bash
npm run build
```

打包产物会输出到 `dist/` 目录。

如需本地预览生产构建：

```bash
npm run preview
```

## 环境变量

AI 对话助手使用 DashScope 兼容接口，需要配置环境变量：

```bash
VITE_DASHSCOPE_API_KEY=你的APIKey
```

可以在项目根目录新建 `.env` 文件进行配置。

## 项目结构

- `src/main.ts`：主逻辑与界面实现
- `index.html`：入口页面
- `package.json`：项目脚本与依赖

## 功能说明

### 物理仿真

系统使用数值积分模拟单摆运动，并根据当前状态更新三维场景中的摆球、摆线和轨迹。

### 实验分析

支持根据摆长、周期等数据估算重力加速度，并提供误差参考。

### 数据记录

可以记录摆动过程中的关键状态，并导出为 CSV 文件，便于后续分析或写实验报告。

## 开源说明

欢迎 fork、提交 issue 或 PR，一起完善这个单摆实验平台。

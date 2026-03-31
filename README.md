# LuminaDisplay Studio 🖥️✨

**基于 AI 驱动与 Three.js 的便携式显示器视觉营销自动化引擎**

---

## 📖 项目简介

**LuminaDisplay Studio** 是一个专为亚马逊卖家（便携式显示器品类）设计的 3D 视觉生产工作流。本项目摒弃了传统的拍摄与繁琐的 C4D/Blender 渲染流程，转而利用 **前端 Web 技术 (Three.js/WebGL)** 与 **AI (Claude/GPT/Stable Diffusion)** 协作，实现高精度产品图与宣传视频的自动化生成。

### 为什么选择这个方案？
- **极低成本**：无需摄影师和昂贵的 3D 渲染服务器。
- **极高效率**：通过代码控制相机轨迹与环境参数，几分钟即可生成 4K 宣传片。
- **高度可定制**：一键更换屏幕壁纸、边框材质、环境光照。
- **AI 协同**：创意脚本、核心渲染逻辑、Shader 算法均由 AI 辅助生成。

---

## 🚀 核心功能

- [x] **高精度 3D 建模加载**：支持 GLTF/GLB 格式的超薄显示器模型渲染。
- [x] **动态屏幕投射**：动态更新显示器屏幕上的 UI 界面、游戏画面或代码演示。
- [x] **GSAP 运镜控制**：实现“苹果发布会式”的电影级相机平滑推拉摇移。
- [ ] **AI 环境合成**：利用 Stable Diffusion 生成高清 HDRI 背景，实现真实物理光影渲染 (PBR)。
- [ ] **自动化导出**：一键导出符合亚马逊标准的 2000x2000px 主图及 1080p/4K 视频。

---

## 🛠️ 技术栈

- **核心引擎**: [Three.js](https://threejs.org/) / [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- **动画库**: [GSAP](https://greensock.com/gsap/) (用于精密控制相机轨迹)
- **AI 助手**:
    - **Claude 3.5 Sonnet**: 负责编写 Three.js 场景逻辑与物理材质代码。
    - **Stable Diffusion/Midjourney**: 负责生成环境贴图与生活场景背景。
- **视频合成**: [Remotion](https://www.remotion.dev/) (将 Web 动画直接渲染为 MP4)
- **前端框架**: Vite + React / Vue 3

---

## 🛠️ 开发指南 (AI 协作流程)

### 1. 模型预处理
将你的显示器 CAD 图纸转换为轻量化的 `.glb` 格式。

### 2. 场景搭建 (Prompt 示例)
> "Claude, 请帮我写一个 Three.js 脚本：加载一个名为 `monitor.glb` 的模型，设置金属拉丝材质，并添加两个长方形区域光（Area Light）来突出显示器的超薄边框。"

### 3. 动画制作
使用 GSAP 绑定滚动条或时间轴，控制屏幕点亮与 360 度旋转动画。

### 4. 渲染导出
运行 `npm run render` 通过 Remotion 或 Puppeteer 捕捉每一帧并合成视频。

---

## 📈 亚马逊应用场景

1. **主图 (Main Images)**：生成纯白背景下的多角度高清渲染图。
2. **副图 (Feature Images)**：展示 5mm 极致厚度、Type-C 接口细节。
3. **视频 (Video)**：展示连接笔记本、Switch 或手机的动态过程。
4. **A+ 页面**：极具科技感的拆解动画或多屏协作场景。

---

## 🧭 业务场景规划

### 1. 便携式显示器
- 核心卖点聚焦轻薄、移动办公、多设备直连、游戏娱乐。
- 场景模板建议优先覆盖桌搭、咖啡厅、出差、笔记本副屏、Switch 连接等营销场景。
- 视觉重点放在超薄边框、Type-C 接口、支架形态、屏幕色彩表现。

### 2. 工业类显示器
- 核心卖点聚焦稳定性、接口丰富、安装方式、防护能力与 7x24 小时运行。
- 场景模板建议覆盖工控台、产线设备、壁挂/嵌入式安装、弱光环境下可视化监控。
- 视觉重点放在金属外壳、加固结构、接口布局、安装孔位与高亮屏幕读数。

### 3. 小屏 DIR 场景
- 核心卖点聚焦信息发布、门店陈列、收银台/货架端展示、循环播放内容。
- 场景模板建议覆盖零售货架、餐饮点单、柜台广告位、品牌活动信息屏。
- 视觉重点放在窄边框、横竖屏切换、批量素材替换、内容模板统一性。

---

## 🗂️ 推荐工程结构

为了同时支持实时预览、场景编排、批量渲染和后续 AI 工作流，建议采用 `apps + packages + scenarios + assets` 的分层结构：

```text
LuminaDisplay-Studio/
├─ apps/
│  ├─ studio-web/           # 配置后台、3D 预览、场景编辑
│  └─ render-worker/        # Remotion/Puppeteer 渲染导出
├─ packages/
│  ├─ scene-engine/         # Three.js/R3F 场景运行时
│  ├─ product-config/       # 产品参数、材质和规格 schema
│  ├─ scenario-presets/     # 三类显示器的镜头/灯光/文案预设
│  ├─ exporter/             # 主图、视频、A+ 导出规范
│  ├─ ai-workflow/          # Prompt、素材生成、批处理流程
│  └─ shared/               # 通用类型、常量、工具函数
├─ scenarios/
│  ├─ portable-monitor/
│  ├─ industrial-monitor/
│  └─ small-dir-display/
├─ assets/
│  ├─ models/
│  ├─ textures/
│  ├─ hdri/
│  ├─ screens/
│  └─ renders/
├─ scripts/                 # 模型预处理、批量渲染、素材整理脚本
└─ docs/
   └─ architecture.md
```

详细说明见 [docs/architecture.md](docs/architecture.md)。

---

## 🚧 待办事项

- [ ] 集成深度学习超分辨率 (Upscaling) 提升渲染清晰度。
- [ ] 开发网页端后台，直接在 UI 上调整显示器参数。
- [ ] 接入 WebGPU 提升渲染实时性。

---
使用 https://www.meshy.ai/ 生成模型

## 📄 许可证

MIT License

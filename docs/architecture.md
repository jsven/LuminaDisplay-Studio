# LuminaDisplay Studio 架构规划

## 技术路线

- 前台工作台使用 `Vite + React + React Three Fiber`，承担产品参数配置、实时预览、镜头编辑与任务下发。
- 离线渲染使用 `Remotion + Puppeteer`，承担图片序列、主图、视频与 A+ 素材导出。
- 3D 能力统一收敛在 `Three.js` 运行时，避免不同场景各自复制灯光、材质、相机逻辑。
- AI 工作流单独抽离，负责 Prompt 模板、环境图生成、文案辅助与批量素材生产。

## 设计原则

- 业务场景和引擎能力分离。三类显示器场景只保存差异化配置，不重复底层渲染代码。
- 实时预览和最终导出分离。工作台负责交互，渲染端负责稳定输出。
- 产品参数和场景模板分离。一个型号可以复用多个场景，一个场景也可以服务多个型号。
- 素材资产统一归档。模型、贴图、HDRI、屏幕内容与渲染结果分目录管理。

## 推荐目录

```text
LuminaDisplay-Studio/
├─ apps/
│  ├─ studio-web/
│  │  └─ src/
│  │     ├─ app/                # 路由、Provider、全局布局
│  │     ├─ pages/              # 工作台页面
│  │     ├─ widgets/            # 场景视口、时间轴、属性面板
│  │     ├─ features/           # 型号切换、镜头编辑、导出任务
│  │     ├─ entities/           # product / scenario / render-task
│  │     └─ shared/             # UI 组件、hooks、utils
│  └─ render-worker/
│     └─ src/
│        ├─ jobs/               # 渲染任务编排
│        ├─ compositions/       # Remotion 组合
│        ├─ adapters/           # Puppeteer / 本地资源适配
│        └─ exporters/          # 图片、视频、A+ 导出器
├─ packages/
│  ├─ scene-engine/             # Three 场景、灯光、相机、材质、屏幕投射
│  ├─ product-config/           # 产品 schema、默认参数、规格映射
│  ├─ scenario-presets/         # 场景预设、镜头脚本、卖点镜头模板
│  ├─ exporter/                 # Amazon 主图/副图/视频/A+ 输出规范
│  ├─ ai-workflow/              # Prompt 模板、AI 素材生成链路
│  └─ shared/                   # 通用类型、常量、日志、配置读取
├─ scenarios/
│  ├─ portable-monitor/
│  │  ├─ products/              # 便携屏 SKU 参数
│  │  ├─ presets/               # 便携办公/娱乐/桌搭镜头模板
│  │  └─ storyboards/           # 主图/副图/视频/A+ 分镜
│  ├─ industrial-monitor/
│  │  ├─ products/              # 工业屏尺寸、接口、安装形态
│  │  ├─ presets/               # 工控台/壁挂/嵌入式场景模板
│  │  └─ storyboards/           # 强调稳定性与专业性的镜头脚本
│  └─ small-dir-display/
│     ├─ products/              # 小屏参数、横竖屏规格
│     ├─ presets/               # 零售陈列/门店信息发布模板
│     └─ storyboards/           # 循环内容、促销信息、品牌露出脚本
├─ assets/
│  ├─ models/                   # GLB/GLTF 模型
│  ├─ textures/                 # 贴图、法线、金属粗糙度
│  ├─ hdri/                     # 环境图/HDRI
│  ├─ screens/                  # 屏幕 UI、视频、宣传素材
│  └─ renders/                  # 输出结果
├─ scripts/                     # 模型预处理、批量导出、命名检查
└─ docs/
   └─ architecture.md
```

## 三类场景的边界

### 便携式显示器

- 优先支持轻薄机身、磁吸保护套/支架、笔记本副屏、Switch/手机直连。
- 预设镜头强调薄度、便携收纳、桌搭氛围和多设备兼容。
- 默认输出偏亚马逊消费电子风格，适合主图、副图和短视频。
- 目录建议在 `scenarios/portable-monitor/products/` 下按尺寸建目录，例如 `07-inch`、`13-5-inch`、`14-inch`、`15-6-inch`、`16-inch`。
- 不建议每个尺寸复制一套 `presets/`；共享场景放在 `presets/`，尺寸差异通过各尺寸目录中的覆盖配置处理。

### 工业类显示器

- 优先支持金属机身、VESA/嵌入式/壁挂安装、丰富接口与稳定运行卖点。
- 预设镜头强调接口细节、安装方式、运行环境与专业可靠感。
- 导出模板需要兼容更强的信息密度，适合参数说明图和行业型宣传视频。

### 小屏 DIR 场景

- 优先支持横竖屏切换、门店陈列、货架广告位、收银台信息发布。
- 预设镜头强调内容模板切换、批量换图、统一风格和高频更新。
- 导出模板要支持多比例内容和屏幕内容循环播放演示。

## 模块职责建议

- `scene-engine` 只负责渲染能力，不感知具体业务型号。
- `product-config` 维护尺寸、材质、接口、屏幕比例以及品牌名称等产品属性。
- `scenario-presets` 负责把产品属性组合成可复用的营销场景。
- `exporter` 负责把场景落成 Amazon 主图、副图、视频和 A+ 成品。
- `ai-workflow` 负责把文案、环境、背景、脚本生成流程标准化。

## 建议开发顺序

1. 先完成 `packages/scene-engine` 与 `packages/product-config`，打稳底座。
2. 再搭 `apps/studio-web`，优先把产品切换、场景预览、参数面板跑通。
3. 然后补 `scenarios/*` 里的预设与分镜，先做便携式显示器样板。
4. 最后接入 `apps/render-worker` 与 `packages/exporter`，形成批量导出闭环。



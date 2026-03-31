# portable-monitor presets

这里放便携式显示器共用的营销场景模板，不按尺寸拆目录。

## 当前初始化的共享预设

- `office-dual-screen`: 笔记本副屏、移动办公、桌搭协作。
- `travel-mobile`: 出差、咖啡厅、轻办公和便携收纳。
- `gaming-console`: Switch/掌机/游戏娱乐连接演示。
- `code-demo`: 代码、数据面板、开发者工作流展示。

## 使用原则

- 默认所有尺寸都可复用这些预设。
- 某个尺寸如果构图、UI 比例、设备组合不同，就在对应尺寸目录的 `overrides/` 下做覆盖。
- 品牌名称露出也走覆盖机制；如果某个场景需要单独的品牌文字或隐藏品牌位，在 `overrides/<preset-id>.json` 里写 `branding`。
- 只有当一个场景完全不适用于其他尺寸时，才新建独立预设目录。



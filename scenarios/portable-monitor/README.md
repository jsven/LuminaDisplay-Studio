# portable-monitor

便携式显示器场景集合，优先覆盖移动办公、桌搭、副屏和娱乐连接场景。

## 目录规划原则

- 尺寸应该有自己的目录，但只放在 `products/` 下，不要把整套场景按尺寸复制。
- `presets/` 放共享场景模板，例如办公、副屏、Switch 游戏、代码演示。
- `storyboards/` 放输出脚本，按主图、副图、视频维度组织。
- 尺寸差异通过每个尺寸目录里的 `overrides/` 或 `product.json` 配置解决，而不是复制 `presets/`。

## 推荐结构

```text
portable-monitor/
├─ products/
│  ├─ 07-inch/
│  ├─ 13-5-inch/
│  ├─ 14-inch/
│  ├─ 15-6-inch/
│  └─ 16-inch/
├─ presets/
│  ├─ office-dual-screen/
│  ├─ travel-mobile/
│  ├─ gaming-console/
│  └─ code-demo/
└─ storyboards/
```

## 为什么这样拆

- 同一尺寸下可能有多个 SKU，所以尺寸目录是产品层，不是场景层。
- 同一个办公或娱乐场景往往可以复用到多个尺寸，只需要少量镜头距离和 UI 缩放覆盖。
- 后续如果增加 `18.5`、`17.3` 等尺寸，只需在 `products/` 下新增目录，不会冲击现有预设。

## 命名规则

- 目录名统一使用英寸值的 slug，例如 `07-inch`、`13-5-inch`、`15-6-inch`。
- 小数点用 `-` 替代，避免路径和脚本引用不稳定。
- 真正的型号、SKU、面板规格放在尺寸目录中的 `skus/` 或 `product.json` 中维护。

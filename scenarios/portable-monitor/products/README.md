# portable-monitor products

这里按尺寸组织便携式显示器产品层。

## 规则

- 每个尺寸一个目录，例如 `07-inch`、`13-5-inch`、`14-inch`、`15-6-inch`、`16-inch`。
- 同一尺寸下如果有多个型号，把具体型号放进 `skus/`，不要继续在 `products/` 根目录平铺。
- 所有共享营销场景继续复用 `../presets/`，只在尺寸目录里维护差异化参数。

## 每个尺寸目录建议包含

- `product.json`: 当前尺寸段的基线参数。
- `skus/`: 该尺寸下的具体 SKU 配置。
- `assets/`: 尺寸专属模型、尺寸图、补充贴图。
- `overrides/`: 对共享预设的镜头、构图、UI 缩放覆盖。

## 参数应该放到哪里

### 1. 尺寸公共参数

放到当前尺寸目录下的 `product.json`。

适合放这里的内容：

- 该尺寸段共用的物理尺寸
- 默认屏幕比例
- 默认分辨率范围
- 当前尺寸段默认品牌配置（例如 `branding.brandName`）
- 默认构图建议
- 默认可复用的场景预设列表

示例路径：

- `scenarios/portable-monitor/products/15-6-inch/product.json`

### 2. 具体产品参数

放到当前尺寸目录下的 `skus/<product-id>.json`。

适合放这里的内容：

- 具体品牌名和系列名（如果要覆盖尺寸默认品牌配置）
- 具体型号名
- SKU 编号
- 亮度、色域、刷新率
- 接口数量和类型
- 外壳颜色
- 支架形态
- VESA、扬声器、HDR、触控等差异项

示例路径：

- `scenarios/portable-monitor/products/15-6-inch/skus/pm156-pro.json`
- `scenarios/portable-monitor/products/15-6-inch/skus/pm156-touch.json`

### 3. 场景差异参数

放到当前尺寸目录下的 `overrides/`。

适合放这里的内容：

- 不同尺寸在某个场景下的镜头远近
- UI 缩放
- 设备摆位
- 品牌名称在该场景里的露出方式
- 文案留白
- 不同尺寸专属的屏幕内容替换

示例路径：

- `scenarios/portable-monitor/products/15-6-inch/overrides/office-dual-screen.json`
- `scenarios/portable-monitor/products/07-inch/overrides/gaming-console.json`

## 推荐使用规则

- `product.json` 只放尺寸层公共参数，不放某个具体 SKU 的独占参数。
- 如果当前尺寸段需要统一露出品牌名称，可以在 `product.json` 里维护 `branding` 基线对象；具体 SKU 再覆盖 `branding.brandName`。
- `skus/*.json` 才是最终可售卖产品的核心参数文件。
- `overrides/*.json` 只处理场景表现差异，不要把产品基础参数写进去。

## 推荐目录示例

```text
scenarios/portable-monitor/products/
└─ 15-6-inch/
   ├─ product.json
   ├─ skus/
   │  ├─ pm156-pro.json
   │  └─ pm156-touch.json
   ├─ overrides/
   │  ├─ office-dual-screen.json
   │  └─ gaming-console.json
   └─ assets/
```

## 你现在可以直接这样理解

- 如果参数属于“15.6 寸这一类产品都通用”，写进 `product.json`
- 如果参数属于“某一个具体型号”，写进 `skus/<product-id>.json`
- 如果参数属于“这个型号在某个场景里怎么表现”，写进 `overrides/<preset-id>.json`
- 如果你要给当前显示屏设计加品牌名称配置，优先使用 `branding.brandName`，场景差异再通过 `overrides` 里的 `branding` 覆盖。



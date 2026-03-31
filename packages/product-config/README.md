# product-config

维护产品规格、尺寸、接口、材质和默认参数 schema。

## 新增品牌名称配置约定

- 当前显示屏设计默认使用 `branding.brandName` 保存品牌名称。
- 建议同时保留 `branding.placement`，用于描述品牌名称的默认落位，例如 `bezel-bottom-center`。
- `branding.visible` 用于控制是否显示品牌位。
- 尺寸级公共默认值放在 `scenarios/*/products/*/product.json`。
- 具体 SKU 如需覆盖品牌名称，沿用同一字段结构覆盖 `branding` 即可。

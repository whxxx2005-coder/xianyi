# 静态资源存放说明

为了使网页能够自动识别并读取您的资料，请将文件存放在以下对应目录：

## 1. 图片资源 (assets/images/)
- 首页海报：命名为 `poster.png`
- 文物图片：命名为 `{ID}.png`（例如：`rel-1.png`, `rel-2.png`）
- 支持格式：.png, .jpg, .jpeg

## 2. 音频资源 (assets/audio/)
- 讲解词音频：命名格式为 `{文物ID}_{人格英文名}.mp3`
- 人格英文名对应表：
  - 促进型 -> `facilitator`
  - 探索者 -> `explorer`
  - 专业研究者 -> `professional`
  - 灵感寻求者 -> `inspiration`
  - 体验追寻者 -> `experience`
- 示例：`rel-1_explorer.mp3`

> 注意：文件名必须严格遵守以上规则，网页方可实现全自动读取。
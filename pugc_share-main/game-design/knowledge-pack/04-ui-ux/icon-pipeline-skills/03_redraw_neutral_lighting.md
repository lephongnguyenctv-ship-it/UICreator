---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/04-ui-ux/icon-pipeline-skills/03-redraw-neutral-lighting.md"
---

# Skill: Redraw with Neutral Lighting

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../../README.md#integration-and-applicability).

## Input và output

- Input bắt buộc: `plant_icons_256_transparent/<input-name>.png`.
- Tạo bản redraw tại `plant_icons_256_redraw/<input-name>.png`, PNG RGBA 256 × 256.
- Folder redraw là asset base: transparent, không outline và không frame.

## Mục tiêu hình ảnh

- Chuyển screenshot model 3D thành icon 2D sạch, nhưng vẫn giữ cảm giác 3D low-poly qua facet rõ ràng và ambient occlusion rất nhẹ.
- Loại bỏ ảnh hưởng ánh sáng từ viewport: blue sky tint, floor reflection, horizon và directional scene lighting.
- Dùng ánh sáng front-light trung tính, đều và không có color grading.
- Giữ màu vật liệu chuẩn theo ảnh gốc: không tự recolor, tăng/giảm saturation, đổi hue, thêm glow hoặc tạo palette mới.

## Invariant phải giữ

- Character identity và silhouette.
- Pose, proportions, camera angle và framing.
- Tất cả leaf, tay/chân, hat, weapon, accessory, projectile và object rời có trong ảnh gốc.
- Facial expression, low-poly shape language và màu gốc.

## Không được có

- Background, grid, shadow trên canvas, checkerboard giả hoặc nền đen/trắng.
- Frame từ bước redraw; viền rarity chỉ thêm sau bước redraw.
- Text, label, watermark, object mới hoặc chi tiết bị thiếu.
- Painterly texture, photorealism, dramatic lighting hoặc reflection không có trong source.

## Hoàn thiện

Sau khi redraw, tách nền alpha thật và resize về 256 × 256 với safe inset tối thiểu 12 px ở mọi phía. Nếu tool xuất background chroma hoặc checkerboard giả, phải remove background trước khi đưa vào folder output. Chỉ thêm outline ở bước dẫn xuất sau đó theo skill `02_icon_variants_and_rarity.md`; không thêm outline vào `plant_icons_256_redraw/`.

## Audit redraw bắt buộc

1. Redraw phải lấy từ asset đã pass `plant_icons_256_transparent/`, không lấy trực tiếp từ screenshot `src/` trừ khi transparent cần được làm lại.
2. Compositing candidate trên nền trắng, tối `#181C24`, magenta `#FF00BC` và caro đen.
3. Kiểm tra có còn fringe trắng/xám/xanh quanh silhouette không. Đây có thể là RGB bị nhiễm nền dù alpha đã đúng. Nếu có, làm sạch alpha/RGB ở ảnh lớn trước khi scale, sau đó audit lại.
4. Đối chiếu với transparent/source để xác nhận không mất leaf, staff, weapon, teeth, cannon, chân, mũ hoặc projectile.
5. Chỉ copy candidate đã pass vào `plant_icons_256_redraw/`. Nếu redraw bị mất chi tiết hoặc sai silhouette, quay lại transparent/source và redraw lại, không vá bằng cách cắt thêm nhiều lần trên output hỏng.

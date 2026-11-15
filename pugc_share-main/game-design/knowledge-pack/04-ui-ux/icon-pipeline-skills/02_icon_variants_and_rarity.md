---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/04-ui-ux/icon-pipeline-skills/02-icon-variants-and-rarity.md"
---

# Skill: Icon Variants and Rarity Border

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../../README.md#integration-and-applicability).

## Hai icon cutout

Từ mỗi ảnh trong `src/`, tạo hai icon:

- `plant_icons_128/<input-name>.png`: canvas vuông 128 × 128.
- `plant_icons_64/<input-name>.png`: canvas vuông 64 × 64.

Subject phải nằm giữa canvas, giữ tỷ lệ, chiếm phần lớn diện tích hợp lý và không bị crop. Bản 64 phải là bản downscale sạch, vẫn đọc được silhouette và viền.

## Viền rarity

Bảng màu bên dưới là palette ví dụ của project nguồn, không phải chuẩn Craftland chung.
Lấy rarity từ config và palette từ UI/asset thật của game đang làm; không suy đoán từ hình dáng icon.

Viền là outline nhẹ bên ngoài silhouette, không phải background đặc hoặc khung vuông. Viền không được che chi tiết của plant.

| Rarity | Border / background color | Text color |
| --- | --- | --- |
| Common | `#B0BEC5` — Soft Blue-Gray | `#263238` — Charcoal |
| Uncommon | `#81C784` — Soft Mint | `#1B5E20` — Dark Forest |
| Rare | `#64B5F6` — Sky Blue | `#0D47A1` — Deep Blue |
| Epic | `#BA68C8` — Soft Violet | `#4A148C` — Dark Plum |
| Legendary | `#FFD54F` — Soft Gold | `#4E342E` — Warm Brown |
| Mythic | `#E57373` — Soft Coral Red | `#B71C1C` — Deep Red |
| Special | `#80DEEA` — Soft Ice Blue | `#004D40` — Deep Pine |
| Locked | `#78909C` — Slate Neutral | `#ECEFF1` — Pale Tint |

Quy ước độ dày:

- 128 × 128: khoảng 2 px, opacity nhẹ để không át màu plant.
- 64 × 64: khoảng 1 px, vẫn rõ nhưng không bị dày.

Màu border dùng cột `Border / background color`. Text color chỉ dùng khi UI có label rarity, không dùng để đổi màu plant.

## Nguồn để thêm hoặc sửa outline

- Dùng `plant_icons_256_transparent/` khi cần outline cho cutout gốc.
- Dùng `plant_icons_256_redraw/` khi cần outline cho icon redraw.
- Không ghi outline vào hai folder 256 base này. Xuất ra folder dẫn xuất theo kích thước/style được yêu cầu.

## Preset: rarity keyline đậm (256 và final 128 px)

Dùng khi icon cần tách biệt mạnh khỏi UI, lấy cảm hứng từ keyline đen rõ trong các sprite game hiện có.

- Input: `plant_icons_256_redraw/`.
- Output review: `plant_icons_256_rarity_keyline/`.
- Output final: `plant_icons_128_rarity_keyline/`.
- Bản 256 dùng thứ tự từ subject ra ngoài: **đen gần `#141612` 2 px → band màu rarity 4 px → đen gần `#141612` 2 px**.
- Render viền tại base 256 rồi downscale sạch xuống 128. Độ dày final từ subject ra ngoài: **đen gần `#141612` 1 px → band màu rarity 2 px → đen gần `#141612` 1 px**.
- Outline luôn nằm hoàn toàn bên ngoài alpha silhouette; không recolor, che hay redraw plant.
- Màu band vẫn lấy từ cột `Border / background color` trong bảng rarity phía trên.

## Audit keyline bắt buộc

1. Chỉ tạo keyline từ redraw đã pass audit.
2. Kiểm tra trên UI nền sáng và tối, đồng thời kiểm tra nền magenta hoặc caro để chắc chắn keyline không che, không làm thủng và không cắt subject.
3. Kiểm tra thứ tự layer đúng: subject → keyline đen trong → band rarity → keyline đen ngoài. Viền phải nằm ngoài alpha subject, không có nền vuông.
4. Ở 128 × 128, kiểm tra readability của chi tiết mảnh và band rarity; nếu viền dày làm mất silhouette, sửa preset keyline rồi render lại từ asset 256, không sửa thủ công file final nhỏ.
5. Lưu contact sheet audit trước khi giao final hoặc đưa icon vào UI.

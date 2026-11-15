---
doc_type: knowledge_pack_index
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/04-ui-ux/icon-pipeline-skills/README.md"
---

# Plant Icon Processing

> Imported as reference documentation into the existing umbrella from `process-icon/`. The three skill files sit next to this README (no `skills/` subfolder here); the image output folders are not copied.

Tài liệu này quy định cách xử lý icon plant từ ảnh screenshot model 3D. Mục tiêu là tái sử dụng đúng workflow mà không cần phụ thuộc vào context của cuộc hội thoại trước.

## Cấu trúc folder trong project nguồn (ví dụ)

```text
process-icon/
├── README.md
├── skills/
│   ├── 01_source_and_transparent_cutout.md
│   ├── 02_icon_variants_and_rarity.md
│   └── 03_redraw_neutral_lighting.md
├── src/
├── plant_icons_256_transparent/
├── plant_icons_256_redraw/
├── plant_icons_256_rarity_keyline/
├── plant_icons_128_rarity_keyline/
├── plant_icons_128/
├── plant_icons_64/
├── redraw_review/ (audit sheet và candidate review, không phải output game)
└── plant_icons_128_redraw/ (legacy, không tạo mới)
```

`src/` là nơi lưu ảnh screenshot gốc. Không sửa hoặc ghi đè ảnh trong folder này.

## Output và asset base

| Folder | Kích thước | Mục đích |
| --- | --- | --- |
| `plant_icons_256_transparent/` | 256 × 256 | Cutout từ screenshot, transparent, **không outline**. Đây là base asset để redraw hoặc thêm outline sau này. |
| `plant_icons_256_redraw/` | 256 × 256 | Redraw từ chính `plant_icons_256_transparent/`, ánh sáng trung tính, transparent, **không outline**. Đây là base asset cho outline của phiên bản redraw. |
| `plant_icons_256_rarity_keyline/` | 256 × 256 | Keyline preview dẫn xuất từ `plant_icons_256_redraw/`: đen 2 px → màu rarity 4 px → đen 2 px. Dùng để review outline ở độ phân giải base. |
| `plant_icons_128_rarity_keyline/` | 128 × 128 | Final icon dẫn xuất từ `plant_icons_256_redraw/`: keyline đậm **đen 1 px → màu rarity 2 px → đen 1 px**, giúp đọc icon rõ trên UI sáng/tối mà vẫn nhận diện rarity. |
| `plant_icons_128/` | 128 × 128 | Cutout trực tiếp từ screenshot, nền transparent, crop sát, viền rarity. |
| `plant_icons_64/` | 64 × 64 | Bản nhỏ tương ứng chính xác với `plant_icons_128/`, nền transparent, viền rarity. |
| `plant_icons_128_redraw/` | 128 × 128 | Legacy sample; không tạo mới. Final redraw có outline dùng `plant_icons_128_rarity_keyline/`. |

Tất cả output phải là PNG RGBA, pixel trong suốt thật, không dùng nền caro giả, nền đen, nền trắng hoặc nền màu thay thế.

## Flow chuẩn cho asset mới

```text
src
  → plant_icons_256_transparent
  → AUDIT TRANSPARENT
  → plant_icons_256_redraw
  → AUDIT REDRAW
  → plant_icons_256_rarity_keyline / plant_icons_128_rarity_keyline
  → AUDIT KEYLINE
```

- Không được bỏ qua audit gate. Chỉ ghi đè output chính khi candidate đã pass gate tương ứng.
- Nếu audit phát hiện thiếu chi tiết, crop, nền còn sót hoặc fringe, quay lại đúng bước gây lỗi. Nếu không xác định được nguồn lỗi, làm lại chuỗi từ `src` thay vì vá tiếp output dẫn xuất.
- Hai folder 256 là asset base, không được ghi outline vào chúng.
- Khi thay đổi outline, tạo hoặc cập nhật một output dẫn xuất từ asset 256 tương ứng; không tách nền hoặc redraw lại nếu source chưa thay đổi.
- `plant_icons_128_redraw/` không còn là output cần tạo. Giữ nguyên folder legacy cho đến khi có yêu cầu xoá rõ ràng.

## Quy tắc chung

- Tên output phải giống chính xác tên file input, chỉ thay đổi folder đích.
- Crop theo toàn bộ subject, bao gồm leaf, tay/chân, vũ khí, accessory và vật thể rời. Khi đặt vào canvas 256, chừa **safe inset tối thiểu 12 px** mỗi phía để keyline và chi tiết mảnh không bị chạm mép.
- Làm thử 2 ảnh cho mỗi plant trước, chờ người dùng duyệt style rồi mới xử lý toàn bộ biến thể còn lại.
- Giữ nguyên identity, silhouette, pose, camera angle, accessory và màu vật liệu của plant. Không thêm vật thể, text, watermark hoặc recolor tùy ý.
- Đọc các tài liệu chi tiết trong bảng Contents bên dưới trước khi xử lý.

## Quy ước audit bắt buộc

Audit không được chỉ nhìn preview caro của phần mềm vì caro có thể là dữ liệu bitmap bị ghi nhầm vào ảnh. Mỗi candidate phải được compositing thật trên các nền sau:

1. Trắng hoặc sáng để thấy viền tối, pixel bẩn và crop.
2. Tối gần `#181C24` để thấy halo sáng/trắng/xám.
3. Magenta `#FF00BC` để thấy alpha bị thiếu hoặc nền chưa được xóa.
4. Caro đen chỉ dùng thêm ở audit redraw để phân biệt transparency preview với pixel nền thật.

Một asset pass khi: không còn sky/grid/checkerboard thật; không có halo hoặc fringe theo màu nền cũ; alpha ngoài silhouette bằng 0; không mất chi tiết mảnh; canvas đúng 256 × 256 RGBA; và tên file khớp source. Lưu contact sheet audit trong `redraw_review/` với tên mô tả rõ stage và trạng thái, ví dụ `transparent_audit`, `redraw_audit`, hoặc `keyline_audit`.

## Rarity của bộ plant trong project nguồn (ví dụ)

| Plant | Rarity |
| --- | --- |
| Carrot | Common |
| Corn | Common |
| Tomato | Uncommon |
| Watermelon | Uncommon |
| Coconut | Rare |
| Apple | Rare |
| Pear | Rare |
| Chili | Epic |
| Strawberry | Epic |
| Banana | Legendary |
| Pineapple | Legendary |
| Blueberry | Mythic |

Chi tiết màu và cách đặt viền nằm trong [02_icon_variants_and_rarity.md](02_icon_variants_and_rarity.md).


## Contents

| Reference | File | Purpose |
|---|---|---|
| Source & transparent cutout | [01_source_and_transparent_cutout.md](01_source_and_transparent_cutout.md) | Preserve identity, real alpha, safe inset and transparent audit. |
| Icon variants & rarity | [02_icon_variants_and_rarity.md](02_icon_variants_and_rarity.md) | Derived sizes, example palette, keyline layers and audit. |
| Neutral-light redraw | [03_redraw_neutral_lighting.md](03_redraw_neutral_lighting.md) | Neutral lighting with source identity and clean alpha. |

These are reference documents inside the umbrella. The folder tree above belongs to the source
asset-processing project; images and output folders were not imported. Species rarity and colors
are examples: resolve them from the target game's config and real assets.

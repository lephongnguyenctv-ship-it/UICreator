---
doc_type: knowledge_reference
domain: craftland-ugc
version: 1.0.0
last_updated: 2026-10-09
source: "plant-vs-zombie/GDD/knowledge-pack/04-ui-ux/icon-pipeline-skills/01-source-and-transparent-cutout.md"
---

# Skill: Source and Transparent Cutout

> Imported reference: source-project numbers, preferences, paths and decisions are examples.
> Use the target game's verified code/config and current task scope; see [pack applicability](../../README.md#integration-and-applicability).

## Input và source of truth

- Copy toàn bộ file screenshot gốc vào `src/` trước khi xử lý.
- Giữ nguyên tên file gốc và không ghi đè `src/`.
- Mỗi screenshot là source of truth cho character identity, hình dáng, pose, góc camera, accessory, projectile và màu vật liệu.

## Yêu cầu tách nền

- Loại bỏ hoàn toàn sky, horizon, floor, grid và các mảnh background còn sót lại.
- Output phải có alpha channel thật. Kiểm tra corner pixel alpha bằng 0 và xác nhận mode `RGBA`.
- Không để checkerboard được vẽ vào bitmap; checkerboard chỉ được phép là cách phần mềm preview transparency.
- Không làm mất chi tiết mảnh như leaf, dây, tay/chân, vũ khí hoặc vật thể rời.
- Crop bounding box theo toàn bộ foreground, sau đó thêm biên nhỏ. Khi scale vào canvas 256, dùng **safe inset tối thiểu 12 px** mỗi phía. Mục tiêu là cả silhouette lẫn keyline sau này không được chạm mép canvas.
- Khi dùng AI/background extraction, ưu tiên xử lý và làm sạch alpha ở độ phân giải gốc trước, rồi mới fit/downscale về 256. Việc này giúp loại fringe sub-pixel tốt hơn thao tác cắt mạnh trực tiếp ở canvas nhỏ.
- Không lấy checkerboard trong preview làm bằng chứng alpha. Chỉ công nhận alpha sau khi compositing file PNG trên nhiều nền màu thật.

## Output base chuẩn

- Tạo `plant_icons_256_transparent/<input-name>.png`, canvas vuông 256 × 256.
- Folder này chỉ có plant cutout RGBA, **không được thêm rarity outline**.
- Đây là input bắt buộc cho bước redraw và là source giữ lại để tạo các outline version sau này.

## Audit transparent bắt buộc

1. Compositing candidate trên nền trắng, tối `#181C24` và magenta `#FF00BC`.
2. Kiểm tra không còn sky, horizon, floor, grid, checkerboard bitmap, halo trắng/xám/xanh hoặc shadow ngoài silhouette.
3. Zoom kiểm tra các vùng mảnh: leaf, staff/dây, tay/chân, cannon, teeth, accessory và projectile.
4. Kiểm tra canvas 256 × 256, PNG RGBA, alpha ngoài subject bằng 0, safe inset và tên file.
5. Chỉ khi pass mới ghi candidate vào `plant_icons_256_transparent/`. Nếu thiếu chi tiết hoặc edge không sạch, làm lại từ `src/`; không sửa bằng mask của một redraw cũ.

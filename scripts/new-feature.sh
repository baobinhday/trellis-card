#!/usr/bin/env bash
# scripts/new-feature.sh - Tạo nhanh thư mục feature và các file template chuẩn cho Lean Trellis Workflow
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Sử dụng: $0 <feature-slug> [feature-title]"
  echo "Ví dụ:   $0 kanban-sync \"Đồng bộ Kanban đa dự án\""
  exit 1
fi

RAW_SLUG="$1"
SLUG="$(echo "$RAW_SLUG" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-_')"
TITLE="${2:-$RAW_SLUG}"
DATE=$(date +%Y-%m-%d)

CURRENT_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Tìm kiếm thư mục templates tại các vị trí khả dĩ
TEMPLATE_DIR=""
POSSIBLE_TEMPLATE_DIRS=(
  "$SCRIPT_DIR/../templates"
  "$CURRENT_DIR/.agent/skills/lean-trellis-workflow/templates"
  "$CURRENT_DIR/.agents/skills/lean-trellis-workflow/templates"
  "$CURRENT_DIR/.claude/skills/lean-trellis-workflow/templates"
  "$CURRENT_DIR/.cursor/skills/lean-trellis-workflow/templates"
  "$CURRENT_DIR/.opencode/skills/lean-trellis-workflow/templates"
)

for dir in "${POSSIBLE_TEMPLATE_DIRS[@]}"; do
  if [ -f "$dir/prd.template.md" ]; then
    TEMPLATE_DIR="$dir"
    break
  fi
done

if [ -z "$TEMPLATE_DIR" ]; then
  echo "❌ Lỗi: Không tìm thấy thư mục templates của Lean Trellis Workflow."
  echo "Hãy đảm bảo skill lean-trellis-workflow đã được cài đặt vào dự án."
  exit 1
fi

# Xác định vị trí đích (.trellis/research hoặc docs/features)
if [ -d "$CURRENT_DIR/.trellis" ]; then
  TARGET_DIR="$CURRENT_DIR/.trellis/research/$SLUG"
else
  TARGET_DIR="$CURRENT_DIR/docs/features/$SLUG"
fi

mkdir -p "$TARGET_DIR"

# Hàm thay thế placeholder
render_template() {
  local src="$1"
  local dest="$2"
  sed \
    -e "s|{{FEATURE_SLUG}}|$SLUG|g" \
    -e "s|{{FEATURE_TITLE}}|$TITLE|g" \
    -e "s|{{DATE}}|$DATE|g" \
    "$src" > "$dest"
}

render_template "$TEMPLATE_DIR/prd.template.md" "$TARGET_DIR/prd.md"
render_template "$TEMPLATE_DIR/design.template.md" "$TARGET_DIR/design.md"
render_template "$TEMPLATE_DIR/implement.template.md" "$TARGET_DIR/implement.md"

echo " Khởi tạo thành công thư mục tính năng tại:"
echo "   $TARGET_DIR"
echo "Các file đã tạo:"
echo "   - $TARGET_DIR/prd.md"
echo "   - $TARGET_DIR/design.md"
echo "   - $TARGET_DIR/implement.md"
echo ""
echo "Bạn có thể bắt đầu bằng việc yêu cầu AI đọc và điền thông tin vào prd.md!"

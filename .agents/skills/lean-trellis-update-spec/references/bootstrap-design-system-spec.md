# Bootstrapping Design System Spec from Codebase

Use this single-agent workflow when user chats:
- *"Tạo spec design cho dự án"*
- *"Khởi tạo design spec"*
- *"Bootstrap design spec"*

---

## 1. Project Intelligence & Asset Discovery

Before writing `.trellis/spec/design-system.md`, the AI assistant **MUST inspect the codebase first**:

1. **Detect Styling & Framework:**
   - Inspect `package.json` for styling libraries: Tailwind CSS (`tailwindcss`, `@tailwindcss/*`), Shadcn/ui (`components.json`), Radix UI (`@radix-ui/*`), MUI (`@mui/material`), Ant Design (`antd`), Chakra UI, CSS Modules, Styled Components, Emotion, NativeWind (React Native).
2. **Locate Existing Token Definitions:**
   - Inspect config files: `tailwind.config.*`, `uno.config.*`, `theme.ts`, `styles/globals.css`, `app/globals.css`, `src/index.css`.
   - Read CSS variables (`:root`, `.dark`) or theme color definitions.
   - Inspect existing component library in `components/ui/` or `src/components/`.
3. **Check for External UIUX Orchestrator:**
   - Check if `uiux-orchestrator` is installed in `.agent/skills/` or `.agents/skills/`.
   - If present, check if `uupm/design-system` or `impeccable` are available to extract patterns.

---

## 2. Decision & Alignment (At Most 1 Question)

- **Scenario A: The project ALREADY HAS design tokens & styling:**
  - Do NOT ask redundant questions.
  - Directly extract the active tokens, colors, typography, and component conventions into `.trellis/spec/design-system.md`.
- **Scenario B: The project is completely new (zero styling / greenfield):**
  - Ask **exactly 1 high-value question** with an opinionated recommendation:
    ```
    Dự án hiện chưa có cấu hình Design System.
    ➡️ Đề xuất: Khởi tạo với Tailwind CSS theo phong cách Modern Minimalist (Bảng màu Slate + Indigo, border-radius 8px, font Inter).
    Bạn có đồng ý với phong cách này không, hay bạn muốn một phong cách khác (ví dụ: Dark mode cyberpunk, Corporate Clean, Pastel Soft)?
    ```

---

## 3. Writing `.trellis/spec/design-system.md`

Write a concise, source-backed specification into `.trellis/spec/design-system.md` following the template in `templates/design-system-spec.md`:
1. **Color Palette & Semantic Tokens:** Primary, Secondary, Background, Surface, Border, Text, Destructive.
2. **Typography Scale:** Font families, display, headings h1-h4, body, caption.
3. **Spacing & Radii:** Base 4px grid, border radius scale.
4. **Layout & Breakpoints:** Mobile (390px), Tablet (768px), Desktop (1280px+).
5. **The 6 Mandatory UI States:** Normal, Loading (Skeleton), Empty, Error, Validation, Responsive.
6. **Component Conventions:** Button variants, Input styling, Data table rules.

*Requirements:*
- Keep the file under 150 lines.
- Zero placeholder text (`TODO`, `To be filled`).
- Link this file from `.trellis/spec/index.md`.

// 入口：全部逻辑在 lib.rs（Tauri 移动端约定）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Avoid WebKitGTK DMA-BUF renderer black/blank screen issues on Linux
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    match std::env::args().nth(1).as_deref() {
        Some("hook") => trellis_card_lib::run_hook_cli(),
        Some("install-hooks") => trellis_card_lib::run_hook_install_cli(),
        _ => trellis_card_lib::run(),
    }
}

// Crash logging: writes panics (with a backtrace) and lifecycle markers to a
// plain-text file so a silent GUI crash becomes diagnosable. No external deps.
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::panic::{self, PanicHookInfo};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, Once};

const MAX_LOG_BYTES: u64 = 1024 * 1024;

static INIT: Once = Once::new();
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// Log lives next to config.json, so it is easy to find on every platform:
///   Linux:   ~/.config/trellis-card/crash.log
///   macOS:   ~/Library/Application Support/trellis-card/crash.log
///   Windows: %APPDATA%\trellis-card\crash.log
pub fn crash_log_path() -> PathBuf {
    crate::config::app_config_dir().join("crash.log")
}

fn timestamp() -> String {
    chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S%.3f")
        .to_string()
}

fn rotate_if_needed(path: &Path) {
    if let Ok(meta) = fs::metadata(path) {
        if meta.len() > MAX_LOG_BYTES {
            let _ = fs::rename(path, path.with_extension("log.old"));
        }
    }
}

/// Append one line to the log and mirror it to stderr (visible when launched
/// from a terminal). Never panics: logging must survive a crashing process.
pub fn log(tag: &str, message: &str) {
    let line = format!(
        "{} [{}] pid={} {}\n",
        timestamp(),
        tag,
        std::process::id(),
        message
    );

    let _guard = match WRITE_LOCK.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    let path = crash_log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    rotate_if_needed(&path);
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = file.write_all(line.as_bytes());
        let _ = file.flush();
    }

    eprintln!("{}", line.trim_end());
}

/// Install the global panic hook once. Call at the very start of `run()`,
/// before any worker thread is spawned, so panics on background threads are
/// captured too.
pub fn init() {
    INIT.call_once(|| {
        log("START", "Trellis Card launched");

        panic::set_hook(Box::new(|info: &PanicHookInfo<'_>| {
            let payload = if let Some(text) = info.payload().downcast_ref::<&str>() {
                (*text).to_string()
            } else if let Some(text) = info.payload().downcast_ref::<String>() {
                text.clone()
            } else {
                format!("{:?}", info.payload())
            };
            let location = info
                .location()
                .map(|loc| loc.to_string())
                .unwrap_or_else(|| "unknown location".to_string());
            let backtrace = std::backtrace::Backtrace::force_capture();

            log(
                "PANIC",
                &format!("{} @ {}\n--- backtrace ---\n{}", payload, location, backtrace),
            );
        }));
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn panic_hook_writes_message_and_backtrace_to_log() {
        init();
        let _ = std::panic::catch_unwind(|| panic!("boom-verification"));

        let contents = fs::read_to_string(crash_log_path()).unwrap_or_default();
        assert!(
            contents.contains("boom-verification"),
            "panic message missing from log"
        );
        assert!(
            contents.contains("--- backtrace ---"),
            "backtrace missing from log"
        );
    }
}

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::io::BufRead;
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::fs;
use std::path::PathBuf;

use tauri::{Emitter, Manager, State};
use uuid::Uuid;

// ── Shared state ──
struct ProcMap(Arc<Mutex<HashMap<String, std::process::Child>>>);

// ── Windows: 隐藏子进程窗口 ──
#[cfg(target_os = "windows")]
fn hide_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x08000000);
}
#[cfg(not(target_os = "windows"))]
fn hide_window(_cmd: &mut Command) {}

// ── Helper: find ffmpeg binary ──
fn ffmpeg_path(name: &str, _app: &tauri::AppHandle) -> String {
    let bin_name = format!("{}{}", name, if cfg!(windows) { ".exe" } else { "" });

    // 1. Dev: project root resources/ffmpeg/bin/
    let cwd = std::env::current_dir().unwrap_or_default();
    let local = cwd.join("resources").join("ffmpeg").join("bin").join(&bin_name);
    if local.exists() { return local.display().to_string(); }

    // 2. Bundled: resource_dir/ffmpeg/bin/ (production)
    let resource_dir = _app.path().resource_dir().unwrap_or_default();
    let bundled = resource_dir.join("ffmpeg").join("bin").join(&bin_name);
    if bundled.exists() { return bundled.display().to_string(); }

    // 3. PATH fallback
    bin_name
}

fn presets_dir(app: &tauri::AppHandle) -> PathBuf {
    let cwd = std::env::current_dir().unwrap_or_default();
    let local = cwd.join("resources").join("ffmpeg").join("presets");
    if local.exists() { return local; }
    app.path().resource_dir().unwrap_or_default().join("ffmpeg").join("presets")
}

// ═══════════════ Tauri Commands ═══════════════

#[tauri::command]
async fn open_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let result = app.dialog()
        .file()
        .add_filter("Media Files", &["mp4","mkv","avi","mov","flv","webm","mp3","wav","flac","aac","ogg","m4a","jpg","jpeg","png","bmp","webp","gif","ts"])
        .blocking_pick_files();
    match result {
        Some(paths) => Ok(paths.iter().filter_map(|p| p.as_path().map(|pb| pb.to_string_lossy().to_string())).collect()),
        None => Ok(vec![]),
    }
}

#[tauri::command]
async fn open_folder(app: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let result = app.dialog().file().blocking_pick_folder();
    Ok(result.map(|p| p.as_path().map(|pb| pb.to_string_lossy().to_string()).unwrap_or_default()).unwrap_or_default())
}

#[tauri::command]
async fn probe_media(file_path: String, app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let ffprobe = ffmpeg_path("ffprobe", &app);
    let mut cmd = Command::new(ffprobe);
    hide_window(&mut cmd);
    let output = cmd
        .args(["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", &file_path])
        .output()
        .map_err(|e| format!("ffprobe 执行失败: {}", e))?;
    if !output.status.success() {
        return Err(format!("ffprobe 返回错误 ({:?})", output.status.code()));
    }
    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("解析失败: {}", e))?;
    Ok(json)
}

#[tauri::command]
async fn run_ffmpeg(app: tauri::AppHandle, state: State<'_, ProcMap>, args: Vec<String>) -> Result<String, String> {
    let ffmpeg = ffmpeg_path("ffmpeg", &app);
    let pid = Uuid::new_v4().to_string();

    let mut cmd = Command::new(ffmpeg);
    hide_window(&mut cmd);
    let mut child = cmd
        .args(["-y", "-progress", "pipe:1", "-nostats"])
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 FFmpeg 失败: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let pid_clone = pid.clone();
    let app_clone = app.clone();
    let procs = state.0.clone(); // Arc<Mutex<_>> 可 Clone

    // 先登记进程
    {
        let mut map = state.0.lock().unwrap();
        map.insert(pid.clone(), child);
    }

    // 后台线程读取输出，等待完成
    std::thread::spawn(move || {
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit("ffmpeg:log", serde_json::json!({ "pid": &pid_clone, "data": line }));
                if line.starts_with("out_time=") {
                    let _ = app_clone.emit("ffmpeg:progress", serde_json::json!({ "pid": &pid_clone, "time": &line[9..] }));
                }
            }
        }
        let err_reader = std::io::BufReader::new(stderr);
        for line in err_reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit("ffmpeg:log", serde_json::json!({ "pid": &pid_clone, "data": line }));
            }
        }

        // 等待进程退出，发出完成事件
        let success = if let Some(mut c) = procs.lock().unwrap().remove(&pid_clone) {
            let _ = c.wait();
            c.try_wait().map(|s| s.map(|x| x.success()).unwrap_or(false)).unwrap_or(false)
        } else { false };
        let _ = app_clone.emit("ffmpeg:complete", serde_json::json!({ "pid": &pid_clone, "success": success }));
    });

    Ok(pid)
}

#[tauri::command]
async fn cancel_ffmpeg(pid: String, state: State<'_, ProcMap>) -> Result<(), String> {
    let mut map = state.0.lock().unwrap();
    if let Some(mut child) = map.remove(&pid) {
        let _ = child.kill();
    }
    Ok(())
}

#[tauri::command]
async fn scan_folder(dir: String) -> Result<Vec<String>, String> {
    let media_ext = ["mp4","mkv","avi","mov","webm","mp3","wav","flac","aac","ogg","m4a","opus","jpg","jpeg","png","bmp","webp","gif"];
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for entry in entries.flatten() {
        let p = entry.path();
        if p.is_file() {
            if let Some(ext) = p.extension().and_then(|e| e.to_str()) {
                if media_ext.contains(&ext) {
                    files.push(p.display().to_string());
                }
            }
        }
    }
    Ok(files)
}

#[tauri::command]
async fn get_presets(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = presets_dir(&app);
    let entries = fs::read_dir(&dir).map_err(|_| "读取预设目录失败".to_string())?;
    let mut presets = Vec::new();
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".ffpreset") {
            presets.push(name);
        }
    }
    Ok(presets)
}

#[tauri::command]
async fn get_preset_content(name: String, app: tauri::AppHandle) -> Result<String, String> {
    let path = presets_dir(&app).join(&name);
    fs::read_to_string(&path).map_err(|e| format!("读取预设失败: {}", e))
}

#[tauri::command]
async fn toggle_fullscreen(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("窗口不存在")?;
    let is_full = window.is_fullscreen().unwrap_or(false);
    window.set_fullscreen(!is_full).map_err(|e| e.to_string())
}

#[tauri::command]
async fn shell_open(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let p = path.replace("/", "\\");
        let _ = Command::new("explorer").arg("/select,").arg(&p).spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        // macOS/Linux fallback
        let _ = path;
    }
    Ok(())
}

#[tauri::command]
async fn list_encoders(app: tauri::AppHandle) -> Result<String, String> {
    let ffmpeg = ffmpeg_path("ffmpeg", &app);
    let mut cmd = Command::new(ffmpeg);
    hide_window(&mut cmd);
    let output = cmd
        .args(["-encoders"])
        .output()
        .map_err(|e| format!("执行 ffmpeg -encoders 失败: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    Ok(format!("{}\n{}", stdout, stderr))
}

#[tauri::command]
async fn save_file(path: String, data: Vec<u8>) -> Result<(), String> {
    fs::write(&path, &data).map_err(|e| format!("写入文件失败: {}", e))?;
    Ok(())
}

// ═══════════════ Main ═══════════════

fn main() {
    let proc_map = ProcMap(Arc::new(Mutex::new(HashMap::new())));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(proc_map)
        .register_uri_scheme_protocol("localfile", |_app, request| {
            let uri = request.uri().to_string();
            let path_str = uri.strip_prefix("http://localfile.localhost/")
                .or_else(|| uri.strip_prefix("localfile://localhost/"))
                .or_else(|| uri.strip_prefix("localfile:///"))
                .unwrap_or("");
            let decoded = urlencoding::decode(path_str).unwrap_or_default().into_owned();
            let file_path = decoded.replace('/', "\\");
            
            match std::fs::read(&file_path) {
                Ok(data) => {
                    let mime = guess_mime(&file_path);
                    tauri::http::Response::builder()
                        .header("Content-Type", mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(data)
                        .unwrap()
                }
                Err(e) => {
                    tauri::http::Response::builder()
                        .status(404)
                        .body(format!("文件读取失败: {}", e).into_bytes())
                        .unwrap()
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_files,
            open_folder,
            probe_media,
            run_ffmpeg,
            cancel_ffmpeg,
            scan_folder,
            get_presets,
            get_preset_content,
            toggle_fullscreen,
            shell_open,
            list_encoders,
            save_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn guess_mime(path: &str) -> &'static str {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "mp4" => "video/mp4",
        "mkv" => "video/x-matroska",
        "avi" => "video/x-msvideo",
        "mov" => "video/quicktime",
        "flv" => "video/x-flv",
        "webm" => "video/webm",
        "wmv" => "video/x-ms-wmv",
        "ts" => "video/mp2t",
        "m4v" => "video/x-m4v",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "aac" => "audio/aac",
        "flac" => "audio/flac",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        "wma" => "audio/x-ms-wma",
        "opus" => "audio/opus",
        _ => "application/octet-stream",
    }
}

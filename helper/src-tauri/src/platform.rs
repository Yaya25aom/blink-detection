#[cfg(target_os = "macos")]
pub fn get_frontmost_app() -> Option<String> {
  use objc::{class, msg_send, sel, sel_impl};
  use objc::runtime::Object;

  unsafe {
    let workspace: *mut Object = msg_send![class!(NSWorkspace), sharedWorkspace];
    if workspace.is_null() {
      return None;
    }

    let app: *mut Object = msg_send![workspace, frontmostApplication];
    if app.is_null() {
      return None;
    }

    let name: *mut Object = msg_send![app, localizedName];
    ns_string_to_string(name)
  }
}

#[cfg(target_os = "macos")]
unsafe fn ns_string_to_string(ns_string: *mut objc::runtime::Object) -> Option<String> {
  use objc::{msg_send, sel, sel_impl};
  use std::ffi::CStr;

  if ns_string.is_null() {
    return None;
  }

  let utf8: *const std::os::raw::c_char = msg_send![ns_string, UTF8String];
  if utf8.is_null() {
    return None;
  }

  Some(CStr::from_ptr(utf8).to_string_lossy().into_owned())
}

#[cfg(target_os = "windows")]
pub fn get_frontmost_app() -> Option<String> {
  use std::mem::size_of;
  use windows::Win32::Foundation::{CloseHandle, HWND, MAX_PATH};
  use windows::Win32::System::ProcessStatus::K32GetModuleBaseNameW;
  use windows::Win32::System::Threading::{
    OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
  };
  use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

  unsafe {
    let hwnd: HWND = GetForegroundWindow();
    if hwnd.0 == 0 {
      return None;
    }

    let mut process_id = 0;
    GetWindowThreadProcessId(hwnd, Some(&mut process_id));

    if process_id == 0 {
      return None;
    }

    let process = OpenProcess(
      PROCESS_QUERY_INFORMATION | PROCESS_VM_READ,
      false,
      process_id,
    )
    .ok()?;

    let mut buffer = [0u16; MAX_PATH as usize];
    let len = K32GetModuleBaseNameW(
      process,
      None,
      &mut buffer,
    );

    let _ = CloseHandle(process);

    if len == 0 || len as usize > size_of::<[u16; MAX_PATH as usize]>() {
      return None;
    }

    Some(String::from_utf16_lossy(&buffer[..len as usize]))
  }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn get_frontmost_app() -> Option<String> {
  None
}

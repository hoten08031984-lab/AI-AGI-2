---
name: local-excel-dashboard
description: >
  Xây dựng một web dashboard phân tích dữ liệu cục bộ (localhost) dùng Python HTTP Server và file Excel làm nguồn dữ liệu.
  Áp dụng khi người dùng muốn: tạo dashboard từ file Excel, theo dõi dữ liệu nội bộ không cần Internet/Cloud,
  dashboard chạy được trên bất kỳ máy Windows nào, hoặc tự động cập nhật khi Excel thay đổi.
  Từ khoá trigger: "dashboard excel", "localhost dashboard", "web dashboard từ file excel",
  "phân tích chi phí", "dashboard nội bộ", "python server excel".
---

# Skill: Local Excel Dashboard

## Mục đích

Skill này hướng dẫn xây dựng một web dashboard phân tích dữ liệu theo mô hình:

```
File Excel (.xlsx) → Python Server → dashboard_data.js → HTML/JS/CSS → Trình duyệt
```

Dashboard chạy hoàn toàn **offline cục bộ** tại `http://localhost:8080`, không cần Internet, không cần Cloud.

---

## Kiến trúc chuẩn

### Các file bắt buộc

| File | Vai trò |
|---|---|
| `server.py` | Python HTTP Server + đọc Excel + sinh data cache |
| `index.html` | Giao diện Dashboard |
| `app.js` | Logic lọc, biểu đồ (Chart.js), bảng chi tiết |
| `index.css` | Thiết kế Dark Mode, glassmorphism |
| `dashboard_data.js` | Data cache (window.RAW_DATA), tự sinh từ server |
| `CAI_DAT_TU_DONG.bat` | Cài đặt 1-click cho máy tính mới |
| `start_server_silent.vbs` | Script chạy server ngầm không có cửa sổ CMD |
| `.gitignore` | Loại trừ file cache, pycache |

### Các file KHÔNG nên có

- File CSV/JSON trung gian không dùng trong code → xóa, thêm vào `.gitignore`
- Hardcoded path (`D:\AI AGI_2\...`) trong server.py → thay bằng `BASE_DIR`
- Version cố định cho script dữ liệu (`?v=1641`) → dùng `Date.now()` động

---

## Nguyên tắc bắt buộc khi code

### 1. Đường dẫn tương đối (Portable paths)

```python
# server.py — LUÔN dùng BASE_DIR thay vì hardcode
import os
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(BASE_DIR, "data.xlsx")
JS_DATA_PATH = os.path.join(BASE_DIR, "dashboard_data.js")
```

### 2. API Refresh bắt buộc

Server phải có endpoint `/api/refresh` để nút "Làm Mới" trên dashboard kích hoạt đọc lại Excel ngay lập tức:

```python
# server.py — AutoUpdateHandler.do_GET
def do_GET(self):
    if self.path.startswith('/api/refresh'):
        success = extract_excel_data(force=True)
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "ok", "success": success}).encode())
        return
    elif self.path in ('/', '/index.html') or self.path.startswith('/index.html'):
        extract_excel_data(force=True)
    return super().do_GET()
```

### 3. Chống Cache trình duyệt (Anti-Cache)

```html
<!-- index.html — Dùng timestamp động, KHÔNG dùng version cố định -->
<script>
  document.write('<script src="dashboard_data.js?v=' + Date.now() + '"><\/script>');
  document.write('<script src="app.js?v=' + Date.now() + '"><\/script>');
</script>
```

```python
# server.py — Header chống cache cho tất cả responses
def end_headers(self):
    self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    self.send_header('Pragma', 'no-cache')
    self.send_header('Expires', '0')
    super().end_headers()
```

### 4. Đọc Excel — Win32com với fallback openpyxl

```python
# server.py
def extract_excel_data(force=False):
    global last_mtime, last_check_time
    now = time.time()
    if not force and now - last_check_time < 2:
        return False

    # ... kiểm tra file tồn tại, mtime thay đổi ...

    try:
        import pythoncom, win32com.client as win32
        # Đọc qua COM (hỗ trợ computed cell values trong Excel)
        # ...
    except Exception as e_com:
        # Fallback: dùng openpyxl nếu không có win32com
        import openpyxl
        wb = openpyxl.load_workbook(excel_path, data_only=True)
        ws = wb['TEN_SHEET']
        vals = [list(row) for row in ws.iter_rows(values_only=True)]

    # Ghi ra dashboard_data.js
    with open(JS_DATA_PATH, 'w', encoding='utf-8') as f:
        f.write('window.SYNC_INFO = ' + json.dumps(sync_info) + ';\n')
        f.write('window.RAW_DATA = ' + json.dumps(data) + ';')
```

### 5. Nút Làm Mới trong app.js

```javascript
// app.js
document.getElementById('btn-refresh').addEventListener('click', async () => {
    const icon = document.getElementById('icon-refresh');
    if (icon) icon.classList.add('fa-spin');
    try {
        await fetch('/api/refresh?t=' + Date.now(), { cache: 'no-store' });
    } catch (e) {}
    window.location.href = window.location.pathname + '?t=' + Date.now();
});
```

---

## Cấu trúc Bảng Chi Tiết Chuẩn

- Ẩn các cột đã được lọc ở thanh bộ lọc phía trên (tránh trùng lặp).
- 9 cột hiển thị: `Tháng`, `Tiểu mục CP`, `Số HĐ`, `Ngày HĐ`, `Lý do thanh toán`, `Chi tiết HĐ`, `Số tiền chưa VAT`, `VAT`, `Số tiền VAT`.
- Bảng có `<tfoot>` với dòng **TỔNG CỘNG** tính tổng 3 cột số tiền trên toàn bộ dữ liệu đang lọc (không chỉ trang hiện tại).

```javascript
// Tính tổng toàn bộ filteredData, không phải chỉ pageItems
const totalStNoVat = filteredData.reduce((sum, item) => sum + (item.st_no_vat || 0), 0);
const totalVat = filteredData.reduce((sum, item) => sum + (item.vat || 0), 0);
const totalStVat = filteredData.reduce((sum, item) => sum + (item.st_vat || 0), 0);
```

---

## Tính Di Động (Portable) — Chạy Trên Bất Kỳ Máy Windows

### start_server_silent.vbs
```vbscript
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath
WshShell.Run "pythonw server.py", 0, False
```

### CAI_DAT_TU_DONG.bat
```batch
@echo off
set "TARGET_DIR=%~dp0"
if "%TARGET_DIR:~-1%"=="\" set "TARGET_DIR=%TARGET_DIR:~0,-1%"
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\start_dashboard_server.vbs"

echo Set WshShell = CreateObject("WScript.Shell") > "%STARTUP_VBS%"
echo WshShell.CurrentDirectory = "%TARGET_DIR%" >> "%STARTUP_VBS%"
echo WshShell.Run "pythonw server.py", 0, False >> "%STARTUP_VBS%"

wscript "%STARTUP_VBS%"
start "" "http://localhost:8080"
```

**Quy trình dùng trên máy tính mới:**
1. Copy toàn bộ thư mục dự án sang máy mới (bất kỳ đường dẫn nào).
2. Double-click `CAI_DAT_TU_DONG.bat` → chạy 1 lần duy nhất.
3. Từ đó, mỗi khi bật máy, Server tự khởi động ngầm.
4. Chỉ cần mở trình duyệt → `http://localhost:8080`.

---

## Quy trình Cập Nhật Dữ Liệu

1. Người dùng nhập/sửa dữ liệu trong file Excel → **Bấm Ctrl + S**.
2. Trên trang Dashboard → Bấm nút **"Làm Mới Dữ Liệu"** hoặc nhấn **F5**.
3. Server nhận request → gọi `extract_excel_data(force=True)` → đọc lại Excel → ghi `dashboard_data.js` mới.
4. Trang tải lại với dữ liệu mới nhất.

---

## Thiết kế UI Chuẩn (Dark Mode)

- Font: `Plus Jakarta Sans` từ Google Fonts
- Màu nền: `#0a0f1e` (Dark Navy)
- Glassmorphism: `backdrop-filter: blur(20px)`, `background: rgba(...)` với border mờ
- Badges neon màu Cyan, Blue, Purple, Emerald với `box-shadow` glow
- Chart.js với `backgroundColor` rgba, tooltip dark themed
- Header cố định, bảng có scroll ngang, `tfoot` sticky

## .gitignore Chuẩn

```
__pycache__/
*.pyc
*.pyo
.DS_Store
*.log
dashboard_data.json
CHI_data.csv
CHI_data.json
```

> **Ghi chú**: `dashboard_data.js` và file Excel NÊN commit lên git để khi clone/copy về máy mới đã có sẵn dữ liệu chạy ngay được.

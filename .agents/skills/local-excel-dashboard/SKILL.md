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

### 4. Đọc Excel — openpyxl TRƯỚC, win32com fallback

> **QUAN TRỌNG**: PHẢI thử `openpyxl` TRƯỚC, chỉ dùng `win32com` khi openpyxl thất bại
> (ví dụ file bị lock bởi Excel). Nếu đảo ngược thứ tự, server sẽ bị treo khi chạy
> từ `pythonw` (ẩn) vì COM cố mở Excel app trong nền → timeout/hang.

```python
# server.py
def extract_excel_data(force=False):
    global last_mtime, last_check_time
    now = time.time()
    if not force and now - last_check_time < 2:
        return False

    # ... kiểm tra file tồn tại, mtime thay đổi ...

    vals = None

    # === BƯỚC 1: Thử openpyxl trước (nhanh, không phụ thuộc COM) ===
    try:
        import openpyxl
        wb_ox = openpyxl.load_workbook(excel_path, data_only=True)
        ws_ox = wb_ox['TEN_SHEET']
        vals = [list(row) for row in ws_ox.iter_rows(values_only=True)]
        wb_ox.close()
    except Exception as e_ox:
        log.warning(f"openpyxl thất bại: {e_ox}, thử win32com...")

    # === BƯỚC 2: Chỉ dùng win32com nếu openpyxl thất bại ===
    if not vals:
        try:
            import pythoncom, win32com.client as win32
            # Đọc qua COM (hỗ trợ file bị lock / computed cells)
            # ...
        except ImportError:
            log.info("win32com không khả dụng, bỏ qua.")
        except Exception as e_com:
            log.error(f"win32com cũng thất bại: {e_com}")

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

> **QUAN TRỌNG**: PHẢI dùng đường dẫn tuyệt đối cho `server.py`.
> Nếu chỉ ghi `"pythonw server.py"`, khi Windows khởi động,
> thư mục làm việc có thể khác → server không tìm thấy file.

```vbscript
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath
serverScript = fso.BuildPath(strPath, "server.py")
WshShell.Run """pythonw.exe"" """ & serverScript & """", 0, False
```

### CAI_DAT_TU_DONG.bat

> **QUAN TRỌNG**:
> - PHẢI có `setlocal EnableDelayedExpansion` nếu dùng `!variable!` trong vòng lặp for.
> - PHẢI tìm đường dẫn tuyệt đối `pythonw.exe` (dùng `where`) rồi ghi vào VBS.
> - PHẢI kill server cũ trên port trước khi khởi động server mới.
> - PHẢI đợi server thực sự sẵn sàng (poll HTTP) thay vì đợi mù vài giây.

```batch
@echo off
setlocal EnableDelayedExpansion
set "TARGET_DIR=%~dp0"
if "%TARGET_DIR:~-1%"=="\" set "TARGET_DIR=%TARGET_DIR:~0,-1%"

REM --- Tim duong dan tuyet doi toi pythonw.exe ---
set "PYTHONW_PATH="
for /f "delims=" %%i in ('where pythonw.exe 2^>nul') do (
    if not defined PYTHONW_PATH set "PYTHONW_PATH=%%i"
)
if not defined PYTHONW_PATH (
    echo [LOI] Khong tim thay pythonw.exe!
    pause & exit /b 1
)

REM --- Tat server cu tren port 8080 ---
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM --- Tao VBS Startup (dung duong dan tuyet doi) ---
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\start_dashboard_server.vbs"
echo Set WshShell = CreateObject("WScript.Shell") > "%STARTUP_VBS%"
echo WshShell.CurrentDirectory = "%TARGET_DIR%" >> "%STARTUP_VBS%"
echo WshShell.Run """%PYTHONW_PATH%"" ""%TARGET_DIR%\server.py""", 0, False >> "%STARTUP_VBS%"

REM --- Khoi dong server va doi san sang ---
start "" /B "%PYTHONW_PATH%" "%TARGET_DIR%\server.py"
set READY=0
for /L %%i in (1,1,15) do (
    if !READY! equ 0 (
        ping -n 2 127.0.0.1 >nul
        powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://localhost:8080' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
        if !errorlevel! equ 0 set READY=1
    )
)
if !READY! equ 1 ( start "" "http://localhost:8080" )
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

---

## ⚠️ Các Lỗi Đã Gặp & Bài Học Kinh Nghiệm

Phần này ghi lại các lỗi nghiêm trọng đã gặp trong thực tế. **PHẢI đọc kỹ trước khi tạo mới hoặc sửa dashboard.**

### Lỗi 1: Server bị treo khi dùng win32com trước openpyxl

**Triệu chứng**: Chạy `CAI_DAT_TU_DONG.bat` thành công, nhưng trình duyệt mở ra báo `ERR_CONNECTION_REFUSED`. Server chạy ngầm bằng `pythonw` nên không thấy lỗi gì.

**Nguyên nhân**: Code cũ thử `win32com` TRƯỚC → COM cố mở Excel application trong nền → bị treo/timeout khi:
- Excel chưa được mở trên máy
- Chạy từ `pythonw` (ẩn, không có console)
- Windows vừa khởi động, COM chưa sẵn sàng

**Sửa**: ĐẢO NGƯỢC THỨ TỰ → `openpyxl` trước (nhanh, không phụ thuộc COM), chỉ dùng `win32com` khi openpyxl thất bại (file bị lock).

---

### Lỗi 2: NameError crash do biến chưa khai báo trong finally block

**Triệu chứng**: Server crash ngay khi khởi động, không có thông báo lỗi.

**Nguyên nhân**: `finally` block ở cuối `extract_excel_data()` tham chiếu biến `wb` và `excel` (từ nhánh win32com), nhưng khi code đi qua nhánh `openpyxl`, các biến này chưa được khai báo → `NameError`.

```python
# SAI - biến wb/excel chỉ tồn tại trong nhánh win32com
finally:
    if wb:       # NameError nếu đi qua nhánh openpyxl!
        wb.Close(False)
    if excel:    # NameError!
        excel.Quit()
```

**Sửa**: Dọn dẹp COM objects ngay trong block win32com, không để ở `finally` bên ngoài. Chỉ giữ `extract_lock.release()` trong `finally`.

---

### Lỗi 3: Port 8080 bị chiếm bởi server cũ

**Triệu chứng**: Chạy bat lần 2 → server mới crash `Address already in use` (OSError) → trình duyệt thấy `ERR_CONNECTION_REFUSED` (vì server cũ cũng có thể đã chết).

**Sửa**:
- **server.py**: Thêm hàm `kill_old_server_on_port(port)` chạy `netstat + taskkill` trước khi bind port.
- **bat file**: Thêm bước kill process cũ trên port 8080 trước khi khởi động.
- **server.py**: Wrap `TCPServer` trong `try/except OSError` để báo lỗi rõ ràng thay vì crash âm thầm.

---

### Lỗi 4: pythonw nuốt mọi lỗi (silent crash)

**Triệu chứng**: Server chết nhưng không có bất kỳ thông tin lỗi nào. Không biết debug từ đâu.

**Nguyên nhân**: `pythonw.exe` không có console → `print()` không hiển thị, exception traceback cũng mất.

**Sửa**: PHẢI thêm `logging` ghi ra file `server.log`:
```python
import logging
LOG_PATH = os.path.join(BASE_DIR, 'server.log')
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_PATH, encoding='utf-8', mode='w'),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger('dashboard')
```

---

### Lỗi 5: Bat file thiếu EnableDelayedExpansion

**Triệu chứng**: Biến `!READY!` trong vòng lặp `for /L` luôn bằng 0, bat không đợi server → mở trình duyệt quá sớm.

**Nguyên nhân**: Dùng cú pháp `!variable!` (delayed expansion) nhưng thiếu `setlocal EnableDelayedExpansion` ở đầu bat file.

**Sửa**: LUÔN thêm `setlocal EnableDelayedExpansion` ngay sau `@echo off` khi bat file có vòng lặp cần đọc biến thay đổi.

---

### Lỗi 6: VBS Startup dùng đường dẫn tương đối

**Triệu chứng**: Dashboard hoạt động khi chạy bat thủ công, nhưng khi Windows khởi động lại thì server không chạy.

**Nguyên nhân**: VBS ghi `WshShell.Run "pythonw server.py"` → khi Windows chạy VBS từ Startup folder, `pythonw` và `server.py` không có đường dẫn đầy đủ.

**Sửa**: PHẢI ghi đường dẫn tuyệt đối cho cả `pythonw.exe` và `server.py` vào VBS:
```batch
echo WshShell.Run """%PYTHONW_PATH%"" ""%TARGET_DIR%\server.py""", 0, False >> "%STARTUP_VBS%"
```

---

### Lỗi 8: Server HTTP bị block do đọc Excel đồng bộ lúc startup

**Triệu chứng**: Chạy script mở trình duyệt ngay nhưng nhận lỗi `ERR_CONNECTION_REFUSED` trong 10-15 giây đầu.

**Nguyên nhân**: Hàm `extract_excel_data()` được gọi đồng bộ (blocking) trước lệnh `socketserver.TCPServer()`. Khi `win32com` gặp sự cố hoãn (retry), toàn bộ HTTP Server chưa kịp mở port 8080 để lắng nghe kết nối.

**Sửa**: Đưa lệnh đọc Excel lúc khởi động vào luồng phụ (`threading.Thread`) hoặc dùng dữ liệu đã cache (`dashboard_data.js`) để server mở port 8080 lập tức ngay khi bật:

```python
# Cho đọc Excel trong background thread lúc khởi động
def bg_extract():
    try:
        extract_excel_data()
    except Exception as e:
        log.warning(f"Không thể đọc Excel lúc khởi động: {e}")

threading.Thread(target=bg_extract, daemon=True).start()

# Server lắng nghe ngay lập tức
with socketserver.TCPServer(("", PORT), AutoUpdateHandler) as httpd:
    httpd.serve_forever()
```

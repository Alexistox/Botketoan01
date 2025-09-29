# Hành vi Xử lý Số Đơn giản

Bot đã được cải tiến để **không tính toán** các số đơn giản mà chỉ hiển thị chúng.

## ✅ Số Đơn giản (Không tính toán)

Bot sẽ **KHÔNG** tính toán và chỉ hiển thị các số sau:

### Số thông thường:
- `123` → Chỉ hiển thị, không tính toán
- `123.45` → Chỉ hiển thị, không tính toán
- `-123.45` → Chỉ hiển thị, không tính toán

### Số với ký hiệu đặc biệt:
- `12w` → Chỉ hiển thị, không tính toán
- `545w` → Chỉ hiển thị, không tính toán
- `1m` → Chỉ hiển thị, không tính toán
- `2k` → Chỉ hiển thị, không tính toán
- `3万` → Chỉ hiển thị, không tính toán
- `1个亿` → Chỉ hiển thị, không tính toán
- `1y` → Chỉ hiển thị, không tính toán

### Số ghép đơn giản:
- `12w5` → Chỉ hiển thị, không tính toán
- `1m2` → Chỉ hiển thị, không tính toán
- `3万4` → Chỉ hiển thị, không tính toán
- `1个亿2` → Chỉ hiển thị, không tính toán
- `1y3` → Chỉ hiển thị, không tính toán

## 🔢 Biểu thức Toán học (Có tính toán)

Bot sẽ **TÍNH TOÁN** các biểu thức sau:

- `12w+5` → Tính toán: 120,000 + 5 = 120,005
- `1m*2` → Tính toán: 1,000,000 × 2 = 2,000,000
- `3万-1万` → Tính toán: 30,000 - 10,000 = 20,000
- `1个亿+2个亿` → Tính toán: 100,000,000 + 200,000,000 = 300,000,000
- `1y/2` → Tính toán: 100,000,000 ÷ 2 = 50,000,000
- `12w+545w` → Tính toán: 120,000 + 545,000 = 665,000
- `1+2` → Tính toán: 1 + 2 = 3
- `1.5+2.5` → Tính toán: 1.5 + 2.5 = 4

## 🎯 Logic Phân biệt

Bot sử dụng logic thông minh để phân biệt:

1. **Số đơn giản**: Chỉ chứa số và ký hiệu đặc biệt, không có phép toán (`+`, `-`, `*`, `/`)
2. **Biểu thức toán học**: Chứa ít nhất một phép toán hoặc nhiều số được kết hợp

## 📝 Ví dụ Thực tế

```
Người dùng: 12w
Bot: (Không phản hồi - chỉ hiển thị)

Người dùng: 545w  
Bot: (Không phản hồi - chỉ hiển thị)

Người dùng: 12w+5
Bot: 12w+5 = 120005

Người dùng: 545w*2
Bot: 545w*2 = 1090000
```

## 🔧 Cải tiến

- Bot giờ đây thông minh hơn trong việc phân biệt số đơn giản và biểu thức toán học
- Tránh tính toán không cần thiết cho các số đơn giản
- Vẫn hỗ trợ đầy đủ các phép toán phức tạp khi cần thiết

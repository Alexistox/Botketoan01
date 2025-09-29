# Hỗ trợ Định dạng Số Đa Quốc Gia

Bot đã được cải tiến để hỗ trợ các định dạng số của các nước khác nhau trong cùng một biểu thức toán học.

## Các Định dạng Được Hỗ trợ

### 1. Định dạng Mỹ (US Format)
- **Phân cách hàng nghìn**: dấu phẩy (`,`)
- **Phân cách thập phân**: dấu chấm (`.`)
- **Ví dụ**: `1,234,567.89`, `2,765,566`, `1,000,000.50`

### 2. Định dạng Châu Âu (EU Format)
- **Phân cách hàng nghìn**: dấu chấm (`.`)
- **Phân cách thập phân**: dấu phẩy (`,`)
- **Ví dụ**: `1.234.567,89`, `3.454.635`, `1.000.000,50`

### 3. Định dạng Hỗn hợp (Mixed Format)
Bot có thể xử lý các biểu thức chứa cả hai định dạng trong cùng một phép tính:

```
2,765,566 + 3.454.635 = 6,220,201
1,000,000.50 + 2.000.000,75 = 3,000,001.25
5,000,000 - 1.500.000 = 3,500,000
1,000,000 * 1.5 + 2.000.000,50 = 9,500,000.5
10,000,000 / 2.5 - 1.000.000,25 = 2,999,999.75
```

## Cách Sử dụng

Chỉ cần gửi biểu thức toán học với các định dạng số khác nhau, bot sẽ tự động:
1. Phân biệt định dạng của từng số
2. Chuẩn hóa về định dạng chuẩn
3. Thực hiện phép tính
4. Trả về kết quả chính xác

## Ví dụ Thực tế

```
Người dùng: 2,765,566+3.454.635
Bot: 2,765,566+3.454.635 = 6220201

Người dùng: 1,000,000.50+2.000.000,75-500.000,25
Bot: 1,000,000.50+2.000.000,75-500.000,25 = 2500001

Người dùng: 5,000,000*1.5+2.000.000,50
Bot: 5,000,000*1.5+2.000.000,50 = 9500000.5
```

## Lưu ý

- Bot tự động nhận diện định dạng dựa trên vị trí và số lượng dấu phân cách
- Hỗ trợ tất cả các phép toán cơ bản: `+`, `-`, `*`, `/`
- Có thể kết hợp với các ký hiệu đặc biệt như `k`, `m`, `w`, `万`, `个亿`

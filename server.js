const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// ฐานข้อมูลจำลอง (บันทึกชั่วคราวขณะเปิดเซิร์ฟเวอร์)
const ordersDB = [];

// ตั้งค่าอีเมลร้านค้า (แนะนำให้ใช้ Gmail)
// *** ตอนนี้ใส่ไว้แบบจำลองก่อน ถ้าอยากส่งจริงค่อยมาใส่ Email กับ App Password ทีหลังได้ครับ ***
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your_email@gmail.com', 
        pass: 'your_app_password'     
    }
});

// 1. ระบบรับคำสั่งซื้อ (เมื่อลูกค้ากด Checkout)
app.post('/checkout', (req, res) => {
    const { orderId, name, phone, email, address, payment, items, total } = req.body;

    // สร้างข้อมูลคำสั่งซื้อ
    const newOrder = {
        orderId, name, phone, email, address, payment, items, total,
        status: 'กำลังจัดเตรียมสินค้า', // สถานะเริ่มต้น
        date: new Date().toLocaleString('vi-VN')
    };

    // บันทึกลงฐานข้อมูลจำลอง
    ordersDB.push(newOrder);
    
    console.log(`[เซิร์ฟเวอร์] ได้รับคำสั่งซื้อใหม่จากคุณ: ${name} (อีเมล: ${email})`);

    // ส่งข้อความกลับไปบอกหน้าเว็บว่า "สำเร็จ!"
    res.status(200).json({ success: true, message: 'สั่งซื้อสำเร็จและบันทึกข้อมูลแล้ว' });
});

// 2. ระบบดึงประวัติการสั่งซื้อ (สำหรับหน้า my-orders.html)
app.post('/my-orders', (req, res) => {
    const { email } = req.body;
    
    // ค้นหาคำสั่งซื้อทั้งหมดที่ตรงกับอีเมลลูกค้า
    const userOrders = ordersDB.filter(order => order.email === email);
    
    // ส่งข้อมูลกลับไปให้หน้าเว็บ
    res.json(userOrders);
});

// เปิดรันเซิร์ฟเวอร์ที่ Port 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Backend Server รันสำเร็จแล้ว! กำลังทำงานอยู่ที่ http://localhost:${PORT}`);
});
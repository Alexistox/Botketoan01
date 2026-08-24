require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const NodeCache = require('node-cache');

// Import controllers và utils
const { handleMessage } = require('./controllers/messageController');
const { handleInlineButtonCallback } = require('./controllers/userCommands');
const { connectDB } = require('./config/db');

// Khởi tạo cache
const cache = new NodeCache({ stdTTL: 21600 }); // Cache in 6 hours

// Khởi tạo ứng dụng Express
const app = express();
app.use(express.json());

// Kết nối MongoDB
connectDB();

// Khởi tạo Telegram Bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Xử lý tin nhắn
bot.on('message', async (msg) => {
  try {
    await handleMessage(bot, msg, cache);
  } catch (error) {
    console.error('Error handling message:', error);
    bot.sendMessage(msg.chat.id, "处理消息时出错。请稍后再试。");
  }
});

// Xử lý callback query từ inline keyboard
bot.on('callback_query', async (callbackQuery) => {
  try {
    await handleInlineButtonCallback(bot, callbackQuery);
  } catch (error) {
    console.error('Error handling callback query:', error);
  }
});

// Webhook for Telegram
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Import và sử dụng report routes + message logs dashboard
const reportRoutes = require('./routes/reportRoutes');
const messageLogRoutes = require('./routes/messageLogRoutes');
app.use('/', reportRoutes);
app.use('/', messageLogRoutes);

// Route trang chủ
app.get('/', (req, res) => {
  res.send('Bot is running');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Bot started polling for updates');
});

// Xử lý lỗi không bắt được
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

module.exports = { bot };

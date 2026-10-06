# TashFix v2 — backend + Telegram-бот

Один Node-процесс: Express API + Telegraf (long polling) + MongoDB.

## Запуск
1. `cp .env.example .env` — заполнить BOT_TOKEN (@BotFather), MONGODB_URI (Atlas), JWT_SECRET
   (длинная случайная строка: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`)
2. `npm install`
3. Создать админа: `npm run create-admin -- admin МойПароль123`
4. `npm run dev` (или `pm2 start ecosystem.config.js` на сервере)

## API (всё, кроме /auth/login, требует `Authorization: Bearer <token>`)
| Метод | Путь | Описание |
|---|---|---|
| POST | /api/auth/login | { username, password } → { token } |
| GET | /api/problems?district=&status= | список, по числу подтверждений |
| GET | /api/problems/:id | карточка + statusHistory |
| PATCH | /api/problems/:id/status | { status, note } → смена + рассылка жителям |
| GET | /api/problems/:id/photo | байты фото (грузить через fetch с токеном → blob) |
| GET | /api/stats | { total, active, review, resolved } |

Коды районов: almazar, bektemir, mirabad, mirzo_ulugbek, sergeli, uchtepa, chilanzar,
shaykhontohur, yunusabad, yakkasaray, yashnabad, yangihayot.

## Деплой
VPS + pm2 + nginx: `location /api { proxy_pass http://127.0.0.1:3000; }`, статику панели отдаёт nginx.
Бот работает в том же процессе, отдельного порта не нужно.

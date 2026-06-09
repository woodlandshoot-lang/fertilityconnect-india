# 🌸 FertilityConnect India

> India's Most Trusted IVF Platform — Connecting Patients with Verified Fertility Hospitals

---

## 🏗️ Architecture

```
fertilityconnect/
├── apps/
│   ├── api/                 ← Node.js + Express Backend
│   │   ├── src/
│   │   │   ├── config/      ← DB + ENV config
│   │   │   ├── middleware/  ← Auth, RBAC, KYC Guard
│   │   │   ├── routes/      ← All API routes
│   │   │   ├── controllers/ ← Business logic
│   │   │   ├── services/    ← Razorpay, Notifications, Cron
│   │   │   └── utils/       ← JWT, OTP, Encryption, Validators
│   │   └── migrations/      ← PostgreSQL schema + seed
│   └── web/
│       └── js/              ← Frontend API client modules
├── Dockerfile               ← Production container
├── docker-compose.yml       ← Local dev stack
├── nginx.conf               ← Reverse proxy config
├── railway.toml             ← Railway deployment
├── .github/workflows/       ← CI/CD pipeline
├── DEPLOYMENT.md            ← Full deployment guide
└── generate-env.sh          ← Secure ENV generator
```

---

## 🚀 Quick Start (Local)

```bash
# 1. Clone
git clone https://github.com/your-org/fertilityconnect-india.git
cd fertilityconnect-india

# 2. Start with Docker
docker-compose up -d

# 3. Run migrations
docker-compose exec api node migrations/run.js

# 4. Seed data
docker-compose exec api node migrations/seed.js

# 5. Open
# API:     http://localhost:4000/health
# pgAdmin: http://localhost:5050
```

### Manual Setup (without Docker)

```bash
# Install Node.js 20 + PostgreSQL 15

cd apps/api
cp .env.example .env
# Edit .env with your values

npm install
node migrations/run.js
node migrations/seed.js
npm run dev

# API running at: http://localhost:4000
```

---

## 📋 API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register patient or hospital |
| POST | `/api/auth/login` | Login with phone/password |
| POST | `/api/auth/otp/send` | Send OTP to phone |
| POST | `/api/auth/otp/verify` | Verify OTP (OTP login) |
| POST | `/api/auth/refresh` | Refresh access token |
| GET  | `/api/auth/me` | Get my profile |
| POST | `/api/auth/logout` | Logout |

### Hospitals (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hospitals` | List + filter hospitals |
| GET | `/api/hospitals/search?q=` | Full-text search |
| GET | `/api/hospitals/city/:city` | City SEO page |
| GET | `/api/hospitals/:slug` | Hospital profile |

### Leads
| Method | Endpoint | Role |
|--------|----------|------|
| POST | `/api/leads` | Patient — submit request |
| GET | `/api/leads/my` | Patient — my requests |
| GET | `/api/leads/available` | Hospital — browse leads |
| POST | `/api/leads/:id/unlock` | Hospital — unlock lead |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/payments/plans` | Subscription plans |
| POST | `/api/payments/subscription` | Create sub order |
| POST | `/api/payments/lead-unlock` | Create unlock order |
| POST | `/api/payments/verify` | Verify Razorpay payment |
| POST | `/api/payments/webhook` | Razorpay webhook |

---

## 🔑 Test Credentials (after seed)

| Role | Phone/Email | Password |
|------|-------------|----------|
| Admin | admin@fertilityconnect.in | Admin@123456 |
| Hospital | nova@example.com | Hospital@123 |
| Patient | priya@example.com | Patient@123 |

---

## 🛡️ Security Features

- ✅ JWT access tokens (15 min) + Refresh tokens (30 days)
- ✅ OTP via SMS (Twilio) — rate limited
- ✅ AES-256 encryption for patient private data
- ✅ bcrypt password hashing (12 rounds)
- ✅ RBAC middleware (client/hospital/admin)
- ✅ KYC guard — hospitals blocked until verified
- ✅ Razorpay HMAC signature verification
- ✅ Helmet.js security headers
- ✅ Rate limiting (100/15min global, 10/15min auth)

---

## 💰 Monetization

| Revenue Stream | Amount |
|---------------|--------|
| Basic Plan | ₹2,999/month |
| Pro Plan | ₹7,999/month |
| Premium Plan | ₹14,999/month |
| Lead Unlock (budget <₹1L) | ₹299 |
| Lead Unlock (budget ₹1-2L) | ₹499 |
| Lead Unlock (budget >₹2L) | ₹699 |

---

## 📦 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS + HTML (no framework) |
| Backend | Node.js 20 + Express 4 |
| Database | PostgreSQL 15 |
| Auth | JWT + bcrypt + OTP |
| Payments | Razorpay |
| SMS | Twilio |
| Email | SendGrid |
| Encryption | AES-256-CBC (crypto-js) |
| Deployment | Railway + Vercel |
| CI/CD | GitHub Actions |

---

## 📄 License

MIT © FertilityConnect India 2025

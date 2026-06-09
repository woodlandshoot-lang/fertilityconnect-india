# 🚀 FertilityConnect India — Deployment Guide

## Architecture

```
                    ┌─────────────────────────────────┐
                    │         PRODUCTION STACK         │
                    └─────────────────────────────────┘

  Browser / Mobile
        │
        ▼
  ┌──────────────┐          ┌────────────────────┐
  │   Vercel     │          │     Railway        │
  │  (Frontend)  │ ─────▶   │   (Node.js API)    │
  │  Static HTML │  API     │   Port 4000        │
  └──────────────┘  calls   └────────────────────┘
                                     │
                            ┌────────┴────────┐
                            ▼                 ▼
                    ┌──────────────┐  ┌─────────────┐
                    │  Neon.tech   │  │  Cloudinary │
                    │ (PostgreSQL) │  │   (Media)   │
                    └──────────────┘  └─────────────┘
```

---

## OPTION A — Railway (Recommended, Easiest)

### Step 1: PostgreSQL Database Setup (Neon.tech — Free)

1. Go to → https://neon.tech and sign up
2. Create new project → `fertilityconnect-india`
3. Select region → `ap-south-1` (Mumbai)
4. Copy the **Connection String**:
   ```
   postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
5. Save this as your `DATABASE_URL`

---

### Step 2: Deploy API to Railway

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create new project
railway new fertilityconnect

# 4. Link to your project
railway link

# 5. Set all environment variables
railway variables set \
  NODE_ENV=production \
  PORT=4000 \
  DATABASE_URL="postgresql://..." \
  JWT_SECRET="$(openssl rand -hex 32)" \
  JWT_REFRESH_SECRET="$(openssl rand -hex 32)" \
  ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  RAZORPAY_KEY_ID="rzp_live_xxxx" \
  RAZORPAY_KEY_SECRET="xxxx" \
  RAZORPAY_WEBHOOK_SECRET="xxxx" \
  TWILIO_ACCOUNT_SID="ACxxx" \
  TWILIO_AUTH_TOKEN="xxx" \
  TWILIO_PHONE="+1xxxxxxxxxx" \
  SENDGRID_API_KEY="SG.xxx" \
  SENDGRID_FROM_EMAIL="noreply@fertilityconnect.in" \
  FRONTEND_URL="https://fertilityconnect.in"

# 6. Deploy
railway up

# 7. Run database migrations
railway run node migrations/run.js

# 8. Seed initial data (admin user + sample hospital)
railway run node migrations/seed.js

# 9. Get your API URL
railway open
# Your API is live at: https://fertilityconnect-api.up.railway.app
```

---

### Step 3: Deploy Frontend to Vercel

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. In your project root
vercel

# Follow prompts:
#   Set up and deploy? → Y
#   Which scope? → your account
#   Link to existing project? → N
#   Project name → fertilityconnect-india
#   Directory → ./  (root)
#   Override settings? → N

# 3. After deploy completes, update API_BASE in HTML
# Edit FertilityConnectIndia.html:
#   const API_BASE = 'https://fertilityconnect-api.up.railway.app/api';

# 4. Redeploy with updated URL
vercel --prod
```

---

## OPTION B — VPS (DigitalOcean / AWS EC2)

### Step 1: Server Setup

```bash
# Connect to your VPS
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Nginx
apt install -y nginx

# Install PM2 (process manager)
npm install -g pm2

# Install Certbot (SSL)
apt install -y certbot python3-certbot-nginx
```

### Step 2: PostgreSQL Setup

```bash
# Switch to postgres user
su - postgres

# Create database and user
psql << SQL
CREATE DATABASE fertilityconnect;
CREATE USER fcuser WITH PASSWORD 'StrongPassword123!';
GRANT ALL PRIVILEGES ON DATABASE fertilityconnect TO fcuser;
\q
SQL

exit
```

### Step 3: Clone and Configure

```bash
# Clone your repo
cd /var/www
git clone https://github.com/your-org/fertilityconnect-india.git
cd fertilityconnect-india/apps/api

# Install dependencies
npm install --production

# Create .env file
cp .env.example .env
nano .env
# Fill in all values

# Run migrations
node migrations/run.js
node migrations/seed.js
```

### Step 4: PM2 Process Manager

```bash
# Start API with PM2
pm2 start src/index.js \
  --name "fertilityconnect-api" \
  --instances 2 \
  --exec-mode cluster

# Save PM2 config (auto-restart on reboot)
pm2 save
pm2 startup

# Monitor
pm2 status
pm2 logs fertilityconnect-api
```

### Step 5: Nginx + SSL

```bash
# Copy nginx config
cp /var/www/fertilityconnect-india/nginx.conf /etc/nginx/nginx.conf

# Test config
nginx -t

# Get SSL certificate
certbot --nginx -d fertilityconnect.in -d api.fertilityconnect.in

# Start nginx
systemctl enable nginx
systemctl start nginx
```

---

## OPTION C — Docker Compose

```bash
# Clone repo
git clone https://github.com/your-org/fertilityconnect-india.git
cd fertilityconnect-india

# Start all services (API + PostgreSQL + pgAdmin)
docker-compose up -d

# Wait for postgres to be ready, then run migrations
docker-compose exec api node migrations/run.js
docker-compose exec api node migrations/seed.js

# Check status
docker-compose ps

# View logs
docker-compose logs -f api

# Services:
#   API     → http://localhost:4000
#   pgAdmin → http://localhost:5050 (admin@fertilityconnect.in / admin123)
```

---

## Razorpay Setup

### 1. Create Account
- Go to → https://razorpay.com
- Sign up as a business
- Complete KYC (business registration, bank account)

### 2. Get API Keys
```
Dashboard → Settings → API Keys → Generate Test Key

RAZORPAY_KEY_ID     = rzp_test_xxxxxxxxxx
RAZORPAY_KEY_SECRET = xxxxxxxxxxxxxxxxxx
```

### 3. Configure Webhook
```
Dashboard → Settings → Webhooks → Add New Webhook

URL: https://api.fertilityconnect.in/api/payments/webhook
Secret: (generate a random string, save as RAZORPAY_WEBHOOK_SECRET)

Events to enable:
  ✅ payment.captured
  ✅ payment.failed
  ✅ subscription.activated
  ✅ subscription.halted
  ✅ subscription.cancelled
```

### 4. Go Live
```
Complete business KYC → Activate live mode
Replace rzp_test_ keys with rzp_live_ keys
```

---

## Twilio Setup (SMS/OTP)

```bash
# 1. Sign up → https://twilio.com
# 2. Get free trial number (+1 number)
# 3. Copy credentials:

TWILIO_ACCOUNT_SID = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN  = xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE       = +1xxxxxxxxxx

# For India SMS — buy an Indian Virtual Number or use International
# Approximate cost: ₹0.50 per SMS
```

---

## SendGrid Setup (Email)

```bash
# 1. Sign up → https://sendgrid.com (100 emails/day free)
# 2. Create API Key → Settings → API Keys → Create
# 3. Verify sender domain (add DNS records)

SENDGRID_API_KEY    = SG.xxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL = noreply@fertilityconnect.in
```

---

## Domain Setup

### DNS Records (add at your domain registrar)

```
Type   Name    Value                              TTL
A      @       your-server-ip or vercel-ip        300
A      api     your-api-server-ip                 300
CNAME  www     fertilityconnect.in               300

# For SendGrid email verification:
CNAME  em123   u1234567.wl.sendgrid.net           300
CNAME  s1._domainkey  s1.domainkey.u1234567...    300
```

---

## Environment Variables Checklist

```bash
# ✅ Required (app won't start without these)
DATABASE_URL            ← Neon.tech or self-hosted PostgreSQL
JWT_SECRET              ← Min 32 chars random string
JWT_REFRESH_SECRET      ← Min 32 chars random string
ENCRYPTION_KEY          ← Exactly 32 chars (for AES-256)

# ✅ Required for payments
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET

# ⚡ Required for SMS (OTP)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE

# 📧 Required for emails
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL

# ℹ️ Optional but recommended
FRONTEND_URL            ← Your frontend URL for CORS
ADMIN_EMAIL             ← First admin account email
ADMIN_PASSWORD          ← First admin account password
```

---

## Post-Deployment Checklist

```
□ API health check:   curl https://api.fertilityconnect.in/health
□ Database migration: node migrations/run.js (ran successfully)
□ Seed data:          node migrations/seed.js (admin user created)
□ Register a patient: POST /api/auth/register
□ Register a hospital: POST /api/auth/register (role: hospital)
□ KYC approval: Admin panel → approve hospital
□ Submit a lead: POST /api/leads (as patient)
□ Unlock lead: POST /api/payments/lead-unlock (as hospital)
□ Razorpay webhook: test with ngrok locally
□ SMS OTP: verify Twilio sends to Indian numbers
□ Email: verify SendGrid sends welcome email
□ SSL certificate: https:// shows green padlock
□ CORS: frontend can call API without errors
```

---

## Monitoring & Logs

```bash
# Railway
railway logs --tail

# PM2
pm2 logs fertilityconnect-api
pm2 monit

# Docker
docker-compose logs -f api

# PostgreSQL slow queries
psql $DATABASE_URL -c "SELECT query, calls, total_time FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"
```

---

## Backup Strategy

```bash
# Daily PostgreSQL backup (add to cron)
# crontab -e
0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/fc_$(date +%Y%m%d).sql.gz

# Keep last 30 days
find /backups -name "fc_*.sql.gz" -mtime +30 -delete
```

---

## Estimated Monthly Costs (Production)

| Service | Plan | Cost |
|---------|------|------|
| Railway (API) | Starter | ~$5/mo |
| Neon.tech (DB) | Free tier | Free |
| Vercel (Frontend) | Hobby | Free |
| Twilio (SMS) | Pay-as-you-go | ~₹0.50/SMS |
| SendGrid (Email) | Free | 100/day free |
| Domain (.in) | Annual | ~₹800/yr |
| **Total** | | **~$5–10/mo** |

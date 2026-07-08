# MedDecode AI 🩺🤖

MedDecode AI is a premium, accessibility-first web application designed to translate complex medical documents—such as doctor handwritten prescriptions, blood panels, lab reports, diagnostic scans (Ultrasound, ECG, X-Ray), and hospital bills—into clear, patient-friendly, plain English explanations.

It also features a professional **Clinical Medical mode** for healthcare practitioners and an intelligent **AI Copilot** to answer follow-up questions about the patient's reports.

---

## 🚀 Tech Stack

- **Frontend:** React, TypeScript, Vite, TanStack Router (Typesafe Routing), TailwindCSS
- **Backend & Database:** Supabase (PostgreSQL Database, Storage Buckets, Auth, Serverless Deno Edge Functions)
- **AI Engine:** Google Gemini (multimodal parsing with fallback redundancy)
- **OCR Engine:** OCR.space (configured with specialized handwriting recognition)
- **Monitoring:** Sentry (real-time error and performance tracking)

---

## 🔑 Environment Configuration

Create a `.env` file inside the `frontend/` directory with the following keys:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anonymous-key
VITE_SENTRY_DSN=your-sentry-dsn-url (optional)
VITE_GEMINI_API_KEY=your-gemini-client-api-key (for frontend chatbot fallback)
```

For the Supabase Edge Functions, set the following secrets in your Supabase Dashboard or via CLI:

```bash
supabase secrets set GEMINI_API_KEY="your-gemini-api-key"
supabase secrets set OCR_SPACE_API_KEY="your-ocr-space-key"
supabase secrets set ALLOWED_ORIGINS="http://localhost:5173,https://your-production-domain.com"
```

---

## 🛠️ Installation & Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/abhishekbhatt95-byte/Med-Decode-Ai-.git
cd Med-Decode-Ai-
```

### 2. Install Frontend Dependencies
```bash
cd frontend
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
The app will run locally at [http://localhost:5173/](http://localhost:5173/).

---

## 🔒 Database & RLS hardiness (Migrations)

All schema updates and security policies are tracked under the `supabase/migrations/` folder.

If you are setting up the remote database for the first time:

1. **Enable Anonymous Sign-ins** in the Supabase Dashboard under **Authentication -> Providers -> Anonymous**.
2. **Apply migrations** using the Supabase CLI:
   ```bash
   supabase db push --linked
   ```
   *Note: This locks down Row Level Security (RLS) policies by preventing `NULL` user uploads, enforces strict ownership (`auth.uid() = user_id`), and auto-provisions profile stubs for guest sessions.*

---

## 📂 Project Structure

```
├── frontend/                  # React Frontend
│   ├── src/
│   │   ├── context/           # Accessibility & Auth state provider
│   │   ├── pages/             # App Pages (Dashboard, Results, Upload, etc.)
│   │   ├── utils/             # Helpers (Supabase client, local AI Copilot)
│   │   └── router.tsx         # Typesafe route definitions
│   └── vite.config.ts         # Vite bundler configuration
│
└── supabase/                  # Backend configurations
    ├── functions/             # Serverless Deno Edge Functions
    │   └── analyze-document/  # Gemini/OCR parser pipeline
    └── migrations/            # SQL Schema & security migrations
```

---

## 🛡️ Medical Disclaimer

MedDecode AI is an educational platform designed to explain medical terms and documents in plain language. It does not provide medical advice, diagnosis, or treatment, and should never be used as a substitute for consulting a licensed medical professional or physician.

**Important:** Users must read and accept this disclaimer via [ConsentPage.tsx](file:///c:/Users/abhis/Desktop/Med-Decode-Ai-/frontend/src/pages/ConsentPage.tsx) before they are allowed to upload or analyze any documents.

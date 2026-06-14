# Xeno Mini CRM (Frontend & API Gateway)

Xeno Mini CRM is an AI-native marketing platform built for consumer and Direct-to-Consumer (D2C) brands to intelligently segment and reach their shopper base.

This application serves as the marketer workspace, visual data dashboard, and campaigns orchestrator. It connects to a distributed CockroachDB Serverless cluster, leverages Gemini 3.1 Flash Lite to assist decisions and draft personalization copy, and interfaces with a decoupled Rust delivery simulator.

---

## 1. Key Features

*   **Shopper Data Ingestion**: Parse and load customer profiles and transactional orders via CSV file uploads.
*   **RFM Scoring Engine**: Pre-computes Recency, Frequency, and Monetary scores using quintiles to place shoppers into behavioral cohorts (*Champions, Loyal, At-Risk, Lapsed, New*).
*   **Visual & Chat Segment Builder**: Synchronized interface where marketers can define cohorts using a drag-and-drop form builder or describe their target segment in plain English (NL-to-SQL).
*   **AI Campaign Wizard**: Message editor featuring customizable tones (*Friendly, Urgent, Exclusive*) and a **Pre-Send Advisor** analyzing timing, optimal channel selection, and delivery risks using Gemini.
*   **Performance Metrics Dashboard**: Displays sent, delivered, failed, opened, and clicked tracking data alongside Recharts engagement curves.
*   **Live SSE Double-Tick Ticker**: Uses Server-Sent Events (SSE) to display real-time webhook callback receipts from the simulator.
*   **Chronological Playback Replay**: Marketers can replay completed campaign logs step-by-step with an adjustable playback tick-rate slider.
*   **72-Hour Conversion Attribution**: Attributes purchase orders and total revenue to campaigns if a targeted customer makes a transaction within 3 days (72 hours) of message dispatch.

---

## 2. Technology Stack

*   **Framework**: Next.js 16.2.9 (App Router)
*   **Styling**: shadcn/ui primitives + Tailwind CSS
*   **Database Driver**: node-postgres (`pg`) — direct parameterized SQL queries (no ORM)
*   **AI Engine**: Google Gemini 3.1 Flash Lite (using `@google/generative-ai`)
*   **Validation**: Zod (runtime API request schema validation)
*   **Streaming**: EventSource (Server-Sent Events)

---

## 3. Repository Folder Structure

```
crm/
├── app/
│   ├── (dashboard)/             # UI views (Brief, Customers, Campaigns, Segments)
│   ├── api/                     # Backend API handlers (AI, SSE, receipts, ingestion)
│   └── layout.tsx               # Main layout wrapper
├── components/
│   ├── ui/                      # Reusable primitives (Buttons, Cards, Badges)
│   ├── segment-builder/         # Visual filters & chat synchronizer panels
│   ├── campaign/                # Message editor, advisor, and template presets
│   └── MorningBrief.tsx         # Dashboard greeting summary
├── lib/
│   ├── db.ts                    # Parameterized CockroachDB queries
│   ├── gemini.ts                # Prompt engineering & LLM connection
│   ├── rfm.ts                   # Shopper behavioral classification
│   └── segment-engine.ts        # Segment JSON filters to SQL compiler
├── public/                      # Asset store (diagrams, images)
├── types/                       # Shared TypeScript interface definitions
├── package.json
└── tsconfig.json
```

---

## 4. Local Installation & Setup

### 4.1 Prerequisites
*   Node.js v18+ installed.
*   A running instance of CockroachDB Serverless (or local PostgreSQL).

### 4.2 Configuration (`.env.local`)
Create a `.env.local` file in the root of the `xeno-frontend` folder:
```env
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/defaultdb?sslmode=verify-full
GEMINI_API_KEY=your-gemini-api-key
CHANNEL_SERVICE_URL=http://localhost:8080
RECEIPT_WEBHOOK_SECRET=some-shared-secret
```

### 4.3 Setup Steps
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Seed Database**:
    Generates 500 shoppers, 2500+ orders spanning 18 months, pre-built segments, and campaign histories.
    ```bash
    npx tsx lib/seed.ts
    ```
3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view the CRM.

4.  **Production Verification**:
    ```bash
    npm run lint
    npm run build
    ```

---

## 5. Deployment

Deploy the Next.js frontend to Vercel:
1.  Connect your GitHub repository to Vercel.
2.  Add `DATABASE_URL`, `GEMINI_API_KEY`, `CHANNEL_SERVICE_URL`, and `RECEIPT_WEBHOOK_SECRET` as Environment Variables.
3.  Vercel will build and deploy the app automatically.

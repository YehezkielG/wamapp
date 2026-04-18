# WAMApp Mobile App

> Cross-platform weather and AI-assistant mobile application built with Expo.

## Repository

- **Frontend Repo URL:** `https://github.com/<your-username>/<your-frontend-repo>`

## Overview

This app provides weather insights, location-based exploration, notification history, and an AI-powered weather chat experience.

## Features

- Real-time weather dashboard
- 12-hour and 7-day forecast views
- Explore map with weather layers and marked locations
- Notification center with read/unread and clear actions
- AI chat assistant (`WAMchat`) with weather + notification context
- Push notification integration that opens prefilled chat drafts

## Tech Stack

- Expo + React Native
- TypeScript
- Expo Router
- Zustand
- Supabase JS

## Project Structure

```text
my-expo-app/
├─ app/
├─ assets/
├─ components/
├─ lib/
├─ android/
└─ package.json
```

## Setup

### Prerequisites

- Node.js 18+
- `pnpm`
- Android Studio / Xcode (for native build)

### Install

```bash
pnpm install
```

### Run

```bash
pnpm start
pnpm android
pnpm ios
```

### Lint & Format

```bash
pnpm lint
pnpm format
```

## Environment Variables

Create `.env` in this folder:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

EXPO_PUBLIC_CHATBOT_API_BASE_URL=http://localhost:8000
EXPO_PUBLIC_WAMAPP_CLIENT_KEY=

EXPO_PUBLIC_SUPABASE_URL_CHATBOT=
EXPO_PUBLIC_SUPABASE_ANON_KEY_CHATBOT=

EXPO_PUBLIC_OPENWEATHER_TILE_API_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
GOOGLE_MAPS_ANDROID_API_KEY=
GOOGLE_MAPS_IOS_API_KEY=

EXPO_PUBLIC_ID_PROJECT=
```

## Screenshots Template

Store images in `docs/images/` (or your preferred folder).

```md
![Dashboard](docs/images/dashboard.png)
*Figure 1. Current weather dashboard overview.*

![Chat](docs/images/chat.png)
*Figure 2. AI weather chat screen with contextual recommendations.*

![History](docs/images/history.png)
*Figure 3. Notification history list and status indicators.*
```

## License

Add your project license here.

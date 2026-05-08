# WardSeal MFA App

WardSeal MFA is a dedicated application for Multi-Factor Authentication with real-time push notification capabilities. 

## Features

- **Push Notifications**: Receive real-time login requests on your mobile device (simulated via SSE).
- **One-Tap Approval**: Approve or deny login requests with a single tap.
- **Secure Device Linking**: Securely link your device to your WardSeal account.
- **Audit Logs**: View history of authentication requests.

## Architecture

- **Backend**: Go service with Gin and SSE for real-time notification delivery.
- **Frontend**: React (Vite) + TailwindCSS for a premium mobile-responsive experience.

## Getting Started

### Backend
1. `cd backend`
2. `go run main.go` (Service starts on :8090)

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Integration with WardSeal

The main WardSeal platform can be configured to use this MFA service by calling the `/send` endpoint during the authentication flow.

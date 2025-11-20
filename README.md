# Poetry voting website

*Automatically synced with your [v0.app](https://v0.app) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/thatblackwizard-gmailcoms-projects/v0-poetry-voting-website)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/qrBXtfwDxA3)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/thatblackwizard-gmailcoms-projects/v0-poetry-voting-website](https://vercel.com/thatblackwizard-gmailcoms-projects/v0-poetry-voting-website)**

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/qrBXtfwDxA3](https://v0.app/chat/projects/qrBXtfwDxA3)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository

## Environment Variables

The following environment variables are required for the application to function properly:

### Database
- `MONGODB_URI` - MongoDB connection string

### Cloudinary (Image Upload)
- `CLOUDINARY_CLOUD_NAME` - Your Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Your Cloudinary API key
- `CLOUDINARY_API_SECRET` - Your Cloudinary API secret

### Paystack (Payment Processing)
- `PAYSTACK_SECRET_KEY` - Your Paystack secret key

### Brevo (Email Service)
- `BREVO_API_KEY` - Your Brevo API key (get it from [Brevo Dashboard](https://app.brevo.com/settings/keys/api))
- `BREVO_SENDER_EMAIL` - The email address that will send voting codes (must be verified in Brevo)
- `BREVO_SENDER_NAME` - (Optional) The sender name for emails (defaults to "MPS Poetry Challenge")

### Application
- `NEXT_PUBLIC_APP_URL` - Your application URL (e.g., `https://yourdomain.com` or `http://localhost:3000` for development)

## Setting Up Brevo

1. Create a free account at [Brevo](https://www.brevo.com/)
2. Navigate to **Settings** > **API Keys** in your Brevo dashboard
3. Create a new API key and copy it
4. Add the API key to your environment variables as `BREVO_API_KEY`
5. Verify your sender email address in Brevo (Settings > Senders)
6. Add your verified sender email as `BREVO_SENDER_EMAIL`
7. (Optional) Set a custom sender name with `BREVO_SENDER_NAME`

After successful payment verification, buyers will automatically receive an email with their voting code.

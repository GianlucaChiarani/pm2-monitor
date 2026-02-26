# pm2-monitor

A monitoring tool for PM2 processes that watches error logs and sends email notifications when errors are detected.

## Features

- Monitors all PM2-managed applications' error logs
- Sends email notifications on error detection
- Configurable via environment variables

## Getting Started

### Prerequisites

- Node.js
- PM2

### Installation

```sh
npm i
```

### Build

```sh
npm run build
```

### Configuration

Create a `.env` file in the root directory with the following variables:

```
CHECK_INTERVAL_MS=300000
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=your_smtp_user
SMTP_PASSWORD=your_smtp_password
FROM_EMAIL=your@email.com
TO_EMAIL=recipient@email.com
```

You can also control what the monitor watches with these optional environment variables:

```
INCLUDE_WORDS=error,exception,fail,failed,unauthorized
EXCLUDE_WORDS=debug,info
EXCLUDE_PROCESSES=metrics,logger
ENABLE_EMAIL=true
ENABLE_TELEGRAM=false
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

- `EXCLUDE_PROCESSES`: comma-separated list of PM2 process names to exclude from monitoring (e.g. `metrics,logger`).

### Usage

Build the project and start monitoring:

```sh
npm run build
npm start
```

Or use PM2 to run as a service:

```sh
pm run build
pm i pm2 -g # if not already installed
pm2 start ecosystem.config.js
```

## Project Structure

- `pm2-monitor.ts` – Main source file
- `ecosystem.config.js` – PM2 process configuration
- `dist/` – Compiled JavaScript output

## License

MIT

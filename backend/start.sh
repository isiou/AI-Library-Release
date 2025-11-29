#!/bin/bash

echo "Starting up AI-Library-Backend..."

if ! command -v node &> /dev/null; then
    echo "error: Node.js not found."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "error: npm not found."
    exit 1
fi

mkdir -p logs

echo "Install packages..."
npm install --production

if ! command -v pm2 &> /dev/null; then
    echo "Install PM2..."
    npm install -g pm2
fi

echo "Starting backend..."
npm run pm2:start

echo "AI-Library-Backend is running..."
echo "Catch logs: npm run pm2:logs"
echo "Stop server: npm run pm2:stop"
echo "Restart server: npm run pm2:restart"

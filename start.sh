#!/bin/bash
killall node 2>/dev/null
echo "🚀 Namaste Udala Server naye port par chalu ho raha hai..."
ADMIN_PHONE=9583937047 ADMIN_PASSWORD='Udala@2026' node server.js &
sleep 2
echo "🌐 Internet Link banaya ja raha hai..."
ssh -R 80:localhost:8081 -o StrictHostKeyChecking=no nokey@localhost.run

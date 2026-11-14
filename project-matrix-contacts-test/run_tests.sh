#!/bin/sh
# Runs every check for the contacts backup test build. Needs g++, node, and (for the browser test) playwright + chromium.
set -e
cd "$(dirname "$0")"
g++ -std=c++17 -O1 -g -fsanitize=address,undefined -fno-sanitize-recover=undefined -Wall -Wextra test/test_contacts.cpp -o /tmp/test_contacts && /tmp/test_contacts
node test/test_contacts_model.js
python3 tools/build_contacts_dashboard.py
node test/browser_test.js

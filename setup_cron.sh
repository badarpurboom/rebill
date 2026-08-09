#!/bin/bash
(crontab -l 2>/dev/null; echo "0 9 * * * cd /var/www/rebill/backend && /var/www/rebill/backend/venv/bin/python manage.py run_auto_campaigns >> /var/log/rebill_auto_campaigns.log 2>&1") | crontab -

#!/bin/bash
(crontab -l 2>/dev/null; echo "*/5 * * * * cd /var/www/rebill/backend && /var/www/rebill/backend/venv/bin/python manage.py run_scheduled_campaigns >> /var/log/rebill_scheduled_campaigns.log 2>&1") | crontab -

-- Run this in Supabase SQL Editor (once)
-- Prerequisite: function `marked-location-anomaly-notifier` is deployed.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Optional: remove old schedule if exists
select cron.unschedule('marked-location-anomaly-every-15-minutes');

-- Create schedule to run every 15 minutes
select
  cron.schedule(
    'marked-location-anomaly-every-15-minutes',
    '*/15 * * * *',
    $$
    select
      net.http_post(
        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/marked-location-anomaly-notifier',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
  );

-- Check active schedules
select jobid, jobname, schedule, active
from cron.job
where jobname = 'marked-location-anomaly-every-15-minutes';

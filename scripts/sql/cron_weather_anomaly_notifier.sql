-- Run this in Supabase SQL Editor (once)
-- Prerequisite: function `weather-anomaly-notifier` is deployed.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('weather-anomaly-every-minute');

select
  cron.schedule(
    'weather-anomaly-every-15-minutes',
    '*/15 * * * *',
    $$
    select
      net.http_post(
        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/weather-anomaly-notifier',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer <SUPABASE_SERVICE_ROLE_KEY>'
        ),
        body := '{}'::jsonb
      ) as request_id;
    $$
  );

select jobid, jobname, schedule, active from cron.job where jobname = 'weather-anomaly-every-minute';
select jobid, jobname, schedule, active from cron.job where jobname = 'weather-anomaly-every-15-minutes';

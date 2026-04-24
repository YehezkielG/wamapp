-- Trim chat_history to latest 10 rows per device_id
-- Place this file in your SQL migration folder and apply it to the database.

-- Trigger function: after insert, delete older rows for same device_id keeping only the latest 10
CREATE OR REPLACE FUNCTION trim_chat_history_to_latest_10()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM chat_history
  WHERE device_id = NEW.device_id
    AND id NOT IN (
      SELECT id FROM chat_history
      WHERE device_id = NEW.device_id
      ORDER BY created_at DESC, id DESC
      LIMIT 10
    );

  RETURN NEW;
END;
$$;

-- Trigger: call the function after each insert on chat_history
DROP TRIGGER IF EXISTS chat_history_trim_after_insert ON chat_history;
CREATE TRIGGER chat_history_trim_after_insert
AFTER INSERT ON chat_history
FOR EACH ROW
EXECUTE FUNCTION trim_chat_history_to_latest_10();

-- Notes:
-- - This keeps the most recent 10 rows (by created_at, tie-broken by id) per device_id.
-- - Apply this migration in a safe window; for very large tables consider batching or creating an indexed temporary strategy first.
-- - If you want this global (not per-device), modify the WHERE clause accordingly.

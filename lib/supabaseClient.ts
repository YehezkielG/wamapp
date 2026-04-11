import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createSupabaseClientForDevice(deviceId: string | null) {
	return createClient(supabaseUrl, supabaseAnonKey, {
		global: {
			headers: {
				...(deviceId ? { 'x-device-id': deviceId, device_id: deviceId } : {}),
			},
		},
	});
}
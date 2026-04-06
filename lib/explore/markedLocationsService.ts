import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '../supabaseClient';

export type MarkedLocation = {
  id: string;
  deviceId: string | null;
  locationName: string;
  latitude: number;
  longitude: number;
  createdAt: string;
};

let cachedDeviceId: string | null | undefined;

type DeviceRow = {
  id: string;
};

function normalizeLocationRow(row: {
  id: string;
  device_id: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
}): MarkedLocation {
  return {
    id: row.id,
    deviceId: row.device_id,
    locationName: row.location_name ?? 'Saved Location',
    latitude: Number(row.latitude ?? 0),
    longitude: Number(row.longitude ?? 0),
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

async function resolvePushToken() {
  if (!Device.isDevice) return null;

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return null;

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    return tokenResponse.data ?? null;
  } catch {
    return null;
  }
}

export async function getCurrentDeviceId() {
  if (cachedDeviceId !== undefined) {
    return cachedDeviceId;
  }

  const pushToken = await resolvePushToken();
  if (!pushToken) {
    cachedDeviceId = null;
    return null;
  }

  const { data, error } = await supabase
    .from('devices')
    .upsert(
      {
        push_token: pushToken,
        last_active: new Date().toISOString(),
      },
      { onConflict: 'push_token' }
    )
    .select('id')
    .single<DeviceRow>();

  if (error) {
    throw new Error(`Failed to resolve device id: ${error.message}`);
  }

  cachedDeviceId = data.id;
  return data.id;
}

export async function listMarkedLocations(deviceId: string | null) {
  let query = supabase
    .from('marked_locations')
    .select('id, device_id, location_name, latitude, longitude, created_at')
    .order('created_at', { ascending: false })
    .limit(30);

  query = deviceId ? query.eq('device_id', deviceId) : query.is('device_id', null);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load marked locations: ${error.message}`);
  }

  return (data ?? []).map(normalizeLocationRow);
}

export async function addMarkedLocation(input: {
  deviceId: string | null;
  locationName: string;
  latitude: number;
  longitude: number;
}) {
  const { data, error } = await supabase
    .from('marked_locations')
    .insert({
      device_id: input.deviceId,
      location_name: input.locationName,
      latitude: input.latitude,
      longitude: input.longitude,
    })
    .select('id, device_id, location_name, latitude, longitude, created_at')
    .single();

  if (error) {
    throw new Error(`Failed to save marked location: ${error.message}`);
  }

  return normalizeLocationRow(data);
}

export async function deleteMarkedLocation(locationId: string) {
  const { error } = await supabase.from('marked_locations').delete().eq('id', locationId);

  if (error) {
    throw new Error(`Failed to delete marked location: ${error.message}`);
  }
}

export async function updateMarkedLocationName(locationId: string, locationName: string) {
  const { data, error } = await supabase
    .from('marked_locations')
    .update({ location_name: locationName })
    .eq('id', locationId)
    .select('id, device_id, location_name, latitude, longitude, created_at')
    .single();

  if (error) {
    throw new Error(`Failed to update marked location name: ${error.message}`);
  }

  return normalizeLocationRow(data);
}

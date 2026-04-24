import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
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

type DeviceLocationRow = {
  latitude: number | null;
  longitude: number | null;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hash32(input: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toHex8(value: number) {
  return value.toString(16).padStart(8, '0');
}

function seedToUuid(seed: string) {
  const h1 = hash32(seed, 0x811c9dc5);
  const h2 = hash32(seed, 0x9747b28c);
  const h3 = hash32(seed, 0xc2b2ae35);
  const h4 = hash32(seed, 0x27d4eb2f);
  let hex = `${toHex8(h1)}${toHex8(h2)}${toHex8(h3)}${toHex8(h4)}`;

  hex = `${hex.slice(0, 12)}4${hex.slice(13)}`;
  const variantNibble = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  hex = `${hex.slice(0, 16)}${variantNibble}${hex.slice(17)}`;

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function normalizeAsUuid(candidate: string) {
  const normalized = candidate.trim().toLowerCase();
  if (UUID_REGEX.test(normalized)) return normalized;
  return seedToUuid(normalized);
}

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

async function resolveHardwareDeviceId() {
  if (Platform.OS === 'android') {
    const ssaid = (await Application.getAndroidId())?.trim();

    if (ssaid) return normalizeAsUuid(`android:ssaid:${ssaid}`);

    // Fallback (emulator / certain vendor devices): derive deterministic id from push token
    const token = await resolvePushToken();
    if (token) {
      return normalizeAsUuid(`android:token:${token}`);
    }

    // Last fallback for development devices when token is unavailable
    const brand = Device.brand ?? 'unknown-brand';
    const model = Device.modelName ?? 'unknown-model';
    const osVersion = Device.osVersion ?? 'unknown-os';

    return normalizeAsUuid(`android:fallback:${brand}:${model}:${osVersion}`.replace(/\s+/g, '-'));
  }

  if (Platform.OS === 'ios') {
    try {
      const idfv = await Application.getIosIdForVendorAsync();
      if (idfv) return normalizeAsUuid(`ios:idfv:${idfv}`);

      const token = await resolvePushToken();
      if (token) return normalizeAsUuid(`ios:token:${token}`);

      const model = Device.modelName ?? 'unknown-model';
      const osVersion = Device.osVersion ?? 'unknown-os';
      return normalizeAsUuid(`ios:fallback:${model}:${osVersion}`);
    } catch {
      const model = Device.modelName ?? 'unknown-model';
      const osVersion = Device.osVersion ?? 'unknown-os';
      return normalizeAsUuid(`ios:error-fallback:${model}:${osVersion}`);
    }
  }

  const model = Device.modelName ?? 'unknown-model';
  const osVersion = Device.osVersion ?? 'unknown-os';
  return normalizeAsUuid(`${Platform.OS}:fallback:${model}:${osVersion}`);
}

export async function getCurrentDeviceId() {
  if (cachedDeviceId !== undefined) {
    return cachedDeviceId;
  }

  const deviceId = await resolveHardwareDeviceId();
  if (!deviceId) {
    cachedDeviceId = null;
    return null;
  }

  const pushToken = await resolvePushToken();

  if (pushToken) {
    const { data: byToken, error: byTokenError } = await supabase
      .from('devices')
      .select('id')
      .eq('push_token', pushToken)
      .maybeSingle<DeviceRow>();

    if (!byTokenError && byToken?.id) {
      const { error: touchError } = await supabase
        .from('devices')
        .update({ last_active: new Date().toISOString() })
        .eq('id', byToken.id);

      if (touchError) {
        console.warn('Failed to refresh device last_active:', touchError.message);
      }

      cachedDeviceId = byToken.id;
      return byToken.id;
    }
  }

  if (!pushToken) {
    const { data: existing, error: existingError } = await supabase
      .from('devices')
      .select('id')
      .eq('id', deviceId)
      .maybeSingle<DeviceRow>();

    if (!existingError && existing?.id) {
      cachedDeviceId = existing.id;
      return existing.id;
    }

    cachedDeviceId = null;
    return null;
  }

  const { data, error } = await supabase
    .from('devices')
    .upsert(
      {
        id: deviceId,
        push_token: pushToken,
        last_active: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('id')
    .single<DeviceRow>();

  if (error) {
    throw new Error(`Failed to resolve device id: ${error.message}`);
  }

  cachedDeviceId = data.id;
  return data.id;
}

export async function saveDevicePushToken(pushToken: string) {
  const deviceId = await resolveHardwareDeviceId();
  if (!deviceId) return false;

  const { data: byToken, error: byTokenError } = await supabase
    .from('devices')
    .select('id')
    .eq('push_token', pushToken)
    .maybeSingle<DeviceRow>();

  if (!byTokenError && byToken?.id) {
    const { error: updateError } = await supabase
      .from('devices')
      .update({ last_active: new Date().toISOString() })
      .eq('id', byToken.id);

    if (updateError) {
      console.warn('Failed to refresh device by token:', updateError.message);
      return false;
    }

    cachedDeviceId = byToken.id;
    return true;
  }

  const { error } = await supabase.from('devices').upsert(
    {
      id: deviceId,
      push_token: pushToken,
      last_active: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.warn('Failed to save push token:', error.message);
    return false;
  }

  cachedDeviceId = deviceId;
  return true;
}

export async function clearDevicePushToken() {
  const deviceId = await resolveHardwareDeviceId();
  if (!deviceId) return false;

  const revokedToken = `revoked:${deviceId}:${Date.now()}`;

  const { error } = await supabase.from('devices').upsert(
    {
      id: deviceId,
      push_token: revokedToken,
      last_active: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.warn('Failed to clear push token:', error.message);
    return false;
  }

  cachedDeviceId = deviceId;
  return true;
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function updateDeviceLocationIfMoved(
  deviceId: string | null,
  latitude: number,
  longitude: number,
  minMeters = 500
) {
  if (!deviceId) return false;

  const { data: deviceRow, error: fetchErr } = await supabase
    .from('devices')
    .select('latitude, longitude, push_token')
    .eq('id', deviceId)
    .limit(1)
    .maybeSingle<DeviceLocationRow & { push_token: string | null }>();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    // ignore not-found vs other errors
  }

  const prevLat = deviceRow?.latitude ?? null;
  const prevLon = deviceRow?.longitude ?? null;

  let shouldUpdate = false;
  if (prevLat === null || prevLon === null) {
    shouldUpdate = true;
  } else {
    const dist = haversineDistanceMeters(Number(prevLat), Number(prevLon), latitude, longitude);
    shouldUpdate = dist >= minMeters;
  }

  if (!shouldUpdate) return false;

  const { data: updatedRow, error: updateErr } = await supabase
    .from('devices')
    .update({ latitude, longitude, last_active: new Date().toISOString() })
    .eq('id', deviceId)
    .select('id')
    .maybeSingle<DeviceRow>();

  if (updateErr) {
    // log but don't throw from background
    console.warn('Failed to update device location:', updateErr.message);
    return false;
  }

  if (!updatedRow?.id) {
    console.warn('Skipped location update: device row not found yet (push token may not be saved).');
    return false;
  }

  return true;
}

export async function updateDeviceLocationFromCoords(
  latitude: number,
  longitude: number,
  minMeters = 500
) {
  try {
    const deviceId = await getCurrentDeviceId();
    if (!deviceId) {
      console.warn('updateDeviceLocationFromCoords skipped: device ID unavailable');
      return false;
    }
    return await updateDeviceLocationIfMoved(deviceId, latitude, longitude, minMeters);
  } catch (err) {
    console.warn('updateDeviceLocationFromCoords error', err);
    return false;
  }
}

export async function saveDeviceLocationNow(latitude: number, longitude: number) {
  try {
    const deviceId = await getCurrentDeviceId();
    if (!deviceId) {
      console.warn('saveDeviceLocationNow skipped: device ID unavailable');
      return false;
    }

    const { data: updatedRow, error } = await supabase
      .from('devices')
      .update({ latitude, longitude, last_active: new Date().toISOString() })
      .eq('id', deviceId)
      .select('id')
      .maybeSingle<DeviceRow>();

    if (error) {
      console.warn('Failed to save startup device location:', error.message);
      return false;
    }

    if (!updatedRow?.id) {
      console.warn('Skipped startup location save: device row not found yet (push token may not be saved).');
      return false;
    }

    return true;
  } catch (err) {
    console.warn('saveDeviceLocationNow error', err);
    return false;
  }
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
  const deviceId = await getCurrentDeviceId();
  let query = supabase.from('marked_locations').delete().eq('id', locationId);

  query = deviceId ? query.eq('device_id', deviceId) : query.is('device_id', null);

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to delete marked location: ${error.message}`);
  }
}

export async function updateMarkedLocationName(locationId: string, locationName: string) {
  const deviceId = await getCurrentDeviceId();

  let query = supabase
    .from('marked_locations')
    .update({ location_name: locationName })
    .eq('id', locationId);

  query = deviceId ? query.eq('device_id', deviceId) : query.is('device_id', null);

  const { data, error } = await query
    .select('id, device_id, location_name, latitude, longitude, created_at')
    .single();

  if (error) {
    throw new Error(`Failed to update marked location name: ${error.message}`);
  }

  return normalizeLocationRow(data);
}

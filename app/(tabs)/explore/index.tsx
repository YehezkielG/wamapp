import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, Text, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, UrlTile } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { EXPLORE_LAYERS, type ExploreLayerId } from '../../../lib/explore/mapLayers';
import {
  fetchOpenWeatherLayerSamples,
  type ExploreLayerRanges,
  type ExploreSamplePoint,
} from '../../../lib/explore/openWeatherExplore';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const DEFAULT_REGION: Region = {
  latitude: -6.2,
  longitude: 106.816666,
  latitudeDelta: 16,
  longitudeDelta: 16,
};

const TEMP_TILE_COLORS = ['#173f8a', '#1f73b7', '#45a4d9', '#f6d743', '#ef7d3c', '#d73b2f'];
const WIND_TILE_COLORS = ['#083344', '#0f766e', '#14b8a6', '#5eead4', '#a7f3d0'];
const PRECIP_TILE_COLORS = ['#172554', '#1d4ed8', '#3b82f6', '#7dd3fc', '#e0f2fe'];
const CLOUD_TILE_COLORS = ['#334155', '#64748b', '#94a3b8', '#cbd5e1', '#f8fafc'];

const DEFAULT_RANGES: ExploreLayerRanges = {
  precipitation: { min: 0, max: 10 },
  wind: { min: 0, max: 80 },
  clouds: { min: 0, max: 100 },
  temperature: { min: -10, max: 45 },
};

const TILE_LAYER_BY_ID: Record<ExploreLayerId, string> = {
  temperature: 'temp_new',
  precipitation: 'precipitation_new',
  wind: 'wind_new',
  clouds: 'clouds_new',
};

export default function Explore() {
  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [queryRegion, setQueryRegion] = useState<Region>(DEFAULT_REGION);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [isAttributeLoading, setIsAttributeLoading] = useState(true);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);
  const [tileErrorMessage, setTileErrorMessage] = useState<string | null>(null);
  const [attributeErrorMessage, setAttributeErrorMessage] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<ExploreLayerId>('temperature');
  const [isLayerPickerOpen, setIsLayerPickerOpen] = useState(false);
  const [layerRanges, setLayerRanges] = useState<ExploreLayerRanges>(DEFAULT_RANGES);
  const [focusPoint, setFocusPoint] = useState<ExploreSamplePoint | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [activeTileUrlTemplate, setActiveTileUrlTemplate] = useState<string | null>(null);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const openWeatherFallbackKey = process.env.EXPO_PUBLIC_OPENWEATHER_TILE_API_KEY;

  const selectedLayer = useMemo(
    () => EXPLORE_LAYERS.find((layer) => layer.id === activeLayer) ?? EXPLORE_LAYERS[0],
    [activeLayer]
  );

  const selectedTileLayer = TILE_LAYER_BY_ID[activeLayer];

  const tileUrlTemplate = useMemo(() => {
    if (!supabaseUrl) return null;

    const normalized = supabaseUrl.replace(/\/$/, '');
    const query = new URLSearchParams({
      layer: selectedTileLayer,
      ...(supabaseAnonKey ? { apikey: supabaseAnonKey } : {}),
    });

    return `${normalized}/functions/v1/openweather-tile-proxy/{z}/{x}/{y}.png?${query.toString()}`;
  }, [selectedTileLayer, supabaseAnonKey, supabaseUrl]);

  const directTileUrlTemplate = useMemo(() => {
    if (!openWeatherFallbackKey) return null;
    return `https://tile.openweathermap.org/map/${selectedTileLayer}/{z}/{x}/{y}.png?appid=${openWeatherFallbackKey}`;
  }, [openWeatherFallbackKey, selectedTileLayer]);

  const legendColors = useMemo(() => {
    if (activeLayer === 'wind') return WIND_TILE_COLORS;
    if (activeLayer === 'precipitation') return PRECIP_TILE_COLORS;
    if (activeLayer === 'clouds') return CLOUD_TILE_COLORS;
    return TEMP_TILE_COLORS;
  }, [activeLayer]);

  useEffect(() => {
    setActiveTileUrlTemplate(tileUrlTemplate ?? directTileUrlTemplate ?? null);
  }, [directTileUrlTemplate, tileUrlTemplate]);

  useEffect(() => {
    const loadLocation = async () => {
      setIsLocationLoading(true);
      setLocationErrorMessage(null);

      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Location permission was denied.');
        }

        const position = await Location.getCurrentPositionAsync({});
        const nextRegion = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          latitudeDelta: 8,
          longitudeDelta: 8,
        };

        setMapRegion(nextRegion);
        setQueryRegion(nextRegion);
      } catch (error) {
        setLocationErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to detect location. Showing default region.'
        );
      } finally {
        setIsLocationLoading(false);
      }
    };

    loadLocation();
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setQueryRegion(mapRegion);
    }, 700);

    return () => clearTimeout(debounceTimer);
  }, [mapRegion]);

  useEffect(() => {
    if (!tileUrlTemplate) return;

    const controller = new AbortController();

    const checkTileProxy = async () => {
      try {
        setTileErrorMessage(null);
        const probeUrl = tileUrlTemplate
          .replace('{z}', '1')
          .replace('{x}', '1')
          .replace('{y}', '1');

        const response = await fetch(probeUrl, { method: 'GET', signal: controller.signal });
        if (!response.ok) {
          if (response.status === 401) {
            if (directTileUrlTemplate) {
              setActiveTileUrlTemplate(directTileUrlTemplate);
              setTileErrorMessage(
                'Tile proxy unauthorized (401). Using direct OpenWeather tile fallback. Redeploy `openweather-tile-proxy` with `supabase/config.toml` + `verify_jwt = false` to restore proxy mode.'
              );
              return;
            }

            throw new Error(
              'Tile proxy unauthorized (401). Redeploy `openweather-tile-proxy` with `supabase/config.toml` setting `verify_jwt = false`.'
            );
          }

          throw new Error(`Tile proxy unavailable (${response.status}).`);
        }

        setActiveTileUrlTemplate(tileUrlTemplate);
        setTileErrorMessage(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        setTileErrorMessage(
          error instanceof Error ? error.message : 'Tile proxy check failed.'
        );

        if (directTileUrlTemplate) {
          setActiveTileUrlTemplate(directTileUrlTemplate);
        }
      }
    };

    checkTileProxy();
    return () => controller.abort();
  }, [directTileUrlTemplate, tileUrlTemplate]);

  useEffect(() => {
    const controller = new AbortController();

    const loadAttributes = async () => {
      setIsAttributeLoading(true);
      setAttributeErrorMessage(null);

      try {
        const areaLevel =
          queryRegion.latitudeDelta >= 6
            ? 'province'
            : queryRegion.latitudeDelta >= 2.4
              ? 'city'
              : 'district';

        const result = await fetchOpenWeatherLayerSamples(queryRegion, areaLevel, controller.signal);
        setLayerRanges(result.ranges);

        if (!result.samples.length) {
          setFocusPoint(null);
          throw new Error('No weather attributes returned for this region.');
        }

        const nearest = findNearestPoint(result.samples, queryRegion.latitude, queryRegion.longitude);
        setFocusPoint(nearest);

        const updatedAtText = result.updatedAt
          ? new Date(result.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastUpdatedAt(updatedAtText);
      } catch (error) {
        if (controller.signal.aborted) return;

        setAttributeErrorMessage(
          error instanceof Error ? error.message : 'Failed to load weather attributes.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsAttributeLoading(false);
        }
      }
    };

    loadAttributes();
    return () => controller.abort();
  }, [queryRegion]);

  const handleRegionChangeComplete = (nextRegion: Region) => {
    setMapRegion((previousRegion) => {
      const latDiff = Math.abs(previousRegion.latitude - nextRegion.latitude);
      const lonDiff = Math.abs(previousRegion.longitude - nextRegion.longitude);
      const latDeltaDiff = Math.abs(previousRegion.latitudeDelta - nextRegion.latitudeDelta);
      const lonDeltaDiff = Math.abs(previousRegion.longitudeDelta - nextRegion.longitudeDelta);

      if (
        latDiff < 0.0008 &&
        lonDiff < 0.0008 &&
        latDeltaDiff < 0.0008 &&
        lonDeltaDiff < 0.0008
      ) {
        return previousRegion;
      }
      return nextRegion;
    });
  };

  const mapHeight = useMemo(() => Math.round(Dimensions.get('window').height * 0.56), []);

  const layerRangeText = useMemo(() => {
    const range = layerRanges[activeLayer] ?? DEFAULT_RANGES[activeLayer];
    return {
      min: Number(range.min).toFixed(1),
      max: Number(range.max).toFixed(1),
      unit: selectedLayer.unit,
    };
  }, [activeLayer, layerRanges, selectedLayer.unit]);

  return (
    <View className="flex-1 bg-transparent px-4 pt-6">
      <View className="mb-4">
        <Text className="text-2xl font-bold text-white">Global Weather Layers</Text>
        <Text className="mt-1 text-xs text-white/75">
           ({selectedLayer.label})
        </Text>
      </View>

      <View className="mb-3">
        <Pressable
          className="flex-row items-center justify-between rounded-xl border border-white/25 bg-white/12 px-4 py-3"
          onPress={() => setIsLayerPickerOpen((previous) => !previous)}
        >
          <Text className="text-sm font-semibold text-white">{selectedLayer.label}</Text>
          <Text className="text-base text-white/80">{isLayerPickerOpen ? '▴' : '▾'}</Text>
        </Pressable>

        {isLayerPickerOpen ? (
          <View className="mt-2 overflow-hidden rounded-xl border border-white/20 bg-slate-900/90">
            {EXPLORE_LAYERS.map((layer) => {
              const isActive = layer.id === activeLayer;

              return (
                <Pressable
                  key={layer.id}
                  className={`px-4 py-3 ${isActive ? 'bg-white/20' : 'bg-transparent'}`}
                  onPress={() => {
                    setActiveLayer(layer.id);
                    setIsLayerPickerOpen(false);
                  }}
                >
                  <Text className={`text-sm ${isActive ? 'font-semibold text-white' : 'text-white/85'}`}>
                    {layer.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View style={{ height: mapHeight }} className="overflow-hidden rounded-xl border border-white/20 bg-black/10">
        {isLocationLoading ? (
          <View className="flex-1 items-center justify-center bg-white/10">
            <ActivityIndicator size="large" color="#ffffff" />
            <Text className="mt-3 text-sm text-white/85">Loading map...</Text>
          </View>
        ) : (
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
            onRegionChangeComplete={handleRegionChangeComplete}
            scrollEnabled
            zoomEnabled
            rotateEnabled
            pitchEnabled
          >
            {activeTileUrlTemplate ? (
              <UrlTile
                urlTemplate={activeTileUrlTemplate}
                flipY={false}
                maximumZ={19}
                zIndex={2}
                tileSize={256}
              />
            ) : null}
          </MapView>
        )}

        <View className="absolute left-3 right-3 top-3 flex-row items-center justify-between rounded-lg border border-white/10 bg-slate-900/45 px-3 py-2">
          <Text className="text-[11px] text-white/85">{selectedLayer.label}</Text>
          {lastUpdatedAt ? <Text className="text-[11px] text-white/60">{lastUpdatedAt}</Text> : null}
        </View>

        <BlurView
          intensity={24}
          tint="dark"
          className="absolute bottom-3 left-3 max-w-[62%] overflow-hidden rounded-xl border border-white/20"
        >
          <View className="px-3 py-2">
            <Text className="text-[11px] font-semibold text-white/90">Weather Attributes</Text>

            {isAttributeLoading ? (
              <Text className="mt-1 text-[11px] text-white/70">Loading attributes...</Text>
            ) : focusPoint ? (
              <>
                <Text className="mt-1 text-[11px] text-white/80">
                  {focusPoint.place.name}, {focusPoint.place.state}
                </Text>
                <Text className="mt-1 text-[11px] text-white/80">
                  {selectedLayer.label}: {focusPoint.values[activeLayer].toFixed(1)} {selectedLayer.unit}
                </Text>
                <Text className="text-[11px] text-white/80">
                  Humidity: {Math.round(focusPoint.metrics.humidity)}% · Wind: {focusPoint.values.wind.toFixed(1)} km/h
                </Text>
                <Text className="text-[11px] text-white/80">
                  Clouds: {Math.round(focusPoint.values.clouds)}% · Pressure: {Math.round(focusPoint.metrics.pressure)} hPa
                </Text>
              </>
            ) : (
              <Text className="mt-1 text-[11px] text-white/70">No attributes available.</Text>
            )}
          </View>
        </BlurView>

        <BlurView
          intensity={30}
          tint="dark"
          className="absolute bottom-3 right-3 overflow-hidden rounded-xl border border-white/20"
        >
          <View className="px-3 py-2">
            <Text className="text-[11px] font-semibold text-white/90">{selectedLayer.label} Legend</Text>
            <View className="mt-2 flex-row items-center gap-1">
              {legendColors.map((color) => (
                <View key={color} style={{ backgroundColor: color }} className="h-2.5 w-6 rounded-sm" />
              ))}
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className="text-[10px] text-white/70">{layerRangeText.min} {layerRangeText.unit}</Text>
              <Text className="text-[10px] text-white/70">{layerRangeText.max} {layerRangeText.unit}</Text>
            </View>
          </View>
        </BlurView>

        {!activeTileUrlTemplate ? (
          <View className="absolute bottom-3 left-3 right-28 rounded-md border border-amber-200/60 bg-amber-100/90 px-2 py-1">
            <Text className="text-[11px] text-amber-900">
              Missing tile source. Set `EXPO_PUBLIC_SUPABASE_URL` or fallback `EXPO_PUBLIC_OPENWEATHER_TILE_API_KEY`.
            </Text>
          </View>
        ) : null}

        {tileErrorMessage ? (
          <View className="absolute bottom-24 left-3 right-3 rounded-md border border-red-200/80 bg-red-100/95 px-2 py-1">
            <Text className="text-[11px] text-red-900">{tileErrorMessage}</Text>
          </View>
        ) : null}

        {attributeErrorMessage ? (
          <View className="absolute bottom-36 left-3 right-3 rounded-md border border-red-200/80 bg-red-100/95 px-2 py-1">
            <Text className="text-[11px] text-red-900">{attributeErrorMessage}</Text>
          </View>
        ) : null}
      </View>

      {locationErrorMessage ? (
        <View className="absolute bottom-24 left-6 right-6 rounded-2xl border border-red-200 bg-red-100/95 p-3">
          <Text className="text-xs font-medium text-red-900">{locationErrorMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

function findNearestPoint(
  points: ExploreSamplePoint[],
  targetLatitude: number,
  targetLongitude: number
) {
  let nearest = points[0];
  let minDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    const latitudeDiff = point.latitude - targetLatitude;
    const longitudeDiff = point.longitude - targetLongitude;
    const distance = latitudeDiff * latitudeDiff + longitudeDiff * longitudeDiff;

    if (distance < minDistance) {
      minDistance = distance;
      nearest = point;
    }
  }

  return nearest;
}

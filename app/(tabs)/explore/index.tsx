import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, UrlTile, type MapPressEvent } from 'react-native-maps';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { EXPLORE_LAYERS, type ExploreLayerId } from '../../../lib/explore/mapLayers';
import {
  addMarkedLocation,
  deleteMarkedLocation,
  getCurrentDeviceId,
  listMarkedLocations,
  type MarkedLocation,
  updateMarkedLocationName,
} from '../../../lib/explore/markedLocationsService';
import {
  searchLocationsWithNominatim,
  type NominatimSearchResult,
} from '../../../lib/explore/nominatimSearch';
import {
  fetchMarkedLocationWeather,
  type MarkedLocationWeather,
} from '../../../lib/explore/markedLocationWeather';
import { useWeatherStore } from '../../../lib/weather/weatherStore';
import { showPopup } from '../../../lib/inAppPopup';

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

type LayerRanges = Record<ExploreLayerId, { min: number; max: number }>;

const DEFAULT_RANGES: LayerRanges = {
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
  const mapRef = useRef<MapView | null>(null);

  const [mapRegion, setMapRegion] = useState<Region>(DEFAULT_REGION);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [isMarkedLoading, setIsMarkedLoading] = useState(true);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationErrorMessage, setLocationErrorMessage] = useState<string | null>(null);
  const [tileErrorMessage, setTileErrorMessage] = useState<string | null>(null);
  const [markedErrorMessage, setMarkedErrorMessage] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<ExploreLayerId>('temperature');
  const [isLayerPickerOpen, setIsLayerPickerOpen] = useState(false);
  const [activeTileUrlTemplate, setActiveTileUrlTemplate] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimSearchResult[]>([]);
  const [markedLocations, setMarkedLocations] = useState<MarkedLocation[]>([]);
  const [markedLocationWeather, setMarkedLocationWeather] = useState<Record<string, MarkedLocationWeather>>({});
  const [selectedMarkedLocationId, setSelectedMarkedLocationId] = useState<string | null>(null);
  const [pendingCoordinate, setPendingCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pendingTargetLocationId, setPendingTargetLocationId] = useState<string | null>(null);
  const [pendingLocationName, setPendingLocationName] = useState('');
  const [isCreateLocationModalVisible, setIsCreateLocationModalVisible] = useState(false);
  const [isSavingLocationFromMap, setIsSavingLocationFromMap] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  const weatherCode = useWeatherStore((state) => state.data?.weatherCode);

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const openWeatherFallbackKey = process.env.EXPO_PUBLIC_OPENWEATHER_TILE_API_KEY;

  const selectedLayer = useMemo(
    () => EXPLORE_LAYERS.find((layer) => layer.id === activeLayer) ?? EXPLORE_LAYERS[0],
    [activeLayer]
  );

  const selectedTileLayer = TILE_LAYER_BY_ID[activeLayer];
  const isDarkUi = useMemo(() => {
    const isNight = currentHour >= 19 || currentHour < 5;
    const isStorm = weatherCode !== undefined && [95, 96, 99].includes(weatherCode);
    return isNight || isStorm;
  }, [currentHour, weatherCode]);

  const outsideMapSurfaceClass = useMemo(
    () => (isDarkUi ? 'border border-white/30 bg-white/15' : 'border border-white/70 bg-white/60'),
    [isDarkUi]
  );
  const outsideMapTextClass = isDarkUi ? 'text-white' : 'text-slate-800';
  const outsideMapMutedTextClass = isDarkUi ? 'text-white/75' : 'text-slate-600';
  const panelInputClass = isDarkUi
    ? 'flex-1 rounded-lg border border-white/30 bg-white/15 px-3 py-2 text-sm text-white'
    : 'flex-1 rounded-lg border border-slate-300 bg-white/75 px-3 py-2 text-sm text-slate-900';
  const panelInputPlaceholderColor = isDarkUi ? 'rgba(241,245,249,0.75)' : 'rgba(71,85,105,0.75)';
  const modalInputBg = isDarkUi ? 'rgba(255,255,255,0.06)' : '#ffffff';
  const modalPlaceholderColor = isDarkUi ? 'rgba(241,245,249,0.65)' : 'rgba(71,85,105,0.65)';

  const coverageAreaKm2 = useMemo(() => {
    const earthRadiusKm = 6371;
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

    const latDeltaRadians = toRadians(Math.abs(mapRegion.latitudeDelta));
    const lonDeltaRadians = toRadians(Math.abs(mapRegion.longitudeDelta));
    const latitudeRadians = toRadians(mapRegion.latitude);

    const northSouthKm = earthRadiusKm * latDeltaRadians;
    const eastWestKm = earthRadiusKm * lonDeltaRadians * Math.cos(latitudeRadians);
    return Math.max(0, northSouthKm * Math.max(0, eastWestKm));
  }, [mapRegion.latitude, mapRegion.latitudeDelta, mapRegion.longitudeDelta]);

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
    const timerId = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);

    return () => clearInterval(timerId);
  }, []);

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
    const loadMarkedLocations = async () => {
      setIsMarkedLoading(true);
      setMarkedErrorMessage(null);

      try {
        const deviceId = await getCurrentDeviceId();
        setCurrentDeviceId(deviceId);

        const locations = await listMarkedLocations(deviceId);
        setMarkedLocations(locations);
        await hydrateWeatherForLocations(locations);
      } catch (error) {
        setMarkedErrorMessage(
          error instanceof Error ? error.message : 'Failed to load marked locations.'
        );
      } finally {
        setIsMarkedLoading(false);
      }
    };

    loadMarkedLocations();
  }, []);

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

  const handleSearchLocation = async () => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsSearchingLocation(true);
    setMarkedErrorMessage(null);

    try {
      const results = await searchLocationsWithNominatim(query);
      setSearchResults(results);
    } catch (error) {
      setMarkedErrorMessage(
        error instanceof Error ? error.message : 'Failed to search location.'
      );
      setSearchResults([]);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const hydrateWeatherForLocations = async (locations: MarkedLocation[]) => {
    if (!locations.length) {
      setMarkedLocationWeather({});
      return;
    }

    const weatherPairs = await Promise.all(
      locations.map(async (location) => {
        try {
          const weather = await fetchMarkedLocationWeather(location.latitude, location.longitude);
          return [location.id, weather] as const;
        } catch {
          return [
            location.id,
            {
              temperatureC: null,
              windSpeedKmh: null,
              weatherCode: null,
              label: 'Unknown',
              iconName: 'help-circle-outline',
              iconColor: '#64748b',
            } satisfies MarkedLocationWeather,
          ] as const;
        }
      })
    );

    setMarkedLocationWeather(Object.fromEntries(weatherPairs));
  };

  const refreshWeatherForLocation = async (location: MarkedLocation) => {
    try {
      const weather = await fetchMarkedLocationWeather(location.latitude, location.longitude);
      setMarkedLocationWeather((previous) => ({ ...previous, [location.id]: weather }));
    } catch {
      setMarkedLocationWeather((previous) => ({
        ...previous,
        [location.id]: {
          temperatureC: null,
          windSpeedKmh: null,
          weatherCode: null,
          label: 'Unknown',
          iconName: 'help-circle-outline',
          iconColor: '#64748b',
        },
      }));
    }
  };

  const focusMapToLocation = (latitude: number, longitude: number) => {
    const nextRegion = {
      latitude,
      longitude,
      latitudeDelta: Math.max(0.12, mapRegion.latitudeDelta * 0.22),
      longitudeDelta: Math.max(0.12, mapRegion.longitudeDelta * 0.22),
    };

    mapRef.current?.animateToRegion(nextRegion, 450);
    setMapRegion(nextRegion);
  };

  const handleSelectLocation = (location: MarkedLocation) => {
    setSelectedMarkedLocationId(location.id);
    focusMapToLocation(location.latitude, location.longitude);
    void refreshWeatherForLocation(location);
  };

  const findNearbyMarkedLocation = (latitude: number, longitude: number) => {
    const tolerance = 0.0008;
    return markedLocations.find(
      (location) =>
        Math.abs(location.latitude - latitude) <= tolerance &&
        Math.abs(location.longitude - longitude) <= tolerance
    );
  };

  const openCreateLocationModal = (latitude: number, longitude: number, preferredName?: string) => {
    const nearby = findNearbyMarkedLocation(latitude, longitude);

    setPendingTargetLocationId(nearby?.id ?? null);
    setPendingCoordinate({ latitude, longitude });
    setPendingLocationName(
      (nearby?.locationName ?? preferredName ?? `Pinned ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`).trim()
    );
    setIsCreateLocationModalVisible(true);
  };

  const handleMapPressToMark = (event: MapPressEvent) => {
    const coordinate = event.nativeEvent.coordinate;
    openCreateLocationModal(coordinate.latitude, coordinate.longitude);
  };

  const handleSaveLocationFromMapPress = async () => {
    if (!pendingCoordinate) return;

    setIsSavingLocationFromMap(true);
    setMarkedErrorMessage(null);

    try {
      const resolvedName =
        pendingLocationName.trim() ||
        `Pinned ${pendingCoordinate.latitude.toFixed(4)}, ${pendingCoordinate.longitude.toFixed(4)}`;

      if (pendingTargetLocationId) {
        const updated = await updateMarkedLocationName(pendingTargetLocationId, resolvedName);
        setMarkedLocations((previous) =>
          previous.map((location) => (location.id === updated.id ? updated : location))
        );
        setSelectedMarkedLocationId(updated.id);
        focusMapToLocation(updated.latitude, updated.longitude);
      } else {
        const saved = await addMarkedLocation({
          deviceId: currentDeviceId,
          locationName: resolvedName,
          latitude: pendingCoordinate.latitude,
          longitude: pendingCoordinate.longitude,
        });

        const weather = await fetchMarkedLocationWeather(saved.latitude, saved.longitude);

        setMarkedLocations((previous) => [saved, ...previous.filter((item) => item.id !== saved.id)]);
        setMarkedLocationWeather((previous) => ({ ...previous, [saved.id]: weather }));
        setSelectedMarkedLocationId(saved.id);
        focusMapToLocation(saved.latitude, saved.longitude);
        showPopup({
          type: 'success',
          title: 'Location Added',
          message: `${saved.locationName} has been marked successfully.`,
        });
      }

      setIsCreateLocationModalVisible(false);
      setPendingCoordinate(null);
      setPendingTargetLocationId(null);
      setPendingLocationName('');
    } catch (error) {
      setMarkedErrorMessage(
        error instanceof Error ? error.message : 'Failed to save marked location.'
      );
    } finally {
      setIsSavingLocationFromMap(false);
    }
  };

  const handleAddMarkedLocation = async (result: NominatimSearchResult) => {
    setMarkedErrorMessage(null);
    openCreateLocationModal(result.latitude, result.longitude, result.displayName);
  };

  const handleDeleteMarkedLocation = async (locationId: string) => {
    setMarkedErrorMessage(null);

    try {
      await deleteMarkedLocation(locationId);
      setMarkedLocations((previous) => previous.filter((location) => location.id !== locationId));
      setMarkedLocationWeather((previous) => {
        const next = { ...previous };
        delete next[locationId];
        return next;
      });
      setSelectedMarkedLocationId((previous) => (previous === locationId ? null : previous));
      showPopup({
        type: 'success',
        title: 'Location Deleted',
        message: 'Marked location has been deleted successfully.',
      });
    } catch (error) {
      setMarkedErrorMessage(
        error instanceof Error ? error.message : 'Failed to delete marked location.'
      );
    }
  };

  const confirmDeleteMarkedLocation = (location: MarkedLocation) => {
    Alert.alert(
      'Delete marked location?',
      `Are you sure you want to delete "${location.locationName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void handleDeleteMarkedLocation(location.id);
          },
        },
      ]
    );
  };

  const mapHeight = useMemo(() => Math.round(Dimensions.get('window').height * 0.56), []);

  const layerRangeText = useMemo(() => {
    const range = DEFAULT_RANGES[activeLayer];
    return {
      min: Number(range.min).toFixed(1),
      max: Number(range.max).toFixed(1),
      unit: selectedLayer.unit,
    };
  }, [activeLayer, selectedLayer.unit]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        className="flex-1 bg-transparent"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View className="mb-4">
        <Text className={`text-2xl font-bold ${outsideMapTextClass}`}>Global Weather Layers</Text>
        <Text className={`mt-1 text-xs ${outsideMapMutedTextClass}`}>
           ({selectedLayer.label})
        </Text>
      </View>

      <View className="mb-3">
        <Pressable
          className={`flex-row items-center justify-between rounded-xl px-4 py-3 ${outsideMapSurfaceClass}`}
          onPress={() => setIsLayerPickerOpen((previous) => !previous)}
        >
          <Text className={`text-sm font-semibold ${outsideMapTextClass}`}>{selectedLayer.label}</Text>
          <Text className={`text-base ${outsideMapMutedTextClass}`}>{isLayerPickerOpen ? '▴' : '▾'}</Text>
        </Pressable>

        {isLayerPickerOpen ? (
          <View className={`mt-2 overflow-hidden rounded-xl ${outsideMapSurfaceClass}`}>
            {EXPLORE_LAYERS.map((layer) => {
              const isActive = layer.id === activeLayer;

              return (
                <Pressable
                  key={layer.id}
                  className={`px-4 py-3 ${isActive ? 'bg-sky-500/20' : 'bg-transparent'}`}
                  onPress={() => {
                    setActiveLayer(layer.id);
                    setIsLayerPickerOpen(false);
                  }}
                >
                  <Text className={`text-sm ${isActive ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                    {layer.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <View className={`mb-3 rounded-xl p-3 ${outsideMapSurfaceClass}`}>
        <Text className={`mb-2 text-xs font-semibold ${outsideMapTextClass}`}>Search Location (Nominatim)</Text>
        <View className="flex-row items-center gap-2">
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search location..."
            placeholderTextColor={panelInputPlaceholderColor}
            className={panelInputClass}
            onSubmitEditing={handleSearchLocation}
            returnKeyType="search"
          />
        </View>

        {searchResults.length > 0 ? (
          <View className="mt-2 flex-row justify-end">
            <Pressable
              onPress={() => setSearchResults([])}
              className={`rounded-md px-2.5 py-1 ${isDarkUi ? 'border border-rose-200/60 bg-rose-500/20' : 'border border-rose-300/80 bg-rose-100'}`}
            >
              <Text className={`text-[11px] font-semibold ${isDarkUi ? 'text-rose-100' : 'text-rose-700'}`}>
                Clear search results
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isSearchingLocation ? (
          <Text className={`mt-2 text-[11px] ${outsideMapMutedTextClass}`}>Searching...</Text>
        ) : null}

        {!isSearchingLocation && searchResults.length > 0 ? (
          <View className="mt-2 gap-2">
            {searchResults.map((result) => (
              <View
                key={result.id}
                className={`rounded-lg px-3 py-2 ${isDarkUi ? 'border border-white/25 bg-white/10' : 'border border-slate-300 bg-white/75'}`}
              >
                <Text className={`text-[11px] ${outsideMapTextClass}`} numberOfLines={2}>
                  {result.displayName}
                </Text>
                <View className="mt-2 flex-row items-center justify-between">
                  <Pressable
                    onPress={() => focusMapToLocation(result.latitude, result.longitude)}
                    className="rounded-md border border-sky-300 bg-sky-100 px-2 py-1"
                  >
                    <Text className="text-[11px] font-medium text-sky-700">View</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleAddMarkedLocation(result)}
                    className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1"
                  >
                    <Text className="text-[11px] font-medium text-emerald-700">Mark</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View
        style={{ height: mapHeight }}
        className={`overflow-hidden rounded-xl ${isDarkUi ? 'border border-white/20 bg-black/10' : 'border border-slate-200 bg-white/30'}`}
      >
        {isLocationLoading ? (
          <View className={`flex-1 items-center justify-center ${isDarkUi ? 'bg-white/10' : 'bg-slate-100/80'}`}>
            <ActivityIndicator size="large" color={isDarkUi ? '#ffffff' : '#0f172a'} />
            <Text className={`mt-3 text-sm ${outsideMapTextClass}`}>Loading map...</Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
            onRegionChangeComplete={handleRegionChangeComplete}
            onPress={handleMapPressToMark}
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

            {markedLocations.map((location) => (
              <Marker
                key={location.id}
                coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                title={location.locationName}
                description={`Current Weather: ${markedLocationWeather[location.id]?.temperatureC?.toFixed(1) ?? '--'}°C • Current Wind ${markedLocationWeather[location.id]?.windSpeedKmh?.toFixed(1) ?? '--'} km/h`}
                pinColor={selectedMarkedLocationId === location.id ? '#0ea5e9' : '#ef4444'}
                onPress={() => handleSelectLocation(location)}
              />
            ))}
          </MapView>
        )}

        <View
          className={`absolute left-3 right-3 top-3 flex-row items-center justify-between rounded-lg px-3 py-2 ${isDarkUi ? 'border border-white/10 bg-slate-900/45' : 'border border-slate-200 bg-white/75'}`}
        >
          <Text className={`text-[11px] ${outsideMapTextClass}`}>{selectedLayer.label}</Text>
          <View className="items-end">
            <Text className={`text-[11px] ${outsideMapMutedTextClass}`}>
              Coverage: {coverageAreaKm2.toFixed(1)} km²
            </Text>
            <Text className={`text-[11px] ${outsideMapMutedTextClass}`}>Tap map to mark location</Text>
          </View>
        </View>

        <BlurView
          intensity={30}
          tint={isDarkUi ? 'dark' : 'light'}
          className="absolute bottom-3 right-3 overflow-hidden rounded-xl border border-white/20"
        >
          <View className="px-3 py-2">
            <Text className={`text-[11px] font-semibold ${outsideMapTextClass}`}>
              {selectedLayer.label} Legend
            </Text>
            <View className="mt-2 flex-row items-center gap-1">
              {legendColors.map((color) => (
                <View key={color} style={{ backgroundColor: color }} className="h-2.5 w-6 rounded-sm" />
              ))}
            </View>
            <View className="mt-1 flex-row items-center justify-between">
              <Text className={`text-[10px] ${outsideMapMutedTextClass}`}>
                {layerRangeText.min} {layerRangeText.unit}
              </Text>
              <Text className={`text-[10px] ${outsideMapMutedTextClass}`}>
                {layerRangeText.max} {layerRangeText.unit}
              </Text>
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

      </View>

      <View className={`mt-3 rounded-xl p-3 ${outsideMapSurfaceClass}`}>
        <Text className={`text-xs font-semibold ${outsideMapTextClass}`}>Marked Locations</Text>

        {isMarkedLoading ? (
          <Text className={`mt-2 text-[11px] ${outsideMapMutedTextClass}`}>Loading marked locations...</Text>
        ) : markedLocations.length === 0 ? (
          <Text className={`mt-2 text-[11px] ${outsideMapMutedTextClass}`}>No marked locations yet.</Text>
        ) : (
          <View className="mt-2 gap-2">
            {markedLocations.slice(0, 6).map((location) => (
              <Pressable
                key={location.id}
                onPress={() => handleSelectLocation(location)}
                className={`rounded-lg px-3 py-2 ${
                  selectedMarkedLocationId === location.id
                    ? isDarkUi
                      ? 'border border-sky-300 bg-sky-500/25'
                      : 'border border-sky-400 bg-sky-100/85'
                    : isDarkUi
                      ? 'border border-white/25 bg-white/10'
                      : 'border border-slate-300 bg-white/75'
                }`}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <Text className={`flex-1 text-sm ${outsideMapTextClass}`} numberOfLines={2}>
                    {location.locationName}
                  </Text>
                  <Pressable
                    onPress={(event) => {
                      event.stopPropagation();
                      confirmDeleteMarkedLocation(location);
                    }}
                    className="flex-row items-center gap-1 rounded-md px-2 py-1"
                  >
                    <Ionicons name="trash-outline" size={14} color={isDarkUi ? '#fda4af' : '#be123c'} />
                  </Pressable>
                </View>
                <Text className={`mt-1 text-[10px] ${outsideMapMutedTextClass}`}>
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
                <View className="mt-2 flex-row items-center gap-2">
                  <Ionicons
                    name={markedLocationWeather[location.id]?.iconName ?? 'help-circle-outline'}
                    size={16}
                    color={markedLocationWeather[location.id]?.iconColor ?? '#64748b'}
                  />
                  <Text className={`text-[11px] ${outsideMapMutedTextClass}`}>
                    Current Weather: {markedLocationWeather[location.id]?.label ?? 'Unknown'}
                  </Text>
                </View>
                <Text className={`mt-1 text-[11px] ${outsideMapMutedTextClass}`}>
                  Current Temp: {markedLocationWeather[location.id]?.temperatureC?.toFixed(1) ?? '--'}°C · Current Wind: {markedLocationWeather[location.id]?.windSpeedKmh?.toFixed(1) ?? '--'} km/h
                </Text>

              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={isCreateLocationModalVisible}
        onRequestClose={() => setIsCreateLocationModalVisible(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View
            className={`w-full rounded-2xl overflow-hidden ${isDarkUi ? 'border border-white/30 bg-slate-900/85' : 'border border-white/70 bg-white/95'}`}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 12 }}
              style={{ maxHeight: 320 }}
              className="p-4"
            >
              <Text className={`text-base font-semibold ${outsideMapTextClass}`}>
                {pendingTargetLocationId ? 'Update marked location' : 'Mark location'}
              </Text>
              <Text className={`mt-1 text-xs ${outsideMapMutedTextClass}`}>
                Enter an optional location name before saving.
              </Text>

              <TextInput
                value={pendingLocationName}
                onChangeText={setPendingLocationName}
                placeholder="Enter location_name"
                placeholderTextColor={modalPlaceholderColor}
                className={`mt-3 ${panelInputClass}`}
                style={{
                  color: isDarkUi ? '#ffffff' : '#0f172a',
                  fontSize: 16,
                  backgroundColor: modalInputBg,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  minHeight: 48,
                  marginBottom: 8,
                }}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveLocationFromMapPress}
              />
            </ScrollView>

            <View className={`border-t px-4 py-3 flex-row justify-end gap-2 ${isDarkUi ? 'border-white/10' : 'border-slate-200'}`}>
              <Pressable
                onPress={() => {
                  setIsCreateLocationModalVisible(false);
                  setPendingCoordinate(null);
                  setPendingTargetLocationId(null);
                  setPendingLocationName('');
                }}
                className={`rounded-md px-3 py-2 ${isDarkUi ? 'border border-white/35 bg-white/10' : 'border border-slate-300 bg-slate-100'}`}
              >
                <Text className={`text-xs font-semibold ${isDarkUi ? 'text-white/90' : 'text-slate-700'}`}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={handleSaveLocationFromMapPress}
                disabled={isSavingLocationFromMap}
                className="rounded-md border border-emerald-300 bg-emerald-100 px-3 py-2"
              >
                <Text className="text-xs font-semibold text-emerald-700">
                  {isSavingLocationFromMap ? 'Saving...' : pendingTargetLocationId ? 'Update Location' : 'Save Location'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {locationErrorMessage ? (
        <View className="mt-3 rounded-2xl border border-red-200 bg-red-100/95 p-3">
          <Text className="text-xs font-medium text-red-900">{locationErrorMessage}</Text>
        </View>
      ) : null}

      {markedErrorMessage ? (
        <View className="mt-3 rounded-2xl border border-red-200 bg-red-100/95 p-3">
          <Text className="text-xs font-medium text-red-900">{markedErrorMessage}</Text>
        </View>
      ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
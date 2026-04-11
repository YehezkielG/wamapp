import { ScrollView, View } from 'react-native';

export default function SettingsSkeleton() {
  return (
    <ScrollView className="flex-1 bg-transparent" contentContainerClassName="px-4 pt-8 pb-12">
      {/* Header skeleton */}
      <View className="mb-4 h-8 w-28 rounded-lg bg-white/20" />
      <View className="mb-6 h-4 w-48 rounded-md bg-white/20" />

      {/* Settings items skeleton */}
      <View className="rounded-2xl border border-white/25 bg-white/10 p-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <View key={i} className={`flex-row items-center justify-between rounded-xl px-3 py-3 ${i !== 3 ? 'mb-2 bg-white/10' : 'bg-white/10'}`}>
            <View className="flex-row items-center gap-2">
              <View className="h-5 w-5 rounded-full bg-white/20" />
              <View className="h-4 w-32 rounded-md bg-white/20" />
            </View>
            <View className="h-4 w-6 rounded-md bg-white/20" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

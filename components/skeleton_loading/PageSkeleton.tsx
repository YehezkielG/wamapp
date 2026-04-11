import { ScrollView, View } from 'react-native';

export default function PageSkeleton() {
  return (
    <ScrollView className="flex-1 bg-transparent" contentContainerClassName="px-4 pt-6 pb-12">
      {/* Header skeleton */}
      <View className="mb-4 h-8 w-32 rounded-lg bg-white/20" />
      <View className="mb-6 h-4 w-48 rounded-md bg-white/20" />

      {/* Content cards skeleton */}
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} className="mb-4 rounded-2xl border border-white/15 bg-white/10 p-4">
          <View className="mb-3 h-4 w-24 rounded-md bg-white/20" />
          <View className="mb-2 h-3 w-full rounded-md bg-white/20" />
          <View className="mb-2 h-3 w-5/6 rounded-md bg-white/20" />
          <View className="h-3 w-4/5 rounded-md bg-white/20" />
        </View>
      ))}
    </ScrollView>
  );
}

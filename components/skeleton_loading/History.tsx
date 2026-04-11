import { ScrollView, View } from 'react-native';

export default function HistorySkeleton() {
  return (
    <ScrollView className="flex-1 bg-transparent" contentContainerClassName="px-4 pt-8 pb-12">
      <View className="mb-4 rounded-2xl border border-white/25 bg-white/10 p-4">
        <View className="mb-2 h-6 w-28 rounded-md bg-white/20" />
        <View className="h-3 w-48 rounded-md bg-white/20" />

        <View className="mt-3 flex-row items-center gap-3">
          <View className="h-8 w-32 rounded-full bg-white/20" />
          <View className="h-8 w-20 rounded-full bg-white/20" />
        </View>
      </View>

      <View className="mb-3 h-3 w-56 rounded-md bg-white/20" />

      {Array.from({ length: 5 }).map((_, index) => (
        <View
          key={index}
          className="mb-3 rounded-2xl border border-white/20 bg-white/10 px-3 py-3">
          <View className="mb-2 flex-row items-center justify-between">
            <View className="h-4 w-28 rounded-md bg-white/20" />
            <View className="h-3 w-20 rounded-md bg-white/20" />
          </View>
          <View className="mb-2 h-3 w-20 rounded-md bg-white/20" />
          <View className="h-3 w-full rounded-md bg-white/20" />
          <View className="mt-2 h-3 w-5/6 rounded-md bg-white/20" />
        </View>
      ))}
    </ScrollView>
  );
}
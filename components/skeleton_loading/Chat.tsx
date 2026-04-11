import { ScrollView, View } from 'react-native';

export default function ChatSkeleton() {
  return (
    <ScrollView className="flex-1 bg-transparent" contentContainerClassName="px-4 pt-3 pb-12">
      {/* Header skeleton */}
      <View className="mx-0 mb-4 rounded-2xl border border-white/30 bg-white/12 px-4 py-4">
        <View className="mb-2 h-5 w-24 rounded-md bg-white/20" />
        <View className="h-3 w-full rounded-md bg-white/20" />
        <View className="mt-1 h-3 w-5/6 rounded-md bg-white/20" />
      </View>

      {/* Chat messages skeleton */}
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} className={`mb-2 flex-row ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
          <View
            className={`max-w-[70%] rounded-2xl p-3 ${
              i % 2 === 0 ? 'rounded-tr-sm bg-white/30' : 'rounded-tl-sm bg-white/15'
            }`}>
            {Array.from({ length: 2 }).map((_, j) => (
              <View key={j} className={`h-3 rounded-md bg-white/20 ${j > 0 ? 'mt-2' : ''}`} style={{ width: 100 + Math.random() * 80 }} />
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

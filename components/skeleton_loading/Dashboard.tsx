import { ScrollView, View } from 'react-native';

export default function DashboardSkeleton() {
  return (
    <ScrollView className="flex-1 bg-transparent" contentContainerClassName="px-6 pt-14 pb-12">
      <View className="h-9 w-48 self-center rounded-lg bg-white/20" />
      <View className="mt-4 h-6 w-64 self-center rounded-md bg-white/20" />
      <View className="mt-2 h-10 w-32 self-center rounded-md bg-white/20" />

      <View className="mt-6 flex-row items-center justify-center gap-3">
        <View className="h-16 w-32 rounded-xl bg-white/20" />
        <View className="h-10 w-24 rounded-full bg-white/20" />
      </View>

      <View className="mt-5 h-12 w-52 self-center rounded-full bg-white/20" />

      <View className="mt-8 h-7 w-40 rounded-md bg-white/20" />
      <View className="mt-3 flex-row flex-wrap justify-between gap-y-3">
        <View className="h-20 w-[48%] rounded-2xl border border-white/25 bg-white/20" />
        <View className="h-20 w-[48%] rounded-2xl border border-white/25 bg-white/20" />
        <View className="h-20 w-[48%] rounded-2xl border border-white/25 bg-white/20" />
        <View className="h-20 w-[48%] rounded-2xl border border-white/25 bg-white/20" />
      </View>
    </ScrollView>
  );
}
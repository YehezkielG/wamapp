import React from 'react';
import { ScrollView, Text, View } from 'react-native';

export default function Forecast12HoursSkeleton() {
  return (
    <View className="mt-8 w-full">
      <Text className="text-2xl font-bold text-white/90">Next 12 Hours</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3"
        contentContainerClassName="gap-3 pr-2">
        {Array.from({ length: 12 }).map((_, idx) => (
          <View
            key={idx}
            className="w-24 rounded-2xl p-3 border border-white/20 bg-white/10"
            style={{ opacity: 0.9 }}>
            <View className="h-3 w-16 rounded-md bg-white/20" />
            <View className="mt-3 h-6 w-10 rounded-full bg-white/20" />
            <View className="mt-2 h-4 w-16 rounded-md bg-white/20" />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

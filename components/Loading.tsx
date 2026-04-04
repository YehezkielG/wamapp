import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

type Props = {
  message?: string;
};

export default function Loading({ message = 'Loading...' }: Props) {
  return (
    <View className="flex-1 items-center justify-center bg-transparent p-4">
      <ActivityIndicator size="large" color="#2563eb" />
      <Text className="mt-3 text-base text-gray-900">{message}</Text>
    </View>
  );
}

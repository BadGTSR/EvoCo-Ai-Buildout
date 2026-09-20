// EvoCo Timesheet App — Navigation Stack
// Flow: login → today's entries (home) → project → stage → time log → back
// to today's entries. "My Requests" is reachable from there at any point.
//
// Site check-in (QR scan, H&S questionnaire, geofenced attendance) has been
// removed for now — it'll come back as its own dedicated H&S feature later.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

import LoginScreen from '../screens/LoginScreen';
import ProjectSelectorScreen from '../screens/ProjectSelectorScreen';
import StageSelectorScreen from '../screens/StageSelectorScreen';
import TimeLogScreen from '../screens/TimeLogScreen';
import DailySummaryScreen from '../screens/DailySummaryScreen';
import MyRequestsScreen from '../screens/MyRequestsScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: '#fff',
  headerTitleStyle: { color: '#fff' },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <Stack.Screen name="AppLogin" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          // Today's entries is home; logging time against projects/stages
          // always cycles back to it.
          <>
            <Stack.Screen name="DailySummary" component={DailySummaryScreen} options={{ title: "Today's Entries", headerBackVisible: false }} />
            <Stack.Screen name="ProjectSelector" component={ProjectSelectorScreen} options={{ title: 'Select Project' }} />
            <Stack.Screen name="StageSelector" component={StageSelectorScreen} options={{ title: 'Select Stage' }} />
            <Stack.Screen name="TimeLog" component={TimeLogScreen} options={{ title: 'Log Time' }} />
            <Stack.Screen name="MyRequests" component={MyRequestsScreen} options={{ title: 'My Requests' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

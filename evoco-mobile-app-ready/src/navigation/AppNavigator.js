// EvoCo Timesheet App — Navigation Stack
// Flow: QR scan → H&S questionnaire → check-in confirmed → login →
//       dashboard → project → stage → time log → daily summary
// "My Requests" is reachable from the dashboard at any point.

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

import QrScanScreen from '../screens/QrScanScreen';
import HsQuestionnaireScreen from '../screens/HsQuestionnaireScreen';
import CheckInConfirmedScreen from '../screens/CheckInConfirmedScreen';
import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
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
          // Pre-auth flow: on-site check-in doesn't require an app login
          <>
            <Stack.Screen name="QrScan" component={QrScanScreen} options={{ title: 'Scan Site QR' }} />
            <Stack.Screen name="HsQuestionnaire" component={HsQuestionnaireScreen} options={{ title: 'Site Check-In' }} />
            <Stack.Screen name="CheckInConfirmed" component={CheckInConfirmedScreen} options={{ headerShown: false }} />
            <Stack.Screen name="AppLogin" component={LoginScreen} options={{ headerShown: false }} />
          </>
        ) : (
          // Authenticated flow: logging time against projects and stages
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Today', headerBackVisible: false }} />
            <Stack.Screen name="ProjectSelector" component={ProjectSelectorScreen} options={{ title: 'Select Project' }} />
            <Stack.Screen name="StageSelector" component={StageSelectorScreen} options={{ title: 'Select Stage' }} />
            <Stack.Screen name="TimeLog" component={TimeLogScreen} options={{ title: 'Log Time' }} />
            <Stack.Screen name="DailySummary" component={DailySummaryScreen} options={{ title: "Today's Entries" }} />
            <Stack.Screen name="MyRequests" component={MyRequestsScreen} options={{ title: 'My Requests' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

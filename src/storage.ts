import AsyncStorage from '@react-native-async-storage/async-storage';
import { State, starter } from './model';

const KEY = '@pian_ke/v1';
export async function load(): Promise<State> {
  const saved = await AsyncStorage.getItem(KEY);
  if (!saved) return starter;
  try {
    const value = JSON.parse(saved);
    if (Array.isArray(value.plans) && Array.isArray(value.sessions)) return value as State;
  } catch { /* Corrupt local state starts fresh; caller may still export on next save. */ }
  return starter;
}
export async function save(state: State) { await AsyncStorage.setItem(KEY, JSON.stringify(state)); }
export async function clear() { await AsyncStorage.removeItem(KEY); }

// ローカルストレージキー
export const STORAGE_KEYS = {
  SHIFTS: 'jatrack_shifts',
  STAFF: 'jatrack_staff',
  SYMBOLS: 'jatrack_symbols',
  LOCATIONS: 'jatrack_locations'
};

// 型定義
export interface Staff {
  id: number;
  staff_name: string;
}

export interface Symbol {
  id: number;
  symbol_name: string;
  symbol_color: string;
}

export interface Location {
  id: number;
  location_name: string;
}

export interface Shift {
  id: number;
  shift_date: string;
  staff_id: number;
  symbol_id: number | null;
  location_id: number | null;
}

// ローカルストレージから取得
export function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error getting ${key} from localStorage:`, error);
    return defaultValue;
  }
}

// ローカルストレージに保存
export function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving ${key} to localStorage:`, error);
  }
}

// 新しいIDを生成（単純な実装）
export function generateId(items: { id: number }[]): number {
  return items.length > 0 
    ? Math.max(...items.map(item => item.id)) + 1 
    : 1;
}

// 初期データ
export const defaultShifts: Shift[] = [];

export const defaultStaff: Staff[] = [
  { id: 1, staff_name: '山田 太郎' },
  { id: 2, staff_name: '佐藤 花子' },
  { id: 3, staff_name: '鈴木 一郎' }
];

export const defaultSymbols: Symbol[] = [
  { id: 1, symbol_name: '成田969', symbol_color: '#3B82F6' },
  { id: 2, symbol_name: '富里802', symbol_color: '#16A34A' },
  { id: 3, symbol_name: '楽々パーキング', symbol_color: '#CA8A04' },
  { id: 4, symbol_name: '成田969植栽管理', symbol_color: '#DC2626' },
  { id: 5, symbol_name: '稲毛長沼', symbol_color: '#7C3AED' },
  { id: 6, symbol_name: 'その他', symbol_color: '#BE185D' }
];

export const defaultLocations: Location[] = [
  { id: 1, location_name: '成田市' },
  { id: 2, location_name: '富里市' },
  { id: 3, location_name: '千葉市' }
];

// シフトデータの取得
export function getShifts(): Shift[] {
  return getFromStorage<Shift[]>(STORAGE_KEYS.SHIFTS, defaultShifts);
}

// スタッフデータの取得
export function getStaff(): Staff[] {
  return getFromStorage<Staff[]>(STORAGE_KEYS.STAFF, defaultStaff);
}

// シンボルデータの取得
export function getSymbols(): Symbol[] {
  return getFromStorage<Symbol[]>(STORAGE_KEYS.SYMBOLS, defaultSymbols);
}

// 勤務地データの取得
export function getLocations(): Location[] {
  return getFromStorage<Location[]>(STORAGE_KEYS.LOCATIONS, defaultLocations);
}

// シフトデータの保存
export function saveShift(shift: Omit<Shift, 'id'>): Shift {
  const shifts = getShifts();
  const newShift = { ...shift, id: generateId(shifts) };
  
  shifts.push(newShift);
  saveToStorage(STORAGE_KEYS.SHIFTS, shifts);
  
  return newShift;
}

// シフトデータの更新
export function updateShift(updatedShift: Shift): Shift {
  const shifts = getShifts();
  const index = shifts.findIndex(shift => shift.id === updatedShift.id);
  
  if (index !== -1) {
    shifts[index] = updatedShift;
    saveToStorage(STORAGE_KEYS.SHIFTS, shifts);
  }
  
  return updatedShift;
}

// シフトデータの削除
export function deleteShift(id: number): void {
  const shifts = getShifts();
  const filteredShifts = shifts.filter(shift => shift.id !== id);
  saveToStorage(STORAGE_KEYS.SHIFTS, filteredShifts);
}

// スタッフデータを保存
export function saveStaff(staff: Omit<Staff, 'id'>): Staff {
  const staffList = getStaff();
  const newStaff = { ...staff, id: generateId(staffList) };
  
  staffList.push(newStaff);
  saveToStorage(STORAGE_KEYS.STAFF, staffList);
  
  return newStaff;
}

// シンボルデータを保存
export function saveSymbol(symbol: Omit<Symbol, 'id'>): Symbol {
  const symbols = getSymbols();
  const newSymbol = { ...symbol, id: generateId(symbols) };
  
  symbols.push(newSymbol);
  saveToStorage(STORAGE_KEYS.SYMBOLS, symbols);
  
  return newSymbol;
}

// 勤務地データを保存
export function saveLocation(location: Omit<Location, 'id'>): Location {
  const locations = getLocations();
  const newLocation = { ...location, id: generateId(locations) };
  
  locations.push(newLocation);
  saveToStorage(STORAGE_KEYS.LOCATIONS, locations);
  
  return newLocation;
} 
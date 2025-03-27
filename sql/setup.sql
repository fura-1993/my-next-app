-- 従業員テーブル
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  given_name TEXT
);

-- シフトタイプテーブル
CREATE TABLE IF NOT EXISTS shift_types (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  color TEXT NOT NULL,
  hours TEXT
);

-- 既存のシフトセルテーブルが存在しない場合は作成
CREATE TABLE IF NOT EXISTS shift_cells (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  date DATE NOT NULL,
  shift_code TEXT NOT NULL,
  UNIQUE(employee_id, date)
);

-- デフォルトのシフトタイプを登録（既存のデータがない場合）
INSERT INTO shift_types (code, label, color, hours)
SELECT '成', '成田969', '#3B82F6', '12:00-17:00'
WHERE NOT EXISTS (SELECT 1 FROM shift_types WHERE code = '成');

INSERT INTO shift_types (code, label, color, hours)
SELECT '富', '富里802', '#16A34A', '9:00-17:30'
WHERE NOT EXISTS (SELECT 1 FROM shift_types WHERE code = '富');

INSERT INTO shift_types (code, label, color, hours)
SELECT '楽', '楽々パーキング', '#CA8A04', '8:00-12:00'
WHERE NOT EXISTS (SELECT 1 FROM shift_types WHERE code = '楽');

INSERT INTO shift_types (code, label, color, hours)
SELECT '植', '成田969植栽管理', '#DC2626', '13:00-18:00'
WHERE NOT EXISTS (SELECT 1 FROM shift_types WHERE code = '植');

INSERT INTO shift_types (code, label, color, hours)
SELECT '長', '稲毛長沼', '#7C3AED', '9:00-17:00'
WHERE NOT EXISTS (SELECT 1 FROM shift_types WHERE code = '長');

INSERT INTO shift_types (code, label, color, hours)
SELECT '他', 'その他', '#BE185D', '9:00-18:00'
WHERE NOT EXISTS (SELECT 1 FROM shift_types WHERE code = '他');

-- デフォルトの従業員を登録（既存のデータがない場合）
INSERT INTO employees (id, name, given_name)
SELECT 1, '橋本', NULL
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE id = 1);

INSERT INTO employees (id, name, given_name)
SELECT 2, '棟方', NULL
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE id = 2);

INSERT INTO employees (id, name, given_name)
SELECT 3, '薄田', NULL
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE id = 3);

INSERT INTO employees (id, name, given_name)
SELECT 4, '小林', '広睴'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE id = 4);

INSERT INTO employees (id, name, given_name)
SELECT 5, '梶', NULL
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE id = 5);

INSERT INTO employees (id, name, given_name)
SELECT 6, '寺田', NULL
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE id = 6);

INSERT INTO employees (id, name, given_name)
SELECT 7, '山崎', NULL
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE id = 7);

INSERT INTO employees (id, name, given_name)
SELECT 8, '小林', '利治' 
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE id = 8); 
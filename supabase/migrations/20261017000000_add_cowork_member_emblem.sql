/*
  # 名前の横のバッジ(称号)を Cowork の仲間にも見せる

  ユーザーが設定で選んだバッジ(実績の id)は auth の user_metadata.emblem に持つ。
  仲間には auth のデータが見えないので、cowork_members に同じ値を写しておく。
  書くのは本人(既存の UPDATE ポリシー: 自分の行)。読むのは同じグループの承認済みメンバー(既存の SELECT ポリシー)。
*/

ALTER TABLE cowork_members ADD COLUMN IF NOT EXISTS emblem text;

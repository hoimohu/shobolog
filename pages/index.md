---
layout: home
title: ホームページ
author: hoimohu/ShoboiNamae
date: 2026/05/24
lastUpdate: 2026/05/26
tags:
- home
---

# 最近の更新

:::aiscript
let pages = {{pageList}}
var count = 0
each let v, pages {
  if v.path != "/" {
    <: `* { v.lastUpdate } - [{ v.title }]({ v.path }){ Str:lf }`
  }
  if count >= 20 break
  count = count + 1
}
:::

---
layout: pure
title: 全てのページ
author: hoimohu/ShoboiNamae
date: 2026/05/26
lastUpdate: 2026/07/10
tags:
- all
- ignore-all
---

# 全てのページ

:::aiscript
let pages = {{pageList}}
each let v, pages {
  if !v.tags.incl("ignore-all") {
    <: `* { v.lastUpdate } - [{ v.title }]({ v.path }){ Str:lf }`
  }
}
:::

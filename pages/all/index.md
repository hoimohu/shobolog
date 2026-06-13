---
layout: default
title: 全てのページ
author: hoimohu/ShoboiNamae
date: 2026/05/26
tags:
- all
---

:::aiscript
let pages = {{pageList}}
each let v, pages {
  <: `* { v.lastUpdate } - [{ v.title }]({ v.path }){ Str:lf }`
}
:::

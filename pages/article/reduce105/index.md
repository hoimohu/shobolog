---
layout: default
title: 百五減算
author: hoimohu/ShoboiNamae
date: 2026/05/28
tags:
- article
- 数学
- 記事3
---

# 内容

$105$ 未満の整数 $x$ について  
$x$ を $3$ で割ったあまりが $a$,  
$x$ を $5$ で割ったあまりが $b$,  
$x$ を $7$ で割ったあまりが $c$ と分かっているとき、  
$x$ は $70a + 21b + 15c$ の値から105未満になるまで105を引き続けることで求められる.

（つまり、$70a + 21b + 15c$ を $105$ で割ったあまりが $x$ ということ）


# 証明

ある整数 $x$ が、整数 $a, b, c$ について

$$
\begin{equation}
\begin{cases}
x \equiv a \mod 3 \\
x \equiv b \mod 5 \\
x \equiv c \mod 7
\end{cases}
\end{equation}
$$

を満たすとき、

$$
\begin{equation}
70a + 21b + 15c \equiv x \mod 105
\end{equation}
$$

が成り立つことを証明する。

まず$(1)$より, 整数 $\alpha, \beta, \gamma$ を用いて以下の式が成り立つ:

$$
\begin{cases}
x = 3\alpha + a \\
x = 5\beta + b \\
x = 7\gamma + c
\end{cases}
$$

ゆえに,

$$
\begin{equation}
\begin{cases}
a = x - 3\alpha \\
b = x - 5\beta \\
c = x - 7\gamma
\end{cases}
\end{equation}
$$

$70a + 21b + 15c$ の $a, b, c$ に $(3)$ の結果を代入すると,

$$
\begin{aligned}
70a + 21b + 15c = 70(x - 3\alpha) + 21(x - 5\beta) + 15(x - 7\gamma) \\
= 70x - 210\alpha + 21x - 105\beta + 15x - 105\gamma \\
= 106x - 210\alpha - 105\beta - 105\gamma \\
= x + 105(x - 2\alpha - \beta - \gamma) \\
\equiv x \mod 105
\end{aligned}
$$

したがって、 $(2)$ は成り立つ. (証明終わり)
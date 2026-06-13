---
layout: default
title: Codeforces 1103 (Div. 3) C問題 解法が証明できない...
author: hoimohu/ShoboiNamae
date: 2026/06/13
tags:
- article
- ブログ
- Codeforces
- 競プロ
- 記事6
---

[前記事はこちら](../cf1103c/)

[問題はこちら（codeforces）](https://codeforces.com/contest/2236/problem/C)

# 注意

証明できていません。

# 考えたこと

1足す操作よりも先にxで割る操作をしたほうが良いことの証明

整数 $t$ を操作することを考える。また、

P: $t$ に1を足す操作  
Q: $t$ を $x$ で割る操作

とする。

Pを先に行う場合を考える。  
Pを $n$ 回行った後にQを1回行った場合の操作後の値を $t'$ とすると、

$$
t' = \lfloor \frac{t + n}{x} \rfloor
$$

ここで、 $t = px + r_1, n = qx + r_2$ となるように $p, q, r_1, r_2$ を置く。（ $0 \le r_1 < x, 0 \le r_2 < x$ ）  
すると、

$$
\begin{aligned}
t' = \lfloor \frac{px + qx + r_1 + r_2}{x} \rfloor \\
= p + q + \lfloor \frac{r_1 + r_2}{x} \rfloor
\end{aligned}
$$

この場合、総操作回数は $n+1$ 回である。

次に、Pを後に行う場合を考える。  
Pを $m$ 回行う場合、操作後の値を $t''$とすると、

$$
\begin{aligned}
t'' = \lfloor \frac{t}{x} \rfloor + m\\
= p + \lfloor \frac{r_1}{x} \rfloor + m \\
= p + m
\end{aligned}
$$

この場合、総操作回数は $m + 1$ 回である。

上記の2つの手順を使って、同じ値にするためにかかる操作回数を比較する。  
すなわち、 $t' = t''$ の場合を考える。

$$
\begin{aligned}
t' = t'' \\
p + q + \lfloor \frac{r_1 + r_2}{x} \rfloor = p + m \\
\lfloor \frac{r_1 + n}{x} \rfloor = m
\end{aligned}
$$

よって、以下の式が成り立つ:

$$
mx \le r_1 + n < (m + 1)x 
$$

左の2辺より、

$$
mx - m - r_1 \le n - m
$$

ここから $m$ の値によって場合分けする。

(i) $m = 1$ の場合

$mx - m - r_1 \le n - m$ の $m$ に 1を代入する:

$$
x - r_1 - 1 \le n - m
$$

$0 \le r_1 < x$ であるから、

$$
\begin{aligned}
0 \le n - m \\
m \le n
\end{aligned}
$$

(ii) $m \ge 2$ の場合

$$
\begin{aligned}
mx - m - r_1 = (m - 1)x - m + (x - r_1) \\
\ge 2m - 2 - m + (x - r_1) \\
= (m - 2) + (x - r_1) \\
\ge 0
\end{aligned}
$$

よって、

$$
\begin{aligned}
0 \le mx - m - r_1 \le n - m \\
m \le n
\end{aligned}
$$

したがって、取りうるすべての $m$ に対して $m \le n$ が言えたので、Qを1回、Pを任意の回数行うときは、先にQを行った方がよいことが示された。

# 続き

Qを $s$ 回（ $2 \le s$ ）行うときは Q'を「 $t$ を $x^s$ で割る」という風に定義しなおせばいいかと思ったが、割るときに切り捨てが入るので完全に等しくできない？

あとPとQを交互に行うときはどう考えればいいのか？

# まとめ

証明が苦手すぎます。はい。

こういう時はこう証明するみたいな知見が全く足りていない状況なんですね。いろんな解説を読みまくるしかないか...

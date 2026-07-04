---
marp: true
theme: lab
paginate: true
---

<!-- _class: title -->

# lab-slides レイアウトカタログ デモ

<div class="meta">Haruki Sugimoto ・ ai-marketplace / lab-slides v0.1.0</div>

---

<!-- _class: toc -->

# 目次

1. 説明レイアウト
2. 比較・結果レイアウト
3. 研究特有レイアウト

---

<!-- _class: section -->
<!-- header: 説明レイアウト -->

# section: 章扉

---

## plain: 既定レイアウト(1枚1メッセージ)

- ここから上部に**現在章**が固定表示されている(header ディレクティブ)
- 見出しは体言止めでなく**主張文**で書く。箇条書きは最大5項目
- 数式は KaTeX: $\mathrm{Attn}(Q,K,V)=\mathrm{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right)V$

---

## two-col: 図と説明を並べる

<div class="cols w64">
<div>

![](https://placehold.co/720x460/f1ece1/8e2f3c?text=Architecture+Figure)

</div>
<div>

- 図が主役なら `w64` で左を広く
- 説明は短く、詳細は口頭で

</div>
</div>

---

<!-- _class: section -->
<!-- header: 比較・結果レイアウト -->

# 比較・結果レイアウト

---

<!-- _class: compare -->

## compare: ベースライン vs 提案手法

<div class="cols">
<div class="col baseline">

### Transformer (baseline)

- 推論: 120ms/token
- BLEU: 27.3

</div>
<div class="col proposed">

### 提案手法

- 推論: **43ms/token**
- BLEU: **28.1**

</div>
</div>

---

<!-- _class: figure-full -->

## figure-full: 提案手法が全条件でベースラインを上回る

![](https://placehold.co/900x480/f1ece1/8c8577?text=Main+Result+Graph)

<div class="caption">図1: ○○データセットでの精度比較(n=5, 平均±標準偏差)</div>

---

## metrics: 数値の大書き

<div class="metrics">
<div class="metric"><div class="value">-64%</div><div class="label">推論レイテンシ</div></div>
<div class="metric"><div class="value">+0.8</div><div class="label">BLEU</div></div>
<div class="metric"><div class="value">×1/3</div><div class="label">パラメータ数</div></div>
</div>

---

<!-- _class: section -->
<!-- header: 研究特有レイアウト -->

# 研究特有レイアウト

---

<!-- _class: discussion -->

# discussion: 議論したいこと

1. ○○の評価指標は△△で妥当か?
2. 実験規模を広げる前に□□を検証すべきか?

---

## takeaway: まとめ

- 段階生成(内容→デザインの2関門)で手戻りを最小化
- レイアウトは使うたびに `/catalog-add` で資産化

<div class="takeaway">スライドシステムは「作る」ものではなく「育てる」もの</div>

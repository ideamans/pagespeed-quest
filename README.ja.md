| [日本語](./README.ja.md) | [English](./README.md) |

# PageSpeed Quest

PageSpeed QuestはWebフロントエンドのスピード改善を支援するフレームワークです。

Webフロントエンドのスピード改善には、ボトルネックの解消をはじめ数多くの手法やアイデアがあります。しかし理論的に有効な手法をアプリケーションに実装しても、期待した成果が得られないことがよくあります。

PageSpeed Questを利用すると、事前にアイデアの仮説検証を速やかに繰り返し、効果のあるアイデアから優先的に実装できます。

## 仕組み

Web APIのモックツールである[VCR](https://github.com/vcr/vcr)をご存知の方は、それをWebページに拡張したものと解釈いただくとわかりやすいです。

[Lighthouse](https://developer.chrome.com/docs/lighthouse/overview/)をPageSpeed Questが提供するHTTPプロキシ経由で実行します。このHTTPプロキシは、WebサーバーとLighthouseを中継するのと同時に、Webページのリソースを静的ページのようなファイル群に変換して「録画」します。プロキシは高性能なRustベースのネイティブモジュール[rust-http-playback-proxy](https://github.com/ideamans/rust-http-playback-proxy)を使用しています。

![Recording](./docs/recording.png)

次からはWebサーバーにアクセスするのではなく、記録された静的ファイルを元にWebサーバーの応答を「再生」します。このときリソースごとのレイテンシーや通信速度もできるだけ再現します。

![Playback](./docs/playback.png)

この仕組みにより、アプリケーションを実際に改修するのではなく静的ファイル群を変更するだけで、計測結果にどのような影響があるかを速やかに試験できます。

## 使い方

Node JS 20以上が必要です。

### プロジェクトの作成

まずは仮説検証を進めるプロジェクトを作成します。ディレクトリ名は必要に応じて変更してください。

```sh
mkdir my-first-quest
cd my-first-quest
yarn init -y
yarn add pagespeed-quest -D
```

### Webページの記録

次のコマンドでLighthouseを実行し、計測に必要なファイルを記録します。URLは変更してください。

```sh
yarn psq lighthouse recording https://example.com/
```

`inventory`ディレクトリにファイルが作成されます。

- `inventory/index.json` リソース一覧とメタデータ
- `inventory/contents/[method]/[protocol]/[hostname]/[...path]` 各リソースの内容

これらのファイルを改変すると、次に解説する再生操作でLighthouseが受信するリソースやメタデータ、転送スピードを改変できます。

### Webページの再生と計測

次のコマンドでWebページを再生し、Lighthouseで計測します。

```sh
yarn psq lighthouse playback
```

レポートページが自動で表示されます。レポートファイル等は`artifacts`ディレクトリに作成されます。

### loadshowによる読み込み過程の動画の作成

次の`loadshow`サブコマンドを使うと、[loadshow](https://github.com/ideamans/go-loadshow)を用い、再生したWebページの読み込み過程を動画として出力できます。

```sh
yarn psq loadshow playback
```

動画は`artifacts/loadshow.mp4`として出力されます。

また、Webページの記録においてもloadshowを利用できます。

```sh
yarn psq loadshow recording https://example.com/
```

Lighthouseとloadshowでは、Webページの読み込みに関するブラウザの挙動が少し違います。

動画によるスピード改善の確認が主な目的である場合は、`loadshow recording`サブコマンドを利用することを推奨します。

### スクリーンショットの撮影とビジュアル比較

`capture`サブコマンドを使うと、再生ページのスクリーンショットを撮影できます。再生プロキシをフルスロットルモード（タイミング制御なし）で起動し、[static-webshot](https://github.com/ideamans/static-webshot)でスクリーンショットを取得します。スクリーンショットは400x1600のビューポートで描画し、200x800にリサイズされます。

```sh
yarn psq capture
```

スクリーンショットは`artifacts/capture.png`として保存されます。

前回のスクリーンショットと比較するには、`--compare`でベースライン画像を指定します。

```sh
yarn psq capture --compare baseline.png
```

差分画像が`artifacts/capture-diff.png`に、サマリーが`artifacts/capture-diff.txt`に出力されます。ラベルは`--baseline-label`と`--current-label`でカスタマイズできます。

```sh
yarn psq capture --compare baseline.png --baseline-label "変更前" --current-label "変更後"
```

## プロキシの起動

### 再生モード

次のコマンドでWebページを再生するプロキシを起動できます。

```sh
yarn psq proxy -p 8080
```

プロキシはinventoryディレクトリの変更を監視し、ファイルが更新されると自動的に再起動します。

### 録画モード

`--record`オプションでURLを指定すると、録画モードでプロキシを起動できます。

```sh
yarn psq proxy -p 8080 --record https://example.com/
```

`Ctrl+C`で録画を停止し、inventoryを保存します。

### ブラウザでの利用

通常のブラウザのHTTPプロキシに`http://localhost:8080`を設定することで、開発者ツールでパフォーマンスタイムラインを詳しく観察できます。

ただし、このHTTPプロキシはダミーのSSL証明書を用いるため、ブラウザのSSL証明書エラーチェックは無効にしてください。たとえばmacOSであれば、次のコマンドでSSL証明書のエラーチェックを無効としてHTTPプロキシを`http://localhost:8080`としたChromeを起動できます。

```sh
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --ignore-certificate-errors --proxy-server=http://localhost:8080
```

## 開発環境の共有やトレーニングにも

PageSpeed Questは、Webアプリケーションのリリースを必要としないスピーディーな仮説検証以外にも有用です。

- `第三者の協力` 第三者の協力を得るとき、開発環境の共有が難しい場合があります。Webフロントエンドの仮想的な開発環境を容易に共有できます。
- `トレーニング` 自身のサイトに限らず、あらゆるWebページを題材にWebフロントエンドのスピード改善をトレーニングできます。

## 連絡先

技術サポートやビジネス利用に関しては <contact@ideamans.com> まで連絡ください。

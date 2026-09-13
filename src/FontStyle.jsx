
import React, { useMemo, useState } from "react";
import { Copy, Check, Sparkles } from "lucide-react";

const ASCII_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ASCII_LOWER = "abcdefghijklmnopqrstuvwxyz";
const ASCII_DIGITS = "0123456789";

const ranges = (upperStart, lowerStart, digitStart = null) => {
  const map = {};
  [...ASCII_UPPER].forEach((char, index) => {
    map[char] = String.fromCodePoint(upperStart + index);
  });
  [...ASCII_LOWER].forEach((char, index) => {
    map[char] = String.fromCodePoint(lowerStart + index);
  });
  if (digitStart !== null) {
    [...ASCII_DIGITS].forEach((char, index) => {
      map[char] = String.fromCodePoint(digitStart + index);
    });
  }
  return map;
};

const withOverrides = (map, overrides) => ({ ...map, ...overrides });

const STYLES = [
  {
    id: "script",
    name: "筆記体",
    map: withOverrides(ranges(0x1d49c, 0x1d4b6), {
      B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ",
      e: "ℯ", g: "ℊ", o: "ℴ"
    })
  },
  {
    id: "bold-script",
    name: "太字筆記体",
    map: ranges(0x1d4d0, 0x1d4ea)
  },
  {
    id: "fraktur",
    name: "フラクトゥール",
    map: withOverrides(ranges(0x1d504, 0x1d51e), {
      C: "ℭ", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ"
    })
  },
  {
    id: "bold-fraktur",
    name: "太字フラクトゥール",
    map: ranges(0x1d56c, 0x1d586)
  },
  {
    id: "double-struck",
    name: "二重線",
    map: withOverrides(ranges(0x1d538, 0x1d552, 0x1d7d8), {
      C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ"
    })
  },
  {
    id: "bold",
    name: "太字",
    map: ranges(0x1d400, 0x1d41a, 0x1d7ce)
  },
  {
    id: "italic",
    name: "斜体",
    map: withOverrides(ranges(0x1d434, 0x1d44e), { h: "ℎ" })
  },
  {
    id: "bold-italic",
    name: "太字斜体",
    map: ranges(0x1d468, 0x1d482)
  },
  {
    id: "sans",
    name: "サンセリフ",
    map: ranges(0x1d5a0, 0x1d5ba, 0x1d7e2)
  },
  {
    id: "sans-bold",
    name: "サンセリフ太字",
    map: ranges(0x1d5d4, 0x1d5ee, 0x1d7ec)
  },
  {
    id: "sans-italic",
    name: "サンセリフ斜体",
    map: ranges(0x1d608, 0x1d622)
  },
  {
    id: "sans-bold-italic",
    name: "サンセリフ太字斜体",
    map: ranges(0x1d63c, 0x1d656)
  },
  {
    id: "monospace",
    name: "等幅",
    map: ranges(0x1d670, 0x1d68a, 0x1d7f6)
  },
  {
    id: "circled",
    name: "丸囲み",
    map: {
      ...Object.fromEntries([...ASCII_UPPER].map((char, i) => [char, String.fromCodePoint(0x24b6 + i)])),
      ...Object.fromEntries([...ASCII_LOWER].map((char, i) => [char, String.fromCodePoint(0x24d0 + i)])),
      "0": "⓪", "1": "①", "2": "②", "3": "③", "4": "④",
      "5": "⑤", "6": "⑥", "7": "⑦", "8": "⑧", "9": "⑨"
    }
  },
  {
    id: "negative-circled",
    name: "黒丸囲み",
    map: {
      ...Object.fromEntries([...ASCII_UPPER].map((char, i) => [char, String.fromCodePoint(0x1f150 + i)])),
      ...Object.fromEntries([...ASCII_LOWER].map((char, i) => [char, String.fromCodePoint(0x1f150 + i)]))
    }
  },
  {
    id: "squared",
    name: "四角囲み",
    map: {
      ...Object.fromEntries([...ASCII_UPPER].map((char, i) => [char, String.fromCodePoint(0x1f130 + i)])),
      ...Object.fromEntries([...ASCII_LOWER].map((char, i) => [char, String.fromCodePoint(0x1f130 + i)]))
    }
  },
  {
    id: "negative-squared",
    name: "黒四角囲み",
    map: {
      ...Object.fromEntries([...ASCII_UPPER].map((char, i) => [char, String.fromCodePoint(0x1f170 + i)])),
      ...Object.fromEntries([...ASCII_LOWER].map((char, i) => [char, String.fromCodePoint(0x1f170 + i)]))
    }
  },
  {
    id: "fullwidth",
    name: "全角",
    map: {
      ...Object.fromEntries([...ASCII_UPPER].map((char, i) => [char, String.fromCodePoint(0xff21 + i)])),
      ...Object.fromEntries([...ASCII_LOWER].map((char, i) => [char, String.fromCodePoint(0xff41 + i)])),
      ...Object.fromEntries([...ASCII_DIGITS].map((char, i) => [char, String.fromCodePoint(0xff10 + i)]))
    }
  }
];

const convert = (text, map) => [...text].map((char) => map[char] ?? char).join("");

export default function UnicodeDecorativeTextConverter() {
  const [input, setInput] = useState("");
  const [source, setSource] = useState("");
  const [copiedId, setCopiedId] = useState(null);

  const outputs = useMemo(
    () => STYLES.map((style) => ({ ...style, value: convert(source, style.map) })),
    [source]
  );

  const handleConvert = () => setSource(input);

  const handleCopy = async (id, value) => {
    await navigator.clipboard.writeText(value);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1200);
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7">
          <div className="mb-2 flex items-center gap-2 text-indigo-700">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-wide">UNICODE TEXT CONVERTER</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Unicode装飾文字コンバーター</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            英字と数字の変換可能な部分だけを装飾文字に置き換え、全スタイルを一覧表示します。
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <label htmlFor="source-text" className="mb-2 block text-sm font-semibold text-slate-700">
            変換するテキスト
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="source-text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleConvert();
              }}
              placeholder="例: ABC hello 123 日本語"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
            <button
              type="button"
              onClick={handleConvert}
              className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 active:translate-y-px"
            >
              変換
            </button>
          </div>
        </section>

        {source ? (
          <section className="mt-6 grid gap-4 md:grid-cols-2">
            {outputs.map((output) => (
              <article key={output.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-600">{output.name}</h2>
                  <button
                    type="button"
                    onClick={() => handleCopy(output.id, output.value)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    aria-label={`${output.name}をコピー`}
                  >
                    {copiedId === output.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedId === output.id ? "コピー済み" : "コピー"}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={output.value}
                  rows={3}
                  onFocus={(event) => event.currentTarget.select()}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-lg leading-7 text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  aria-label={`${output.name}の変換結果`}
                />
              </article>
            ))}
          </section>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center text-slate-500">
            テキストを入力して「変換」を押すと、すべての変換結果がここに表示されます。
          </div>
        )}
      </div>
    </main>
  );
}


import "./FontStyle.css";
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

export default function UnicodeDecorativeTextConverter({ setView }) {
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
    <div className="app">
      <button type="button" className="back-button" onClick={() => setView('title')}>
        ← 戻る
      </button>

      <h1>Unicode装飾文字コンバーター</h1>
      <p className="hint">英字と数字の変換可能な部分だけを装飾文字に置き換え、全スタイルを一覧表示します。</p>

      <div className="controls">
        <input
          id="source-text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleConvert();
          }}
          placeholder="例: ABC hello 123 日本語"
          className="input-field"
        />
        <button
          type="button"
          onClick={handleConvert}
          className="button"
        >
          変換
        </button>
      </div>

      {source ? (
        <div className="results">
          {outputs.map((output) => (
            <div key={output.id} className="result-item">
              <div className="result-header">
                <h2>{output.name}</h2>
                <button
                  type="button"
                  onClick={() => handleCopy(output.id, output.value)}
                  className="copy-button"
                  aria-label={`${output.name}をコピー`}
                >
                  {copiedId === output.id ? <Check className="icon" /> : <Copy className="icon" />}
                  {copiedId === output.id ? "コピー済み" : "コピー"}
                </button>
              </div>
              <textarea
                readOnly
                value={output.value}
                rows={1}
                onFocus={(event) => event.currentTarget.select()}
                className="result-textarea"
                aria-label={`${output.name}の変換結果`}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="placeholder-box">
          テキストを入力して「変換」を押すと、すべての変換結果がここに表示されます。
        </div>
      )}
    </div>
  );
}

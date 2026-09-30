import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeGif } from './gif';
import './GifMaker.css';

const IMAGE_WINDOW_WIDTH = 500;
const IMAGE_WINDOW_HEIGHT = 500;
const GUIDE_COLOR_INTERVAL_MS = 120;

const DEFAULT_PATTERN_COUNT = 8;
const DEFAULT_LINE_COUNT = 60;
const DEFAULT_DELAY_MS = 120;

const fitSize = (w, h) => {
  const scale = Math.min(IMAGE_WINDOW_WIDTH / w, IMAGE_WINDOW_HEIGHT / h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)), scale };
};

/** 1パターン分の集中線を描画する */
const drawSpeedLines = (
  ctx,
  canvasWidth,
  canvasHeight,
  ellipse,
  lineCount
) => {
  const { cx, cy, rx, ry } = ellipse;

  // 画像の四隅まで三角形が届くように外側の倍率を決める
  let outer = 1;
  const corners = [
    { x: 0, y: 0 },
    { x: canvasWidth, y: 0 },
    { x: 0, y: canvasHeight },
    { x: canvasWidth, y: canvasHeight },
  ];
  for (const c of corners) {
    const k = Math.max(Math.abs(c.x - cx) / rx, Math.abs(c.y - cy) / ry);
    if (k > outer) outer = k;
  }
  outer *= 1.6;

  let theta = Math.random() * Math.PI * 2;
  const meanGap = (Math.PI * 2) / lineCount;

  for (let i = 0; i < lineCount; i++) {
    // 頂点の角度幅（三角形の太さ）をばらつかせる
    const halfWidth = meanGap * (0.05 + Math.random() * 0.15);
    // 先端が楕円の内外で少し揺れるようにする
    const apexScale = 0.94 + Math.random() * 0.1;

    const apex = {
      x: cx + rx * apexScale * Math.cos(theta),
      y: cy + ry * apexScale * Math.sin(theta),
    };
    const base1 = {
      x: cx + rx * outer * Math.cos(theta - halfWidth),
      y: cy + ry * outer * Math.sin(theta - halfWidth),
    };
    const base2 = {
      x: cx + rx * outer * Math.cos(theta + halfWidth),
      y: cy + ry * outer * Math.sin(theta + halfWidth),
    };

    const alpha = Math.random();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(base1.x, base1.y);
    ctx.lineTo(base2.x, base2.y);
    ctx.closePath();
    ctx.fill();

    theta += meanGap * (0.4 + Math.random() * 1.2);
  }
};

/** 入力中の空欄を許容する数値入力欄。確定した値は入力欄を離れたときに反映する */
const NumberField = ({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}) => {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // 外部から値が変わったときは、編集中でなければ表示を同期する
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const handleChange = (text) => {
    setDraft(text);
    if (text.trim() === '') return; // 空欄はそのまま保持し、確定処理は行わない
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return;
    if (parsed < min || parsed > max) return; // 入力途中の範囲外は確定させない
    onCommit(parsed);
  };

  const handleBlur = () => {
    setEditing(false);
    const parsed = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setDraft(String(value)); // 空欄のまま離れたら直前の値へ戻す
      return;
    }
    const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
    onCommit(clamped);
    setDraft(String(clamped));
  };

  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setEditing(true)}
        onBlur={handleBlur}
      />
    </label>
  );
};

const GifMaker = ({ setView }) => {
  const canvasRef = useRef(null);
  const [image, setImage] = useState(null);
  const [display, setDisplay] = useState({ width: IMAGE_WINDOW_WIDTH, height: IMAGE_WINDOW_HEIGHT, scale: 1 });
  const [phase, setPhase] = useState('noImage');
  const [center, setCenter] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [ellipse, setEllipse] = useState(null);
  const [patternCount, setPatternCount] = useState(DEFAULT_PATTERN_COUNT);
  const [lineCount, setLineCount] = useState(DEFAULT_LINE_COUNT);
  const [delayMs, setDelayMs] = useState(DEFAULT_DELAY_MS);
  const [gifUrl, setGifUrl] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [guideColor, setGuideColor] = useState('rgb(0, 200, 255)');

  // ドラッグ中はガイド線の色を一定間隔でランダムに変える
  useEffect(() => {
    if (phase !== 'waitEdge') return;
    const timer = window.setInterval(() => {
      const hue = Math.floor(Math.random() * 360);
      setGuideColor(`hsl(${hue}, 100%, 55%)`);
    }, GUIDE_COLOR_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [phase]);

  // 表示用キャンバスの再描画（元画像 + 楕円ガイド）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!image) return;
    ctx.drawImage(image, 0, 0, display.width, display.height);

    const guide =
      ellipse ??
      (center && cursor
        ? {
            cx: center.x,
            cy: center.y,
            rx: Math.max(1, Math.abs(cursor.x - center.x)),
            ry: Math.max(1, Math.abs(cursor.y - center.y)),
          }
        : null);

    if (center) {
      // 中心マーカーは白縁取りで見やすくする
      ctx.lineCap = 'round';
      const cross = () => {
        ctx.beginPath();
        ctx.moveTo(center.x - 9, center.y);
        ctx.lineTo(center.x + 9, center.y);
        ctx.moveTo(center.x, center.y - 9);
        ctx.lineTo(center.x, center.y + 9);
        ctx.stroke();
      };
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 6;
      cross();
      ctx.strokeStyle = guideColor;
      ctx.lineWidth = 2.5;
      cross();
      ctx.lineCap = 'butt';
    }
    if (guide) {
      // 破線の色はドラッグ中にランダムで変化する
      ctx.setLineDash([14, 8]);
      ctx.strokeStyle = guideColor;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.ellipse(guide.cx, guide.cy, guide.rx, guide.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [image, display, center, cursor, ellipse, guideColor]);

  const loadFile = useCallback((file) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setDisplay(fitSize(img.naturalWidth, img.naturalHeight));
      setImage(img);
      setPhase('waitCenter');
      setCenter(null);
      setCursor(null);
      setEllipse(null);
      setGifUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    img.src = url;
  }, []);

  /** 画像・楕円・生成済みGIFを破棄して初期状態に戻す */
  const handleReset = useCallback(() => {
    setImage((prev) => {
      if (prev?.src.startsWith('blob:')) URL.revokeObjectURL(prev.src);
      return null;
    });
    setDisplay({ width: IMAGE_WINDOW_WIDTH, height: IMAGE_WINDOW_HEIGHT, scale: 1 });
    setPhase('noImage');
    setCenter(null);
    setCursor(null);
    setEllipse(null);
    setBusy(false);
    setGifUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  /** 生成済みGIFを保存する */
  const handleDownload = useCallback(() => {
    if (!gifUrl) return;
    const a = document.createElement('a');
    a.href = gifUrl;
    a.download = 'speedlines.gif';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [gifUrl]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  };

  const canvasPoint = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // 左ボタン押下で中心を決める
  const handleMouseDown = (e) => {
    if (!image || e.button !== 0) return;
    e.preventDefault();
    const p = canvasPoint(e);
    setCenter(p);
    setCursor(p);
    setEllipse(null);
    setPhase('waitEdge');
  };

  // ドラッグ中はキャンバス外に出ても追従し、ボタンを離した位置で楕円を確定する
  useEffect(() => {
    if (phase !== 'waitEdge' || !center) return;

    const toCanvas = (clientX, clientY) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const onMove = (e) => {
      const p = toCanvas(e.clientX, e.clientY);
      if (p) setCursor(p);
    };

    const onUp = (e) => {
      if (e.button !== 0) return;
      const p = toCanvas(e.clientX, e.clientY);
      if (!p) return;
      const rx = Math.max(4, Math.abs(p.x - center.x));
      const ry = Math.max(4, Math.abs(p.y - center.y));
      setCursor(p);
      setEllipse({ cx: center.x, cy: center.y, rx, ry });
      setPhase('fixed');
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [phase, center]);

  // 楕円確定後、元画像サイズで集中線を複数パターン描画してGIF化する
  useEffect(() => {
    if (phase !== 'fixed' || !image || !ellipse) return;
    let canceled = false;

    const build = async () => {
      setBusy(true);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const w = image.naturalWidth;
      const h = image.naturalHeight;
      const k = 1 / display.scale; // 表示座標 → 元画像座標
      const src = {
        cx: ellipse.cx * k,
        cy: ellipse.cy * k,
        rx: ellipse.rx * k,
        ry: ellipse.ry * k,
      };

      const work = document.createElement('canvas');
      work.width = w;
      work.height = h;
      const ctx = work.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        setBusy(false);
        return;
      }

      const frames = [];
      for (let i = 0; i < patternCount; i++) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(image, 0, 0, w, h);
        drawSpeedLines(ctx, w, h, src, lineCount);
        frames.push({ data: ctx.getImageData(0, 0, w, h).data, delayMs });
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (canceled) return;
      }

      const blob = encodeGif(w, h, frames);
      if (canceled) return;
      const url = URL.createObjectURL(blob);
      setGifUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setBusy(false);
    };

    build();
    return () => {
      canceled = true;
    };
  }, [phase, image, ellipse, display.scale, patternCount, lineCount, delayMs]);

  const hint =
    phase === 'noImage'
      ? '画像ファイルをドロップしてください'
      : phase === 'waitCenter'
        ? '左ボタンを押した位置が楕円の中心になります'
        : phase === 'waitEdge'
          ? 'そのままドラッグで大きさを調整し、左ボタンを離すと確定します'
          : 'もう一度左ボタンを押すと中心の指定からやり直せます';

  return (
    <div className="app">
      <button type="button" className="back-button" onClick={() => setView('title')}>
        ← 戻る
      </button>

      <h1>集中線アニメーションGIFメーカー</h1>

      <div className="controls">
        <NumberField label="パターン数" value={patternCount} min={1} max={20} onCommit={setPatternCount} />
        <NumberField label="集中線の本数" value={lineCount} min={4} max={300} onCommit={setLineCount} />
        <NumberField label="表示間隔(ms)" value={delayMs} min={20} max={2000} step={10} onCommit={setDelayMs} />
        <button type="button" className="button" onClick={handleReset} disabled={!image && !gifUrl}>
          リセット
        </button>
      </div>

      <p className="hint">{hint}</p>

      <div className="panels">
        <div
          className={`dropZone${dragOver ? ' dragOver' : ''}`}
          style={{ width: IMAGE_WINDOW_WIDTH, height: IMAGE_WINDOW_HEIGHT }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <canvas
            ref={canvasRef}
            width={display.width}
            height={display.height}
            className="canvas"
            onMouseDown={handleMouseDown}
            onDragStart={(e) => e.preventDefault()}
            onContextMenu={(e) => e.preventDefault()}
          />
          {!image && <span className="placeholder">Drop image here</span>}
        </div>

        <div className="result" style={{ width: IMAGE_WINDOW_WIDTH, height: IMAGE_WINDOW_HEIGHT }}>
          {busy && <span className="placeholder">生成中…</span>}
          {!busy && gifUrl && <img src={gifUrl} alt="生成されたアニメーションGIF" className="gif" />}
          {!busy && !gifUrl && <span className="placeholder">GIFプレビュー</span>}
        </div>
      </div>

      <button type="button" className="button" onClick={handleDownload} disabled={!gifUrl || busy}>
        GIFをダウンロード（元画像サイズ）
      </button>
    </div>
  );
};

export default GifMaker;

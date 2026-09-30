import './Title.css'
import { useState } from 'react'

export default function Title({ setView }) {
  return (
    <div className="app">
      <h1>ツール選択</h1>
      <div className="menu">
        <button
          type="button"
          className="menu-button"
          onClick={() => setView("fontStyle")}
        >
          フォントスタイル変換
        </button>
        <button
          type="button"
          className="menu-button"
          onClick={() => setView("gifMaker")}
        >
          集中線GIFメーカー
        </button>
      </div>
    </div>
  )
}

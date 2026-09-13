import { useState } from 'react'

export default function Title({ setView }) {


  return (
    <>
      <div onClick={() => setView("fontStyle")}>フォントスタイル変換</div>
    </>
  )
}

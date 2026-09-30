import { useState } from 'react'
import './App.css'
import Title from './Title'
import FontStyle from './FontStyle'
import GifMaker from './GifMaker.jsx'

export default function App() {

  const [view, setView] = useState("title");

  return (
    <>
      {view === "title" && <Title setView={setView} />}
      {view === "fontStyle" && <FontStyle setView={setView} />}
      {view === "gifMaker" && <GifMaker setView={setView} />}
    </>
  )
}

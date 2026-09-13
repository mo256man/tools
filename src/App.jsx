import { useState } from 'react'
import './App.css'
import Title from './Title'
import FontStyle from './FontStyle'

export default function App() {

  const [view, setView] = useState("title");

  return (
    <>
      {view === "title" && <Title setView={setView} />}
      {view === "fontStyle" && <FontStyle setView={setView} />}
    </>
  )
}

// src/App.js

import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import DiscPage from "./pages/DiscPage";
import SwotPage from "./pages/SwotPage";
import NewSwotPage from "./pages/NewSwotPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<NewSwotPage />} />
      </Routes>
    </Router>
  );
}

export default App;

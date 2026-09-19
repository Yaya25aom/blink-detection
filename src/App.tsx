import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import Detection from "./pages/Detection";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import VerifyOtp from "./pages/VerifyOtp";
import LoginDetail from "./pages/LoginDetail";

import "./components/Sidebar.css";
import "./App.css";


function MainApp() {

  const [page, setPage] =
    useState("Overview");


  return (

    <div className="container">

      <Sidebar
        current={page}
        onChange={setPage}
      />


      <main className="main">

        {page === "Realtime" && (
          <Detection />
        )}

        {page === "Dashboard" && (
          <Dashboard />
        )}

      </main>

    </div>

  );
}


function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* Main App */}

        <Route
          path="/"
          element={<MainApp />}
        />


        {/* Login */}

        <Route
          path="/login"
          element={<Login />}
        />


        {/* OTP */}

        <Route
          path="/verify-otp"
          element={<VerifyOtp />}
        />


        {/* Auth */}

        <Route
          path="/Auth"
          element={<LoginDetail />}
        />

      </Routes>

    </BrowserRouter>

  );
}


export default App;

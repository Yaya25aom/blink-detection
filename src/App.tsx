import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import PlanReminder from "./components/PlanReminder";
import PlanNotificationToast from "./components/PlanNotificationToast";
import DetectionHealthAlerts from "./components/DetectionHealthAlerts";
import Detection from "./pages/Detection";
import Dashboard from "./pages/Dashboard";
import Overview from "./pages/Overview";
import History from "./pages/History";
import Plans from "./pages/Plans";
import Login from "./pages/Login";
import VerifyOtp from "./pages/VerifyOtp";
import LoginDetail from "./pages/LoginDetail";
import NotificationSettings from "./pages/NotificationSettings";
import Support from "./pages/Support";
import Privacy from "./pages/Privacy";
import ConnectingDevice from "./pages/ConnectingDevice";

import "./components/Sidebar.css";
import "./App.css";


function MainApp() {

  const [page, setPage] =
    useState("Overview");


  return (

    <div className="container">

      <PlanReminder />
      <PlanNotificationToast />
      <DetectionHealthAlerts />

      <Sidebar
        current={page}
        onChange={setPage}
      />


      <main className="main">

        {page === "Overview" && (
          <Overview onNavigate={setPage} />
        )}

        {page === "Realtime" && (
          <Detection />
        )}

        {page === "Dashboard" && (
          <Dashboard />
        )}

        {page === "Plan" && (
          <Plans />
        )}

        {page === "History" && (
          <History />
        )}

        {page === "Notification" && (
          <NotificationSettings />
        )}

        {page === "Connecting Device" && (
          <ConnectingDevice />
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

        <Route
          path="/support"
          element={<Support />}
        />

        <Route
          path="/privacy"
          element={<Privacy />}
        />

      </Routes>

    </BrowserRouter>

  );
}


export default App;

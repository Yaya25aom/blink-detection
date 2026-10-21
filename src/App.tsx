import {
  BrowserRouter,
  Navigate,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useEffect, useState } from "react";
import { apiFetch } from "./services/apiClient";

import Sidebar from "./components/Sidebar";
import PlanReminder from "./components/PlanReminder";
import PlanNotificationToast from "./components/PlanNotificationToast";
import DetectionHealthAlerts from "./components/DetectionHealthAlerts";
import Detection from "./pages/Detection";
import Dashboard from "./pages/Dashboard";
import MultiDayDashboard from "./pages/MultiDayDashboard";
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
import Register from "./pages/Register";
import GoogleCallback from "./pages/GoogleCallback";
import Downloads from "./pages/Downloads";
import Profile from "./pages/Profile";
import PlanActivity from "./pages/PlanActivity";
import Admin from "./pages/Admin";
import PasswordReset from "./pages/PasswordReset";

import "./components/Sidebar.css";
import "./App.css";


function MainApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLoggedIn = Boolean(localStorage.getItem("accessToken"));
  const [role, setRole] = useState<"loading" | "admin" | "user">(isLoggedIn ? "loading" : "user");

  useEffect(() => {
    let active = true;
    const loadRole = async () => {
      if (!localStorage.getItem("accessToken")) { if (active) setRole("user"); return; }
      if (active) setRole("loading");
      try {
        const response = await apiFetch("/auth/me");
        const result = await response.json();
        if (active) setRole(response.ok && String(result.data?.role_user).toUpperCase() === "ADMIN" ? "admin" : "user");
      } catch { if (active) setRole("user"); }
    };
    void loadRole();
    window.addEventListener("blinkcare:auth-updated", loadRole);
    return () => { active = false; window.removeEventListener("blinkcare:auth-updated", loadRole); };
  }, []);
  const routes: Record<string, string> = {
    Overview: "/",
    Dashboard: "/dashboard",
    "Multi-day Dashboard": "/dashboard/multi-day",
    Realtime: "/realtime",
    Plan: "/plans",
    History: "/history",
    Notification: "/notifications",
    "Connecting Device": "/devices",
    Downloads: "/downloads",
    Profile: "/profile",
    "Plan Activity": "/plan-activity",
    Admin: "/admin",
  };
  const pagesByPath = Object.fromEntries(Object.entries(routes).map(([page, path]) => [path, page]));
  const page = pagesByPath[location.pathname] ?? "Overview";

  if (!isLoggedIn && location.pathname !== "/") {
    return <Navigate to="/auth" replace state={{ returnTo: location.pathname }} />;
  }
  if (isLoggedIn && role === "loading") return null;
  if (isLoggedIn && role === "admin" && location.pathname !== "/admin") return <Navigate to="/admin" replace />;
  if (role === "user" && location.pathname === "/admin") return <Navigate to="/" replace />;

  const changePage = (nextPage: string) => {
    if (!isLoggedIn && nextPage !== "Overview") {
      navigate("/auth", { state: { returnTo: routes[nextPage] ?? "/" } });
      return;
    }
    const target = routes[nextPage];
    if (target) navigate(target);
  };


  return (

    <div className="container">

      {role !== "admin" && <><PlanReminder /><PlanNotificationToast /><DetectionHealthAlerts /></>}

      <Sidebar
        current={page}
        onChange={changePage}
        isAdmin={role === "admin"}
      />


      <main className={role === "admin" ? "main admin-main" : "main"}>

        {page === "Overview" && (
          <Overview onNavigate={changePage} />
        )}

        {page === "Realtime" && (
          <Detection />
        )}

        {page === "Dashboard" && (
          <Dashboard />
        )}

        {page === "Multi-day Dashboard" && (
          <MultiDayDashboard />
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

        {page === "Downloads" && (
          <Downloads />
        )}

        {page === "Profile" && (
          <Profile />
        )}

        {page === "Plan Activity" && (
          <PlanActivity />
        )}

        {page === "Admin" && <Admin />}

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
          path="/*"
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

        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<PasswordReset />} />
        <Route path="/reset-password" element={<PasswordReset />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />


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

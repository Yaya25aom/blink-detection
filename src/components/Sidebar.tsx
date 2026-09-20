import "./Sidebar.css";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { FaEye } from "react-icons/fa";

import {
  LuHouse,
  LuChartNoAxesCombined,
  LuScanEye,
  LuClipboardList,
  LuHistory,
  LuBell,
  LuSettings2,
  LuUserRound,
  LuLogOut,
  LuChevronDown,
  LuChevronUp,
} from "react-icons/lu";

type Props = {
  current: string;
  onChange: (page: string) => void;
};

const menus = [
  {
    name: "Overview",
    icon: <LuHouse />,
  },
  {
    name: "Dashboard",
    icon: <LuChartNoAxesCombined />,
  },
  {
    name: "Realtime",
    icon: <LuScanEye />,
  },
  {
    name: "Plan",
    icon: <LuClipboardList />,
  },
  {
    name: "History",
    icon: <LuHistory />,
  },
];

const bottomMenus = [
  {
    name: "Notification",
    icon: <LuBell />,
  },
  {
    name: "Connecting Device",
    icon: <LuSettings2 />,
  },
  {
    name: "Profile",
    icon: <LuUserRound />,
  },
];

export default function Sidebar({ current, onChange }: Props) {
  const navigate = useNavigate();

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // ==========================
  // Check Login
  // ==========================

  const isLoggedIn = !!localStorage.getItem("accessToken");

  // ==========================
  // User
  // ==========================

  const user = {
    name: "Yanisa",
    email: "yanisa@example.com",
  };

  // ==========================
  // Login
  // ==========================

  const handleLogin = () => {
    setShowProfileMenu(false);

    navigate("/login");
  };

  // ==========================
  // Register
  // ==========================

  const handleRegister = () => {
    setShowProfileMenu(false);

    navigate("/register");
  };

  // ==========================
  // Logout
  // ==========================

  const handleLogout = async () => {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    try {
      const response = await fetch("https://api.blinkcare.website/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });
      
    const data = await response.json();

    console.log("LOGOUT STATUS:", response.status);
    console.log("LOGOUT RESPONSE:", data);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // ลบ Token ออกจาก Browser
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");

      setShowProfileMenu(false);

      navigate("/");

      // window.location.reload();
      
    }
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <div className="topbar-logo">
            <FaEye />
            <div className="top-divider"></div>
          </div>

          <h2>BlinkCare</h2>
          <div className="vertical-divider"></div>
          <span className="page-title">{current === "Realtime" ? "Realtime Detection" : current}</span>
        </div>
      </header>
      <div className="sidebar">
        {/* ================= Logo ================= */}

        {/* <div className="logo">

        <img
          src={logo}
          alt="BlinkCare Logo"
        />

        <h2>
          BlinkCare
        </h2>

      </div> */}

        {/* ================= Main Menu ================= */}

        <div className="main-menus">
          {menus.map((menu) => (
            <button
              key={menu.name}
              className={current === menu.name ? "menu active" : "menu"}
              onClick={() => onChange(menu.name)}
            >
              {menu.icon}

              <span>{menu.name}</span>
            </button>
          ))}
        </div>

        {/* ================= Setting ================= */}

        <div className="divider"></div>

        <div className="Menubottom">
          <p className="setting">Setting</p>
        </div>

        {/* ================= Bottom Menu ================= */}

        <div className="bottom-menus">
          {bottomMenus.map((menu) => (
            <button
              key={menu.name}
              className={current === menu.name ? "menu active" : "menu"}
              onClick={() => onChange(menu.name)}
            >
              {menu.icon}

              <span>{menu.name}</span>
            </button>
          ))}
        </div>

        {/* ================= Profile ================= */}

        <div className="profile-section">
          {isLoggedIn ? (
            <>
              {/* ================= Logged In ================= */}

              <div
                className="profile-card"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="profile-left">
                  <div className="avatar">Y</div>

                  <div>
                    <h4>{user.name}</h4>

                    <p>{user.email}</p>
                  </div>
                </div>

                {/* ================= Arrow ================= */}

                {showProfileMenu ? (
                  <LuChevronUp className="arrow-icon" />
                ) : (
                  <LuChevronDown className="arrow-icon" />
                )}
              </div>

              {/* ================= Profile Menu ================= */}

              {showProfileMenu && (
                <div className="profile-menu">
                  {/* Profile */}

                  <button
                    className="profile-action"
                    onClick={() => onChange("Profile")}
                  >
                    <LuUserRound size={20} />

                    <span>โปรไฟล์</span>
                  </button>

                  {/* Logout */}

                  <button className="logout-btn" onClick={handleLogout}>
                    <LuLogOut size={20} />

                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ================= Not Logged In ================= */}

              <div className="guest-actions">
                {/* Login */}

                <button className="login-btn" onClick={handleLogin}>
                  เข้าสู่ระบบ
                </button>

                {/* Register */}

                <button className="register-btn" onClick={handleRegister}>
                  ลงทะเบียน
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

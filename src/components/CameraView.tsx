import "./CameraView.css";
import { FiInfo, FiEye, FiVideo } from "react-icons/fi";
import { BsPauseCircle, BsStopCircle } from "react-icons/bs";

type Props = {
  cameraOn: boolean;
  sessionActive: boolean;
  paused: boolean;
  externalSession?: boolean;

  onStart: () => void;
  onPause: () => void;
  onEnd: () => void;
};

export default function CameraView({
  cameraOn,
  sessionActive,
  paused,
  externalSession = false,
  onStart,
  onPause,
  onEnd,
}: Props) {
  return (
    <div className="camera-card">

      <div className="camera-monitor">

        <div className="privacy">
          <FiInfo className="info-icon" />

          <span>
            No Image Data Stored / Privacy Mode ON
          </span>
        </div>

        <div className="monitor-circle">

          <div className="monitor-eye">
            <FiEye />
          </div>

        </div>

        <p className="monitor-text">
          {externalSession
            ? "MONITORING FROM EXTENSION"
            : cameraOn
            ? "MONITORING IN PROGRESS"
            : sessionActive && paused
            ? "MONITORING PAUSED"
            : "READY TO START"}
        </p>

      </div>


      <div className="button-group">

        {/* =========================
            Start / Pause / Resume
        ========================= */}

        {externalSession ? (
          <div className="extension-monitoring-note">
            Extension is detecting. Live results are synchronized with this page.
          </div>
        ) : !cameraOn ? (
          <button
            className="start-btn"
            onClick={onStart}
          >
            <FiVideo />

            {sessionActive && paused
              ? "Resume Monitoring"
              : "Start Monitoring"}
          </button>
        ) : (
          <button
            className="pause-btn"
            onClick={onPause}
          >
            <BsPauseCircle />

            Pause Monitoring
          </button>
        )}


        {/* =========================
            End Session
        ========================= */}

        <button
          className="stop-btn"
          onClick={onEnd}
          disabled={!sessionActive}
        >
          <BsStopCircle />

          End Session
        </button>

      </div>

    </div>
  );
}

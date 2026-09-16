from AppKit import (
    NSWorkspace,
    NSWorkspaceDidActivateApplicationNotification,
    NSObject,
    NSRunLoop,
    NSDate,
)

import requests

from datetime import datetime, timezone


# =====================================================
# API
# =====================================================

API_BASE_URL = "http://localhost:3000/api"

GET_SESSION_URL = (
    f"{API_BASE_URL}/app-usage/session"
)

SAVE_USAGE_URL = (
    f"{API_BASE_URL}/app-usage"
)

UPDATE_USAGE_URL = (
    f"{API_BASE_URL}/app-usage/update"
)

CLOSE_USAGE_URL = (
    f"{API_BASE_URL}/app-usage/update"
)


# =====================================================
# Current Session
# =====================================================

current_session_id = None

tracking = False


# =====================================================
# Current App
# =====================================================

last_app = None

last_started_at = None


# =====================================================
# Get Current Detection Session
# =====================================================

def get_current_session():

    global current_session_id
    global tracking

    try:

        response = requests.get(
            GET_SESSION_URL,
            timeout=2,
        )

        # =============================================
        # ไม่มี Session
        # =============================================

        if response.status_code == 404:

            current_session_id = None
            tracking = False

            return

        # =============================================
        # Request Error
        # =============================================

        if not response.ok:

            print(
                "Get session failed:",
                response.status_code,
                response.text,
            )

            return

        # =============================================
        # Response
        # =============================================

        data = response.json()

        if not data.get("success"):

            return

        current_session_id = data.get(
            "session_id"
        )

        tracking = data.get(
            "tracking",
            False,
        )

    except requests.RequestException as error:

        print(
            "Session error:",
            error,
        )


# =====================================================
# Save New App
# =====================================================

def save_current_app(
    app_name,
    started_at,
):

    if not current_session_id:

        return False

    data = {

        "session_id":
            current_session_id,

        "app_name":
            app_name,

        "started_at":
            started_at.isoformat(),

    }

    try:

        response = requests.post(
            SAVE_USAGE_URL,
            json=data,
            timeout=2,
        )

        if response.ok:

            print(
                "CURRENT APP SAVED:",
                app_name,
            )

            return True

        print(
            "Save app failed:",
            response.status_code,
            response.text,
        )

        return False

    except requests.RequestException as error:

        print(
            "Save app error:",
            error,
        )

        return False


# =====================================================
# Update Current App Duration
# =====================================================

def update_current_app(
    session_id,
    ended_at,
):

    if not session_id:

        return False

    data = {

        "session_id":
            session_id,

        "ended_at":
            ended_at.isoformat(),

    }

    try:

        response = requests.post(
            UPDATE_USAGE_URL,
            json=data,
            timeout=2,
        )

        if response.ok:

            print(
                "CURRENT APP UPDATED:",
                response.json(),
            )

            return True

        print(
            "Update current app failed:",
            response.status_code,
            response.text,
        )

        return False

    except requests.RequestException as error:

        print(
            "Update current app error:",
            error,
        )

        return False


# =====================================================
# Close Current App
# =====================================================

def close_current_app(
    session_id,
    ended_at,
):

    if not session_id:

        return False

    data = {

        "session_id":
            session_id,

        "ended_at":
            ended_at.isoformat(),

    }

    try:

        response = requests.post(
            CLOSE_USAGE_URL,
            json=data,
            timeout=2,
        )

        if response.ok:

            print(
                "CURRENT APP CLOSED:",
                response.json(),
            )

            return True

        print(
            "Close current app failed:",
            response.status_code,
            response.text,
        )

        return False

    except requests.RequestException as error:

        print(
            "Close current app error:",
            error,
        )

        return False


# =====================================================
# Get Frontmost Application
# =====================================================

def get_frontmost_app():

    app = (
        NSWorkspace
        .sharedWorkspace()
        .frontmostApplication()
    )

    if app is None:

        return None

    return app.localizedName()


# =====================================================
# Reset App State
# =====================================================

def reset_app_state():

    global last_app
    global last_started_at

    last_app = None

    last_started_at = None


# =====================================================
# Sync Frontmost Application
# =====================================================

def sync_frontmost_app():

    global last_app
    global last_started_at

    if (
        not current_session_id
        or not tracking
    ):

        return

    app = get_frontmost_app()

    if not app:

        return

    now = datetime.now(
        timezone.utc
    )

    if last_app is None:

        last_app = app
        last_started_at = now

        print(
            "INITIAL APP:",
            app,
        )

        save_current_app(
            app,
            now,
        )

        return

    if app == last_app:

        return

    print()
    print(
        "================================"
    )
    print(
        "APP CHANGED"
    )
    print(
        "OLD:",
        last_app,
    )
    print(
        "NEW:",
        app,
    )
    print(
        "SESSION:",
        current_session_id,
    )
    print(
        "================================"
    )

    close_current_app(
        current_session_id,
        now,
    )

    last_app = app
    last_started_at = now

    save_current_app(
        app,
        now,
    )


# =====================================================
# App Observer
# =====================================================

class AppObserver(NSObject):

    def applicationChanged_(
        self,
        notification,
    ):

        global current_session_id
        global tracking

        global last_app
        global last_started_at

        # =============================================
        # Get latest session state
        # =============================================

        get_current_session()

        # =============================================
        # ไม่มี Session
        # =============================================

        if not current_session_id:

            reset_app_state()

            return

        # =============================================
        # Pause
        # =============================================

        if not tracking:

            return

        sync_frontmost_app()


# =====================================================
# Handle Session State
# =====================================================

# =====================================================
# Handle Session State
# =====================================================

def handle_session_state():

    global current_session_id
    global tracking

    global last_app
    global last_started_at

    previous_session_id = current_session_id
    previous_tracking = tracking

    # =================================================
    # Get latest session from backend
    # =================================================

    get_current_session()

    # =================================================
    # NEW SESSION
    #
    # จากไม่มี session
    # -> มี session ใหม่
    # =================================================

    if (
        previous_session_id is None
        and current_session_id is not None
        and tracking
    ):

        print()
        print(
            "================================"
        )

        print(
            "NEW SESSION DETECTED"
        )

        print(
            "SESSION:",
            current_session_id
        )

        print(
            "================================"
        )

        # =============================================
        # หา Application ที่กำลังเปิดอยู่
        # =============================================

        sync_frontmost_app()

        return

    # =================================================
    # Session Ended
    # =================================================

    if (
        previous_session_id
        and current_session_id is None
    ):

        print()
        print(
            "================================"
        )

        print(
            "SESSION ENDED"
        )

        print(
            "================================"
        )

        reset_app_state()

        return

    # =================================================
    # Session เปลี่ยนเป็น Session ใหม่
    #
    # กรณี Session เก่า -> Session ใหม่
    # =================================================

    if (
        previous_session_id
        and current_session_id
        and previous_session_id != current_session_id
    ):

        print()
        print(
            "================================"
        )

        print(
            "SESSION CHANGED"
        )

        print(
            "OLD SESSION:",
            previous_session_id
        )

        print(
            "NEW SESSION:",
            current_session_id
        )

        print(
            "================================"
        )

        reset_app_state()

        if tracking:

            sync_frontmost_app()

        return

    # =================================================
    # Pause
    # =================================================

    if (
        previous_tracking
        and not tracking
    ):

        print()
        print(
            "================================"
        )

        print(
            "APP TRACKING PAUSED"
        )

        print(
            "================================"
        )

        # =============================================
        # Close current app
        # =============================================

        if (
            current_session_id
            and last_app
            and last_started_at
        ):

            now = datetime.now(
                timezone.utc
            )

            close_current_app(
                current_session_id,
                now
            )

            reset_app_state()

        return

    # =================================================
    # Resume
    # =================================================

    if (
        not previous_tracking
        and tracking
        and current_session_id
    ):

        print()
        print(
            "================================"
        )

        print(
            "APP TRACKING RESUMED"
        )

        print(
            "SESSION:",
            current_session_id
        )

        print(
            "================================"
        )

        sync_frontmost_app()

        return


# =====================================================
# Start
# =====================================================

print()
print(
    "================================"
)

print(
    "REALTIME APP TRACKER STARTED"
)

print(
    "================================"
)


# =====================================================
# Initial Session
# =====================================================

get_current_session()


# =====================================================
# Create Observer
# =====================================================

observer = AppObserver.alloc().init()

workspace = (
    NSWorkspace.sharedWorkspace()
)

notification_center = (
    workspace.notificationCenter()
)


notification_center.addObserver_selector_name_object_(
    observer,
    "applicationChanged:",
    NSWorkspaceDidActivateApplicationNotification,
    None,
)


# =====================================================
# Initial App
# =====================================================

if (
    current_session_id
    and tracking
):

    sync_frontmost_app()


# =====================================================
# Run Loop
# =====================================================

run_loop = (
    NSRunLoop.currentRunLoop()
)


while True:

    try:

        # =============================================
        # Check session state
        # =============================================

        handle_session_state()

        sync_frontmost_app()

        # =============================================
        # Process macOS events
        # =============================================

        run_loop.runUntilDate_(
            NSDate.dateWithTimeIntervalSinceNow_(
                0.1
            )
        )

    except KeyboardInterrupt:

        print()
        print(
            "Tracker stopped"
        )

        # =============================================
        # Save final app
        # =============================================

        if (
            current_session_id
            and tracking
            and last_app
            and last_started_at
        ):

            now = datetime.now(
                timezone.utc
            )

            close_current_app(
                current_session_id,
                now,
            )

        break

    except Exception as error:

        print()
        print(
            "Unexpected error:",
            error,
        )

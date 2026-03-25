"""
Session management utilities for coordinating PDF co-viewer sessions.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional, Tuple
from uuid import uuid4


@dataclass
class UserState:
    """Tracks role and page state for a connected user."""
    is_admin: bool = False
    page: int = 1


@dataclass
class SessionState:
    """Represents the state of a co-viewing session."""
    current_page: int = 1
    total_pages: int = 1
    pdf_path: Optional[str] = None
    admin_sid: Optional[str] = None
    connected_users: Dict[str, UserState] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


class SessionManager:
    """In-memory manager for co-viewer sessions."""

    def __init__(self):
        self._sessions: Dict[str, SessionState] = {}

    def create_session(self) -> str:
        """Create and store a new session, returning its ID."""
        session_id = str(uuid4())
        self._sessions[session_id] = SessionState()
        return session_id

    def has_session(self, session_id: str) -> bool:
        return session_id in self._sessions

    def get_session(self, session_id: str) -> Optional[SessionState]:
        return self._sessions.get(session_id)

    def require_session(self, session_id: str) -> SessionState:
        session = self.get_session(session_id)
        if not session:
            raise KeyError(f"Session {session_id} not found")
        return session

    def set_pdf(self, session_id: str, pdf_path: str, total_pages: int) -> SessionState:
        session = self.require_session(session_id)
        session.pdf_path = pdf_path
        session.total_pages = total_pages
        session.current_page = 1
        return session

    def add_user(
        self,
        session_id: str,
        user_sid: str,
        wants_admin: bool = False
    ) -> Tuple[SessionState, bool]:
        session = self.require_session(session_id)

        if wants_admin and not session.admin_sid:
            session.admin_sid = user_sid

        is_admin = session.admin_sid == user_sid
        session.connected_users[user_sid] = UserState(
            is_admin=is_admin,
            page=session.current_page
        )
        return session, is_admin

    def update_page(self, session_id: str, new_page: int) -> SessionState:
        session = self.require_session(session_id)
        session.current_page = new_page
        for user_state in session.connected_users.values():
            if user_state.is_admin:
                user_state.page = new_page
        return session

    def is_admin(self, session_id: str, user_sid: str) -> bool:
        session = self.require_session(session_id)
        return session.admin_sid == user_sid

    def remove_user(self, user_sid: str) -> Tuple[Optional[str], Optional[SessionState]]:
        """
        Remove a user from whichever session they belong to.

        Returns a tuple of (session_id, session_state) if the user was found,
        otherwise (None, None).
        """
        for session_id, session in self._sessions.items():
            if user_sid in session.connected_users:
                was_admin = user_sid == session.admin_sid
                del session.connected_users[user_sid]

                if was_admin:
                    session.admin_sid = next(iter(session.connected_users), None)
                    if session.admin_sid:
                        session.connected_users[session.admin_sid].is_admin = True

                return session_id, session

        return None, None

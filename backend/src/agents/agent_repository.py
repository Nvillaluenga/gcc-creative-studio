# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Repository for interacting with AgentChatEvent models."""

import logging
from typing import List, Sequence, Dict, Any
from fastapi import Depends
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.agents.agent_chat_event_model import AgentChatEvent
from src.workbench.schema.project_model import Session

logger = logging.getLogger(__name__)


class AgentRepository:
    """Repository for handling AgentChatEvent database operations."""

    def __init__(self, db: AsyncSession = Depends(get_db)):
        self.db = db

    async def add_chat_event(
        self, user_id: str, session_id: str, payload: dict
    ) -> AgentChatEvent:
        """Add a new chat event to the database."""
        event = AgentChatEvent(
            user_id=user_id,
            session_id=session_id,
            payload=payload,
        )
        self.db.add(event)
        await self.db.commit()
        return event

    async def get_pending_events(
        self, session_id: str, user_id: str
    ) -> Sequence[AgentChatEvent]:
        """Get all pending events for a session and user, ordered by ID."""
        stmt = (
            select(AgentChatEvent)
            .where(
                AgentChatEvent.session_id == session_id,
                AgentChatEvent.user_id == user_id,
            )
            .order_by(AgentChatEvent.id.asc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def delete_events(self, event_ids: List[int]) -> None:
        """Delete multiple events by their IDs."""
        if not event_ids:
            return
        delete_stmt = delete(AgentChatEvent).where(
            AgentChatEvent.id.in_(event_ids)
        )
        await self.db.execute(delete_stmt)
        await self.db.commit()

    async def create_session_record(
        self, project_id: int, session_id: str, name: str | None
    ) -> Session:
        """Create a new session record in the database."""
        session_record = Session(
            project_id=project_id,
            session_id=session_id,
            name=name,
        )
        self.db.add(session_record)
        await self.db.commit()
        return session_record

    async def get_sessions_by_ids(
        self, session_ids: List[str]
    ) -> Sequence[Session]:
        """Fetch session records by their Vertex AI session IDs."""
        if not session_ids:
            return []
        stmt = select(Session).where(Session.session_id.in_(session_ids))
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_session_by_id(self, session_id: str) -> Session | None:
        """Fetch a single session record by session_id."""
        stmt = select(Session).where(Session.session_id == session_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_session_record(
        self, session_id: str, update_data: Dict[str, Any]
    ) -> Session | None:
        """Update a session record dynamically."""
        stmt = select(Session).where(Session.session_id == session_id)
        result = await self.db.execute(stmt)
        session_record = result.scalar_one_or_none()
        if not session_record:
            return None

        restricted_fields = {"id", "project_id", "session_id"}
        for key, value in update_data.items():
            if key in restricted_fields:
                continue
            if key in Session.__mapper__.columns:
                setattr(session_record, key, value)

        await self.db.commit()
        await self.db.refresh(session_record)
        return session_record

    async def delete_session_record_and_events(self, session_id: str) -> None:
        """Delete a session record and all its chat events from the database."""
        delete_events_stmt = delete(AgentChatEvent).where(
            AgentChatEvent.session_id == session_id
        )
        await self.db.execute(delete_events_stmt)

        delete_session_stmt = delete(Session).where(
            Session.session_id == session_id
        )
        await self.db.execute(delete_session_stmt)
        await self.db.commit()

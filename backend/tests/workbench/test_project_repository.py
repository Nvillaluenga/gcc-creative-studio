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
"""Tests for Storyboard and Project Repositories."""

from datetime import datetime, UTC
from unittest.mock import MagicMock, AsyncMock
import pytest
from sqlalchemy import select

from src.workbench.schema.project_model import Project, Storyboard, Scene
from src.workbench.schema.timeline_model import Timeline
from src.workbench.dto.project_dto import SceneDTO
from src.workbench.repository.project_repository import (
    StoryboardRepository,
    ProjectRepository,
)


@pytest.fixture(name="storyboard_repo")
def fixture_storyboard_repo(db_session_mock):
    """Provides a StoryboardRepository with mocked DB session."""
    return StoryboardRepository(db=db_session_mock)


@pytest.fixture(name="project_repo")
def fixture_project_repo(db_session_mock):
    """Provides a ProjectRepository with mocked DB session."""
    return ProjectRepository(db=db_session_mock)


class TestStoryboardRepository:
    """Tests for StoryboardRepository methods."""

    @pytest.mark.anyio
    async def test_create_storyboard(self, storyboard_repo, db_session_mock):
        db_session_mock.add = MagicMock()
        db_session_mock.commit = AsyncMock()

        async def mock_refresh(instance):
            instance.id = 10

        db_session_mock.refresh = mock_refresh

        data = {
            "project_id": 1,
            "user_id": 1,
            "template_name": "Template A",
        }

        res = await storyboard_repo.create(data)
        assert res.id == 10
        assert res.project_id == 1
        assert res.template_name == "Template A"
        db_session_mock.add.assert_called_once()
        db_session_mock.commit.assert_called_once()

    @pytest.mark.anyio
    async def test_update_storyboard_found(
        self, storyboard_repo, db_session_mock
    ):
        db_session_mock.commit = AsyncMock()

        mock_storyboard = Storyboard(
            id=10,
            project_id=1,
            user_id=1,
            template_name="Old Name",
        )
        mock_storyboard.scenes = []
        mock_storyboard.timeline = None
        mock_storyboard.project = Project(id=1, owner_id=1, name="Proj")

        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.side_effect = [
            mock_storyboard,  # for first get
            mock_storyboard,  # for get_by_id_with_details
        ]
        db_session_mock.execute.return_value = mock_execute

        update_data = {"template_name": "New Name"}
        res = await storyboard_repo.update(10, update_data)
        assert res is not None
        assert res.template_name == "New Name"
        db_session_mock.commit.assert_called_once()

    @pytest.mark.anyio
    async def test_update_storyboard_not_found(
        self, storyboard_repo, db_session_mock
    ):
        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.return_value = None
        db_session_mock.execute.return_value = mock_execute

        res = await storyboard_repo.update(999, {"template_name": "New Name"})
        assert res is None

    @pytest.mark.anyio
    async def test_get_by_id_with_details_found(
        self, storyboard_repo, db_session_mock
    ):
        mock_storyboard = Storyboard(
            id=10,
            project_id=1,
            user_id=1,
            template_name="Template A",
        )
        mock_storyboard.scenes = [Scene(id=1, topic="Intro")]
        mock_storyboard.timeline = Timeline(id=5)
        mock_storyboard.project = Project(id=1, owner_id=1, name="Proj")

        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.return_value = mock_storyboard
        db_session_mock.execute.return_value = mock_execute

        res = await storyboard_repo.get_by_id_with_details(10)
        assert res is not None
        assert res.id == 10
        assert len(res.scenes) == 1
        assert res.timeline_id == 5

    @pytest.mark.anyio
    async def test_get_by_id_with_details_not_found(
        self, storyboard_repo, db_session_mock
    ):
        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.return_value = None
        db_session_mock.execute.return_value = mock_execute

        res = await storyboard_repo.get_by_id_with_details(999)
        assert res is None

    @pytest.mark.anyio
    async def test_find_by_workspace(self, storyboard_repo, db_session_mock):
        mock_sb = Storyboard(
            id=10,
            project_id=1,
            user_id=1,
            template_name="Template A",
        )
        mock_sb.scenes = []
        mock_sb.timeline = None
        mock_sb.project = Project(id=1, owner_id=1, name="Proj", workspace_id=1)

        mock_execute = MagicMock()
        mock_execute.scalars.return_value.all.return_value = [mock_sb]
        db_session_mock.execute.return_value = mock_execute

        res = await storyboard_repo.find_by_workspace(
            workspace_id=1, session_id="abc", user_id=1
        )
        assert len(res) == 1
        assert res[0].id == 10

    @pytest.mark.anyio
    async def test_update_storyboard_data_success(
        self, storyboard_repo, db_session_mock
    ):
        db_session_mock.commit = AsyncMock()

        mock_storyboard = Storyboard(
            id=10,
            project_id=1,
            user_id=1,
            bg_music_description="Old Music",
        )
        mock_storyboard.scenes = []
        mock_storyboard.timeline = None
        mock_storyboard.project = Project(id=1, owner_id=1, name="Proj")

        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.side_effect = [
            mock_storyboard,  # for first get
            mock_storyboard,  # for get_by_id_with_details
        ]
        db_session_mock.execute.return_value = mock_execute

        scenes = [SceneDTO(topic="Scene 1")]
        res = await storyboard_repo.update_storyboard_data(
            storyboard_id=10,
            bg_music_description="New Music",
            scenes=scenes,
        )
        assert res is not None
        assert res.bg_music_description == "New Music"
        assert len(mock_storyboard.scenes) == 1
        assert mock_storyboard.scenes[0].topic == "Scene 1"
        db_session_mock.commit.assert_called_once()

    @pytest.mark.anyio
    async def test_update_storyboard_data_not_found(
        self, storyboard_repo, db_session_mock
    ):
        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.return_value = None
        db_session_mock.execute.return_value = mock_execute

        res = await storyboard_repo.update_storyboard_data(storyboard_id=999)
        assert res is None


class TestProjectRepository:
    """Tests for ProjectRepository methods."""

    @pytest.mark.anyio
    async def test_get_by_id_found(self, project_repo, db_session_mock):
        mock_project = Project(
            id=10,
            workspace_id=1,
            owner_id=1,
            name="Proj",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        mock_project.storyboard = None
        mock_project.timeline = None
        mock_project.sessions = []

        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.return_value = mock_project
        db_session_mock.execute.return_value = mock_execute

        res = await project_repo.get_by_id(10, include_deleted=True)
        assert res is not None
        assert res.id == 10

    @pytest.mark.anyio
    async def test_get_by_id_not_found(self, project_repo, db_session_mock):
        mock_execute = MagicMock()
        mock_execute.scalar_one_or_none.return_value = None
        db_session_mock.execute.return_value = mock_execute

        res = await project_repo.get_by_id(999)
        assert res is None

    @pytest.mark.anyio
    async def test_get_project_by_params_all_params(
        self, project_repo, db_session_mock
    ):
        mock_project = Project(
            id=10,
            workspace_id=1,
            owner_id=1,
            name="Proj",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        mock_project.storyboard = None
        mock_project.timeline = None
        mock_project.sessions = []

        mock_execute = MagicMock()
        mock_execute.scalars.return_value.first.return_value = mock_project
        db_session_mock.execute.return_value = mock_execute

        res = await project_repo.get_project_by_params(
            project_id=10,
            session_id="abc",
            storyboard_id=2,
            timeline_id=5,
        )
        assert res is not None
        assert res.id == 10

    @pytest.mark.anyio
    async def test_get_project_by_params_no_params(self, project_repo):
        res = await project_repo.get_project_by_params()
        assert res is None

    @pytest.mark.anyio
    async def test_find_by_workspace_and_owner(
        self, project_repo, db_session_mock
    ):
        mock_project = Project(
            id=10,
            workspace_id=1,
            owner_id=1,
            name="Proj",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        mock_project.storyboard = None
        mock_project.timeline = None
        mock_project.sessions = []

        mock_execute = MagicMock()
        mock_execute.scalars.return_value.all.return_value = [mock_project]
        db_session_mock.execute.return_value = mock_execute

        res = await project_repo.find_by_workspace_and_owner(
            workspace_id=1, owner_id=1
        )
        assert len(res) == 1
        assert res[0].id == 10

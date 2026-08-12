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
"""Tests for Project Service."""

from datetime import datetime, UTC
from unittest.mock import AsyncMock, MagicMock
import pytest

from src.workbench.services.project_service import ProjectService
from src.workbench.dto.project_dto import (
    ProjectCreate,
    ProjectUpdate,
    StoryboardCreate,
    StoryboardUpdate,
    StoryboardResponse,
    SceneDTO,
)
from src.common.schema.media_item_model import MediaItemModel


@pytest.fixture(name="project_service")
def fixture_project_service():
    """Provides a ProjectService with mocked repositories."""
    mock_storyboard_repo = AsyncMock()
    mock_project_repo = AsyncMock()
    mock_media_repo = AsyncMock()
    mock_iam_credentials = MagicMock()
    mock_iam_credentials.generate_presigned_url.return_value = (
        "http://presigned.url"
    )

    service = ProjectService(
        storyboard_repo=mock_storyboard_repo,
        project_repo=mock_project_repo,
        media_repo=mock_media_repo,
        iam_signer_credentials=mock_iam_credentials,
    )
    service.mock_storyboard_repo = mock_storyboard_repo
    service.mock_project_repo = mock_project_repo
    service.mock_media_repo = mock_media_repo
    service.mock_iam_credentials = mock_iam_credentials
    return service


class TestProjectService:
    """Tests for ProjectService methods."""

    @pytest.mark.anyio
    async def test_create_storyboard(self, project_service):
        storyboard_create = StoryboardCreate(
            project_id=2,
            session_id="abc",
            template_name="Template A",
        )
        project_service.mock_storyboard_repo.create.return_value = MagicMock()

        await project_service.create_storyboard(storyboard_create, user_id=1)
        project_service.mock_storyboard_repo.create.assert_called_once()

    @pytest.mark.anyio
    async def test_get_storyboard_found_and_enriched(self, project_service):
        mock_storyboard = StoryboardResponse(
            id=10,
            user_id=1,
            project_id=2,
            template_name="Template A",
            scenes=[
                SceneDTO(
                    id=1,
                    first_frame_media_item_id=50,
                )
            ],
        )
        project_service.mock_storyboard_repo.get_by_id_with_details.return_value = (
            mock_storyboard
        )

        mock_media = MediaItemModel(
            id=50,
            workspace_id=1,
            mime_type="image/png",
            gcs_uris=["gs://bucket/images/1.png"],
            user_email="user@test.com",
            model="gemini",
            aspect_ratio="16:9",
        )
        project_service.mock_media_repo.get_by_id.return_value = mock_media

        res = await project_service.get_storyboard(10)
        assert res is not None
        assert res.scenes[0].first_frame_generated_url == "http://presigned.url"

    @pytest.mark.anyio
    async def test_get_storyboard_not_found(self, project_service):
        project_service.mock_storyboard_repo.get_by_id_with_details.return_value = (
            None
        )

        res = await project_service.get_storyboard(999)
        assert res is None

    @pytest.mark.anyio
    async def test_list_storyboards(self, project_service):
        mock_sb = StoryboardResponse(
            id=10,
            user_id=1,
            project_id=2,
            template_name="Template A",
            scenes=[],
        )
        project_service.mock_storyboard_repo.find_by_workspace.return_value = [
            mock_sb
        ]

        res = await project_service.list_storyboards(
            workspace_id=1, session_id="abc", user_id=1
        )
        assert len(res) == 1
        assert res[0].id == 10

    @pytest.mark.anyio
    async def test_update_storyboard_success(self, project_service):
        mock_existing = StoryboardResponse(
            id=10, user_id=1, project_id=2, template_name="Old", scenes=[]
        )
        project_service.mock_storyboard_repo.get_by_id_with_details.return_value = (
            mock_existing
        )
        project_service.mock_storyboard_repo.update.return_value = MagicMock()
        project_service.mock_storyboard_repo.update_storyboard_data.return_value = (
            mock_existing
        )

        scenes_payload = [
            {
                "topic": "Scene 1",
                "duration_seconds": 5.0,
                "first_frame_prompt": {
                    "description": "desc",
                    "media_item_id": 10,
                    "source_asset_id": 20,
                },
                "video_prompt": {
                    "description": "vdesc",
                    "duration_seconds": 4.0,
                    "media_item_id": 30,
                    "source_asset_id": 40,
                    "generated_url": "url",
                },
                "voiceover_prompt": {
                    "text": "text",
                    "gender": "male",
                    "description": "vodesc",
                    "media_item_id": 50,
                    "source_asset_id": 60,
                },
                "transition_hints": {"type": "fade", "duration": 1.0},
                "audio_hints": {"ambient_sound": "ambient", "sfx": "sfx"},
            }
        ]
        storyboard_update = StoryboardUpdate(
            template_name="New",
            bg_music_asset_id=100,
            bg_music_description="Upbeat",
            scenes=scenes_payload,
        )

        res = await project_service.update_storyboard(10, storyboard_update)
        assert res is not None
        project_service.mock_storyboard_repo.update.assert_any_call(
            10, {"template_name": "New"}
        )
        project_service.mock_storyboard_repo.update.assert_any_call(
            10, {"bg_music_asset_id": 100}
        )
        project_service.mock_storyboard_repo.update_storyboard_data.assert_called_once()

    @pytest.mark.anyio
    async def test_update_storyboard_not_found(self, project_service):
        project_service.mock_storyboard_repo.get_by_id_with_details.return_value = (
            None
        )
        storyboard_update = StoryboardUpdate(template_name="New")

        res = await project_service.update_storyboard(999, storyboard_update)
        assert res is None

    @pytest.mark.anyio
    async def test_delete_storyboard(self, project_service):
        project_service.mock_storyboard_repo.delete.return_value = None
        await project_service.delete_storyboard(10)
        project_service.mock_storyboard_repo.delete.assert_called_once_with(10)

    @pytest.mark.anyio
    async def test_create_project(self, project_service):
        project_create = ProjectCreate(
            workspace_id=1,
            name="New Proj",
        )
        project_service.mock_project_repo.create.return_value = MagicMock()
        await project_service.create_project(project_create, owner_id=1)
        project_service.mock_project_repo.create.assert_called_once()

    @pytest.mark.anyio
    async def test_get_project(self, project_service):
        project_service.mock_project_repo.get_project_by_params.return_value = (
            MagicMock()
        )
        await project_service.get_project(project_id=10)
        project_service.mock_project_repo.get_project_by_params.assert_called_once_with(
            project_id=10,
            session_id=None,
            storyboard_id=None,
            timeline_id=None,
        )

    @pytest.mark.anyio
    async def test_list_projects(self, project_service):
        project_service.mock_project_repo.find_by_workspace_and_owner.return_value = (
            []
        )
        res = await project_service.list_projects(workspace_id=1, owner_id=1)
        assert res == []
        project_service.mock_project_repo.find_by_workspace_and_owner.assert_called_once_with(
            1, 1
        )

    @pytest.mark.anyio
    async def test_update_project(self, project_service):
        project_update = ProjectUpdate(name="Updated")
        project_service.mock_project_repo.update.return_value = MagicMock()
        await project_service.update_project(10, project_update)
        project_service.mock_project_repo.update.assert_called_once_with(
            10, {"name": "Updated"}
        )

    @pytest.mark.anyio
    async def test_delete_project(self, project_service):
        project_service.mock_project_repo.delete.return_value = True
        res = await project_service.delete_project(10)
        assert res is True
        project_service.mock_project_repo.delete.assert_called_once_with(10)

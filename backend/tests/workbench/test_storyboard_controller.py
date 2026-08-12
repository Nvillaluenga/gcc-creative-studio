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
"""Tests for Storyboard Controller."""

from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import status

from main import app
from src.workspaces.workspace_auth_guard import WorkspaceAuth
from src.workbench.project_auth_guard import ProjectAuth
from src.workbench.services.project_service import ProjectService
from src.workbench.dto.project_dto import (
    StoryboardResponse,
    StoryboardCreateResponse,
)


@pytest.fixture(name="mock_project_service")
def fixture_mock_project_service():
    """Provides a mocked ProjectService."""
    return AsyncMock()


@pytest.fixture(name="mock_workspace_auth")
def fixture_mock_workspace_auth():
    """Provides a mocked WorkspaceAuth."""
    mock = AsyncMock()
    mock.authorize.return_value = True
    return mock


@pytest.fixture(name="mock_project_auth")
def fixture_mock_project_auth():
    """Provides a mocked ProjectAuth."""
    mock = AsyncMock()
    mock.authorize.return_value = True
    return mock


@pytest.fixture(name="override_storyboard_dependencies", autouse=True)
def fixture_override_storyboard_dependencies(
    mock_project_service,
    mock_workspace_auth,
    mock_project_auth,
):
    """Overrides dependencies in the app."""
    app.dependency_overrides[ProjectService] = lambda: mock_project_service
    app.dependency_overrides[WorkspaceAuth] = lambda: mock_workspace_auth
    app.dependency_overrides[ProjectAuth] = lambda: mock_project_auth
    yield
    if ProjectService in app.dependency_overrides:
        del app.dependency_overrides[ProjectService]
    if WorkspaceAuth in app.dependency_overrides:
        del app.dependency_overrides[WorkspaceAuth]
    if ProjectAuth in app.dependency_overrides:
        del app.dependency_overrides[ProjectAuth]


class TestStoryboardController:
    """Tests for Storyboard Controller endpoints."""

    def test_create_storyboard_success(self, api_client, mock_project_service):
        mock_response = StoryboardCreateResponse(
            id=10,
            user_id=1,  # matches mock_user.id
            project_id=2,
            session_id="abc",
            template_name="test_template",
        )
        mock_project_service.create_storyboard.return_value = mock_response

        payload = {
            "project_id": 2,
            "session_id": "abc",
            "template_name": "test_template",
        }
        response = api_client.post("/api/storyboards/", json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["id"] == 10
        assert response.json()["template_name"] == "test_template"

    def test_get_storyboard_success(self, api_client, mock_project_service):
        mock_response = StoryboardResponse(
            id=10,
            user_id=1,  # matches mock_user.id
            project_id=2,
            template_name="test_template",
            scenes=[],
        )
        mock_project_service.get_storyboard.return_value = mock_response

        response = api_client.get("/api/storyboards/10")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["id"] == 10
        mock_project_service.get_storyboard.assert_called_once_with(10)

    def test_get_storyboard_not_found(self, api_client, mock_project_service):
        mock_project_service.get_storyboard.return_value = None

        response = api_client.get("/api/storyboards/999")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Storyboard not found"

    def test_get_storyboard_forbidden(self, api_client, mock_project_service):
        mock_response = StoryboardResponse(
            id=10,
            user_id=999,  # different from mock_user.id (1)
            project_id=2,
            template_name="test_template",
            scenes=[],
        )
        mock_project_service.get_storyboard.return_value = mock_response

        response = api_client.get("/api/storyboards/10")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert (
            response.json()["detail"]
            == "Not authorized to access this storyboard"
        )

    def test_list_storyboards_success(self, api_client, mock_project_service):
        mock_response = [
            StoryboardResponse(
                id=10,
                user_id=1,
                project_id=2,
                template_name="test_template",
                scenes=[],
            )
        ]
        mock_project_service.list_storyboards.return_value = mock_response

        response = api_client.get(
            "/api/storyboards?workspace_id=1&session_id=abc"
        )
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 1
        assert response.json()[0]["id"] == 10

    def test_update_storyboard_success(self, api_client, mock_project_service):
        mock_existing = StoryboardResponse(
            id=10,
            user_id=1,
            project_id=2,
            template_name="Old Template",
            scenes=[],
        )
        mock_project_service.get_storyboard.return_value = mock_existing

        mock_updated = StoryboardResponse(
            id=10,
            user_id=1,
            project_id=2,
            template_name="New Template",
            scenes=[],
        )
        mock_project_service.update_storyboard.return_value = mock_updated

        payload = {"template_name": "New Template"}
        response = api_client.put("/api/storyboards/10", json=payload)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["template_name"] == "New Template"

    def test_update_storyboard_not_found(
        self, api_client, mock_project_service
    ):
        mock_project_service.get_storyboard.return_value = None

        payload = {"template_name": "New Template"}
        response = api_client.put("/api/storyboards/999", json=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Storyboard not found"

    def test_update_storyboard_forbidden(
        self, api_client, mock_project_service
    ):
        mock_existing = StoryboardResponse(
            id=10,
            user_id=999,  # forbidden
            project_id=2,
            template_name="Old Template",
            scenes=[],
        )
        mock_project_service.get_storyboard.return_value = mock_existing

        payload = {"template_name": "New Template"}
        response = api_client.put("/api/storyboards/10", json=payload)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert (
            response.json()["detail"]
            == "Not authorized to modify this storyboard"
        )

    def test_delete_storyboard_success(self, api_client, mock_project_service):
        mock_existing = StoryboardResponse(
            id=10,
            user_id=1,
            project_id=2,
            template_name="To Delete",
            scenes=[],
        )
        mock_project_service.get_storyboard.return_value = mock_existing
        mock_project_service.delete_storyboard.return_value = None

        response = api_client.delete("/api/storyboards/10")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_project_service.delete_storyboard.assert_called_once_with(10)

    def test_delete_storyboard_not_found(
        self, api_client, mock_project_service
    ):
        mock_project_service.get_storyboard.return_value = None

        response = api_client.delete("/api/storyboards/999")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Storyboard not found"

    def test_delete_storyboard_forbidden(
        self, api_client, mock_project_service
    ):
        mock_existing = StoryboardResponse(
            id=10,
            user_id=999,  # forbidden
            project_id=2,
            template_name="To Delete",
            scenes=[],
        )
        mock_project_service.get_storyboard.return_value = mock_existing

        response = api_client.delete("/api/storyboards/10")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert (
            response.json()["detail"]
            == "Not authorized to delete this storyboard"
        )

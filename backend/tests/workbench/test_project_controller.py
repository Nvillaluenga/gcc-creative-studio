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
"""Tests for Project Controller."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import status

from main import app
from src.workspaces.workspace_auth_guard import WorkspaceAuth
from src.workbench.services.project_service import ProjectService
from src.workbench.dto.project_dto import ProjectResponse


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


@pytest.fixture(name="override_project_service", autouse=True)
def fixture_override_project_service(
    mock_project_service,
    mock_workspace_auth,
):
    """Overrides dependencies in the app."""
    app.dependency_overrides[ProjectService] = lambda: mock_project_service
    app.dependency_overrides[WorkspaceAuth] = lambda: mock_workspace_auth
    yield
    if ProjectService in app.dependency_overrides:
        del app.dependency_overrides[ProjectService]
    if WorkspaceAuth in app.dependency_overrides:
        del app.dependency_overrides[WorkspaceAuth]


class TestProjectController:
    """Tests for Project Controller endpoints."""

    def test_create_project_success(self, api_client, mock_project_service):
        mock_response = ProjectResponse(
            id=10,
            workspace_id=1,
            owner_id=1,  # matches mock_user.id
            name="Test Project",
            description="Test Description",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_project_service.create_project.return_value = mock_response

        payload = {
            "workspace_id": 1,
            "name": "Test Project",
            "description": "Test Description",
        }
        response = api_client.post("/api/projects/", json=payload)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["id"] == 10
        assert response.json()["name"] == "Test Project"

    def test_get_project_by_id_success(self, api_client, mock_project_service):
        mock_response = ProjectResponse(
            id=10,
            workspace_id=1,
            owner_id=1,  # matches mock_user.id
            name="Test Project",
            description="Test Description",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_project_service.get_project.return_value = mock_response

        response = api_client.get("/api/projects/10")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["id"] == 10
        mock_project_service.get_project.assert_called_once_with(project_id=10)

    def test_get_project_by_query_params_success(
        self, api_client, mock_project_service
    ):
        mock_response = ProjectResponse(
            id=10,
            workspace_id=1,
            owner_id=1,  # matches mock_user.id
            name="Test Project",
            description="Test Description",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_project_service.get_project.return_value = mock_response

        response = api_client.get(
            "/api/projects/any?timeline_id=5&storyboard_id=2&session_id=abc"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["id"] == 10
        mock_project_service.get_project.assert_called_once_with(
            session_id="abc", storyboard_id=2, timeline_id=5
        )

    def test_get_project_not_found(self, api_client, mock_project_service):
        mock_project_service.get_project.return_value = None

        response = api_client.get("/api/projects/999")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Project not found"

    def test_get_project_forbidden(self, api_client, mock_project_service):
        mock_response = ProjectResponse(
            id=10,
            workspace_id=1,
            owner_id=999,  # different from mock_user.id (1)
            name="Test Project",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_project_service.get_project.return_value = mock_response

        response = api_client.get("/api/projects/10")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert (
            response.json()["detail"] == "Not authorized to access this project"
        )

    def test_list_projects_success(self, api_client, mock_project_service):
        mock_response = [
            ProjectResponse(
                id=10,
                workspace_id=1,
                owner_id=1,
                name="Project 1",
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        ]
        mock_project_service.list_projects.return_value = mock_response

        response = api_client.get("/api/projects?workspace_id=1")
        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 1
        assert response.json()[0]["id"] == 10

    def test_update_project_success(self, api_client, mock_project_service):
        mock_existing = ProjectResponse(
            id=10,
            workspace_id=1,
            owner_id=1,
            name="Old Name",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_project_service.get_project.return_value = mock_existing

        mock_updated = ProjectResponse(
            id=10,
            workspace_id=1,
            owner_id=1,
            name="New Name",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_project_service.update_project.return_value = mock_updated

        payload = {"name": "New Name"}
        response = api_client.put("/api/projects/10", json=payload)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["name"] == "New Name"

    def test_update_project_not_found(self, api_client, mock_project_service):
        mock_project_service.get_project.return_value = None

        payload = {"name": "New Name"}
        response = api_client.put("/api/projects/999", json=payload)
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Project not found"

    def test_update_project_forbidden(self, api_client, mock_project_service):
        mock_existing = ProjectResponse(
            id=10,
            workspace_id=1,
            owner_id=999,  # forbidden
            name="Old Name",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_project_service.get_project.return_value = mock_existing

        payload = {"name": "New Name"}
        response = api_client.put("/api/projects/10", json=payload)
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert (
            response.json()["detail"] == "Not authorized to modify this project"
        )

    def test_delete_project_success(self, api_client, mock_project_service):
        mock_existing = ProjectResponse(
            id=10,
            workspace_id=1,
            owner_id=1,
            name="To Delete",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_project_service.get_project.return_value = mock_existing
        mock_project_service.delete_project.return_value = None

        response = api_client.delete("/api/projects/10")
        assert response.status_code == status.HTTP_204_NO_CONTENT
        mock_project_service.delete_project.assert_called_once_with(10)

    def test_delete_project_not_found(self, api_client, mock_project_service):
        mock_project_service.get_project.return_value = None

        response = api_client.delete("/api/projects/999")
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Project not found"

    def test_delete_project_forbidden(self, api_client, mock_project_service):
        mock_existing = ProjectResponse(
            id=10,
            workspace_id=1,
            owner_id=999,  # forbidden
            name="To Delete",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        mock_project_service.get_project.return_value = mock_existing

        response = api_client.delete("/api/projects/10")
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert (
            response.json()["detail"] == "Not authorized to delete this project"
        )

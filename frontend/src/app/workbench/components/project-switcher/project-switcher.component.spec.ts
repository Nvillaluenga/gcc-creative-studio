/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ProjectSwitcherComponent} from './project-switcher.component';
import {ProjectService} from '../../../services/project/project.service';
import {ProjectStateService} from '../../../services/project/project-state.service';
import {WorkspaceStateService} from '../../../services/workspace/workspace-state.service';
import {ActivatedRoute} from '@angular/router';
import {of, BehaviorSubject, throwError} from 'rxjs';
import {NO_ERRORS_SCHEMA} from '@angular/core';
import {ProjectResponse} from '../../../common/models/workbench.model';

describe('ProjectSwitcherComponent', () => {
  let component: ProjectSwitcherComponent;
  let fixture: ComponentFixture<ProjectSwitcherComponent>;
  let mockProjectService: jasmine.SpyObj<ProjectService>;
  let mockProjectStateService: any;
  let mockWorkspaceStateService: any;
  let activeProjectIdSubject: BehaviorSubject<number | null>;
  let activeWorkspaceIdSubject: BehaviorSubject<number | null>;
  let mockActivatedRoute: any;

  const mockProjects: ProjectResponse[] = [
    {
      id: 1,
      name: 'Project One',
      workspace_id: 10,
      owner_id: 1,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 2,
      name: 'Project Two',
      workspace_id: 10,
      owner_id: 1,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ];

  beforeEach(async () => {
    mockProjectService = jasmine.createSpyObj('ProjectService', [
      'getProjects',
      'updateProject',
      'createProject',
    ]);

    activeProjectIdSubject = new BehaviorSubject<number | null>(null);
    mockProjectStateService = {
      activeProjectId$: activeProjectIdSubject.asObservable(),
      getActiveProjectId: jasmine
        .createSpy('getActiveProjectId')
        .and.callFake(() => activeProjectIdSubject.getValue()),
      setActiveProjectId: jasmine
        .createSpy('setActiveProjectId')
        .and.callFake((id: number | null) => activeProjectIdSubject.next(id)),
    };

    activeWorkspaceIdSubject = new BehaviorSubject<number | null>(null);
    mockWorkspaceStateService = {
      activeWorkspaceId$: activeWorkspaceIdSubject.asObservable(),
      getActiveWorkspaceId: jasmine
        .createSpy('getActiveWorkspaceId')
        .and.callFake(() => activeWorkspaceIdSubject.getValue()),
    };

    mockActivatedRoute = {
      snapshot: {
        queryParams: {},
      },
    };

    // Ensure we start with no query parameters in window.location.search
    window.history.pushState({}, '', '/');

    await TestBed.configureTestingModule({
      imports: [ProjectSwitcherComponent],
      providers: [
        {provide: ProjectService, useValue: mockProjectService},
        {provide: ProjectStateService, useValue: mockProjectStateService},
        {provide: WorkspaceStateService, useValue: mockWorkspaceStateService},
        {provide: ActivatedRoute, useValue: mockActivatedRoute},
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectSwitcherComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('ngOnInit & activeWorkspaceId$ subscriptions', () => {
    it('should initialize with empty projects when workspaceId is null', () => {
      fixture.detectChanges();
      expect(component.projects).toEqual([]);
      expect(component.selectedProjectId).toBeNull();
    });

    it('should set activeWorkspaceId and load projects when workspaceId is emitted', () => {
      mockProjectService.getProjects.and.returnValue(of(mockProjects));
      fixture.detectChanges();

      activeWorkspaceIdSubject.next(10);
      expect(component.activeWorkspaceId).toBe(10);
      expect(mockProjectService.getProjects).toHaveBeenCalledWith(10);
    });

    it('should set projects to empty array when workspaceId becomes null', () => {
      mockProjectService.getProjects.and.returnValue(of(mockProjects));
      fixture.detectChanges();

      activeWorkspaceIdSubject.next(10);
      expect(component.projects).toEqual(mockProjects);

      activeWorkspaceIdSubject.next(null);
      expect(component.projects).toEqual([]);
      expect(component.selectedProjectId).toBeNull();
    });

    it('should update selectedProjectId when activeProjectId$ emits', () => {
      fixture.detectChanges();
      activeProjectIdSubject.next(42);
      expect(component.selectedProjectId).toBe(42);
    });
  });

  describe('loadProjects', () => {
    it('should create default project if getProjects returns empty list', () => {
      mockProjectService.getProjects.and.returnValue(of([]));
      const defaultProj: ProjectResponse = {
        id: 99,
        name: 'Default Project',
        workspace_id: 10,
        owner_id: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };
      mockProjectService.createProject.and.returnValue(of(defaultProj));

      fixture.detectChanges();
      activeWorkspaceIdSubject.next(10);

      expect(mockProjectService.getProjects).toHaveBeenCalledWith(10);
      expect(mockProjectService.createProject).toHaveBeenCalledWith({
        workspace_id: 10,
        name: 'Default Project',
      });
      expect(component.projects).toEqual([defaultProj]);
      expect(component.selectedProjectId).toBe(99);
      expect(mockProjectStateService.setActiveProjectId).toHaveBeenCalledWith(
        99,
      );
    });

    it('should select matched project if it exists in the project list', () => {
      mockProjectService.getProjects.and.returnValue(of(mockProjects));
      mockProjectStateService.getActiveProjectId.and.returnValue(2);

      fixture.detectChanges();
      activeWorkspaceIdSubject.next(10);

      expect(component.selectedProjectId).toBe(2);
    });

    it('should set first project as active if active project does not match and no route param bypass', () => {
      mockProjectService.getProjects.and.returnValue(of(mockProjects));
      mockProjectStateService.getActiveProjectId.and.returnValue(999); // No match

      fixture.detectChanges();
      activeWorkspaceIdSubject.next(10);

      expect(mockProjectStateService.setActiveProjectId).toHaveBeenCalledWith(
        null,
      );
      expect(component.selectedProjectId).toBe(1); // falls back to projects[0]
      expect(mockProjectStateService.setActiveProjectId).toHaveBeenCalledWith(
        1,
      );
    });

    it('should handle getProjects error gracefully', () => {
      const consoleSpy = spyOn(console, 'error');
      mockProjectService.getProjects.and.returnValue(
        throwError(() => new Error('API Error')),
      );

      fixture.detectChanges();
      activeWorkspaceIdSubject.next(10);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load projects:',
        jasmine.any(Error),
      );
    });
  });

  describe('Route query bypass / hasRouteProject', () => {
    it('should bypass initial load when route parameters are present during sync emit', () => {
      mockProjectService.getProjects.and.returnValue(of(mockProjects));
      window.history.pushState({}, '', '?storyboardId=5');

      activeWorkspaceIdSubject.next(10);
      fixture.detectChanges();

      // Should not have called getProjects because isSyncEmit was true and hasRouteProject was true
      expect(mockProjectService.getProjects).not.toHaveBeenCalled();
    });

    it('should bypass default project selection on initial load if route params exist', () => {
      mockProjectService.getProjects.and.returnValue(of(mockProjects));
      mockProjectStateService.getActiveProjectId.and.returnValue(999); // No match

      // Push route param before loading
      window.history.pushState({}, '', '?timelineId=10');

      fixture.detectChanges();

      // Async emit (isSyncEmit is false now)
      activeWorkspaceIdSubject.next(10);

      expect(mockProjectService.getProjects).toHaveBeenCalledWith(10);
      // It should NOT call setActiveProject fallback to projects[0] because hasRouteProject is true
      expect(component.selectedProjectId).toBeNull();
    });
  });

  describe('projectOptions getter', () => {
    it('should map projects to DropdownOptions properly', () => {
      component.projects = [
        {
          id: 1,
          name: 'Proj A',
          workspace_id: 10,
          owner_id: 1,
          created_at: '',
          updated_at: '',
        },
        {
          id: 2,
          name: '',
          workspace_id: 10,
          owner_id: 1,
          created_at: '',
          updated_at: '',
        }, // Empty name fallback
      ];

      const options = component.projectOptions;
      expect(options.length).toBe(2);
      expect(options[0]).toEqual({value: 1, label: 'Proj A', icon: 'folder'});
      expect(options[1]).toEqual({
        value: 2,
        label: 'Project 2',
        icon: 'folder',
      });
    });
  });

  describe('selectProjectById', () => {
    it('should set active project if ID matches in projects', () => {
      fixture.detectChanges();
      component.projects = mockProjects;

      component.selectProjectById(2);
      expect(component.selectedProjectId).toBe(2);
      expect(mockProjectStateService.setActiveProjectId).toHaveBeenCalledWith(
        2,
      );
    });

    it('should do nothing if ID is not found in projects', () => {
      component.projects = mockProjects;
      fixture.detectChanges();

      component.selectProjectById(999);
      expect(mockProjectStateService.setActiveProjectId).not.toHaveBeenCalled();
    });
  });

  describe('renameProject', () => {
    it('should call updateProject and update project name on success', () => {
      component.projects = [
        {
          id: 1,
          name: 'Old Name',
          workspace_id: 10,
          owner_id: 1,
          created_at: '',
          updated_at: '',
        },
      ];
      const updatedProj: ProjectResponse = {
        id: 1,
        name: 'New Name',
        workspace_id: 10,
        owner_id: 1,
        created_at: '',
        updated_at: '',
      };
      mockProjectService.updateProject.and.returnValue(of(updatedProj));

      component.renameProject({
        option: {value: 1, label: 'Old Name'},
        newValue: 'New Name',
      });

      expect(mockProjectService.updateProject).toHaveBeenCalledWith(1, {
        name: 'New Name',
      } as any);
      expect(component.projects[0].name).toBe('New Name');
    });

    it('should handle rename error gracefully', () => {
      const consoleSpy = spyOn(console, 'error');
      component.projects = [
        {
          id: 1,
          name: 'Old Name',
          workspace_id: 10,
          owner_id: 1,
          created_at: '',
          updated_at: '',
        },
      ];
      mockProjectService.updateProject.and.returnValue(
        throwError(() => new Error('Rename Error')),
      );

      component.renameProject({
        option: {value: 1, label: 'Old Name'},
        newValue: 'New Name',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to rename project:',
        jasmine.any(Error),
      );
      expect(component.projects[0].name).toBe('Old Name');
    });
  });

  describe('createProject', () => {
    it('should return if activeWorkspaceId is null', () => {
      component.activeWorkspaceId = null;
      component.createProject('New Project');
      expect(mockProjectService.createProject).not.toHaveBeenCalled();
    });

    it('should call createProject and then refresh project list', () => {
      component.activeWorkspaceId = 10;
      const newProj: ProjectResponse = {
        id: 3,
        name: 'New Project',
        workspace_id: 10,
        owner_id: 1,
        created_at: '',
        updated_at: '',
      };
      mockProjectService.createProject.and.returnValue(of(newProj));

      // After creation, list refreshes
      const updatedList = [...mockProjects, newProj];
      mockProjectService.getProjects.and.returnValue(of(updatedList));

      component.createProject('New Project');

      expect(mockProjectService.createProject).toHaveBeenCalledWith({
        workspace_id: 10,
        name: 'New Project',
      });
      expect(mockProjectService.getProjects).toHaveBeenCalledWith(10);
      expect(component.projects).toEqual(updatedList);
      expect(component.selectedProjectId).toBe(3);
    });

    it('should fall back to last project if created project is not found in the refreshed list', () => {
      component.activeWorkspaceId = 10;
      const newProj: ProjectResponse = {
        id: 999, // Some ID
        name: 'New Project',
        workspace_id: 10,
        owner_id: 1,
        created_at: '',
        updated_at: '',
      };
      mockProjectService.createProject.and.returnValue(of(newProj));

      // Refreshed list does not contain 999 for some reason, returns mockProjects instead
      mockProjectService.getProjects.and.returnValue(of(mockProjects));

      component.createProject('New Project');

      // Should fall back to the last project in the list (id: 2)
      expect(component.selectedProjectId).toBe(2);
    });

    it('should log error when createProject fails', () => {
      component.activeWorkspaceId = 10;
      const consoleSpy = spyOn(console, 'error');
      mockProjectService.createProject.and.returnValue(
        throwError(() => new Error('Creation Error')),
      );

      component.createProject('New Project');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to create project',
        jasmine.any(Error),
      );
    });
  });

  describe('createDefaultProject error case', () => {
    it('should clear selectedProjectId and active project on createDefaultProject error', () => {
      mockProjectService.getProjects.and.returnValue(of([]));
      mockProjectService.createProject.and.returnValue(
        throwError(() => new Error('Default Creation Error')),
      );
      const consoleSpy = spyOn(console, 'error');

      fixture.detectChanges();
      activeWorkspaceIdSubject.next(10);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to create default project:',
        jasmine.any(Error),
      );
      expect(component.selectedProjectId).toBeNull();
      expect(mockProjectStateService.setActiveProjectId).toHaveBeenCalledWith(
        null,
      );
    });
  });
});

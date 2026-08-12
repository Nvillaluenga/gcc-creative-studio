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

import {TestBed, fakeAsync, tick} from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {AgentChatService} from './agent-chat.service';
import {AuthService} from '../../common/services/auth.service';
import {of} from 'rxjs';
import {environment} from '../../../environments/environment';

describe('AgentChatService', () => {
  let service: AgentChatService;
  let httpTestingController: HttpTestingController;
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      getValidIdentityPlatformToken$: jasmine
        .createSpy('getValidIdentityPlatformToken$')
        .and.returnValue(of('mock-token')),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AgentChatService,
        {provide: AuthService, useValue: mockAuthService},
      ],
    });

    service = TestBed.inject(AgentChatService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getSessions', () => {
    it('should query backend with appName, workspaceId and projectId and cache results', () => {
      const mockSessions = [{id: 's1', name: 'Session 1'}];

      service.getSessions(1, false, null, null, 10).subscribe(sessions => {
        expect(sessions).toEqual(mockSessions as any);
      });

      const req = httpTestingController.expectOne(
        `${environment.backendURL}/agent/sessions?appName=ads_x&workspace_id=1&project_id=10`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockSessions);

      // Verify caching: calling it again with same params shouldn't trigger HTTP request
      service.getSessions(1, false, null, null, 10).subscribe(sessions => {
        expect(sessions).toEqual(mockSessions as any);
      });
      httpTestingController.expectNone(
        `${environment.backendURL}/agent/sessions?appName=ads_x&workspace_id=1&project_id=10`,
      );
    });

    it('should bypass caching if forceRefresh is true', () => {
      const mockSessions = [{id: 's1', name: 'Session 1'}];
      service.sessions.set(mockSessions as any);
      service['lastLoadedWorkspaceId'] = 1;
      service['lastLoadedProjectId'] = 10;
      service['lastLoadedAgent'] = 'ads_x';

      service.getSessions(1, true, null, null, 10).subscribe(sessions => {
        expect(sessions).toEqual(mockSessions as any);
      });

      const req = httpTestingController.expectOne(
        `${environment.backendURL}/agent/sessions?appName=ads_x&workspace_id=1&project_id=10`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockSessions);
    });
  });

  describe('createSession', () => {
    it('should post session configuration and return created session', () => {
      const mockSession = {id: 's2', name: 'New Session'};

      service.createSession(1, 10, 'New Session').subscribe(session => {
        expect(session).toEqual(mockSession as any);
      });

      const req = httpTestingController.expectOne(
        `${environment.backendURL}/agent/sessions?appName=ads_x&workspace_id=1`,
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({projectId: 10, name: 'New Session'});
      req.flush(mockSession);
    });
  });

  describe('getSessionDetail', () => {
    it('should query details with session and storyboard parameter filters', () => {
      const mockDetail = {session: {id: 's1'}, storyboard: {id: 202}};

      service.getSessionDetail(1, 's1', 202).subscribe(detail => {
        expect(detail).toEqual(mockDetail as any);
      });

      const req = httpTestingController.expectOne(
        `${environment.backendURL}/agent/sessions/detail?workspace_id=1&session_id=s1&storyboard_id=202`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockDetail);
    });
  });

  describe('deleteSession', () => {
    it('should send delete request for session', () => {
      service.deleteSession('s1', 1).subscribe();

      const req = httpTestingController.expectOne(
        `${environment.backendURL}/agent/sessions/s1?appName=ads_x&workspace_id=1`,
      );
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('generateTitle', () => {
    it('should post chat text to title generation endpoint', () => {
      const mockTitle = {title: 'New Chat Title', summary: 'Summary text'};

      service.generateTitle('User initial message').subscribe(res => {
        expect(res).toEqual(mockTitle);
      });

      const req = httpTestingController.expectOne(
        `${environment.backendURL}/gemini/generate-title?appName=ads_x`,
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({text: 'User initial message'});
      req.flush(mockTitle);
    });
  });

  describe('sendMessage', () => {
    let fetchSpy: jasmine.Spy;

    beforeEach(() => {
      fetchSpy = spyOn(window, 'fetch');
    });

    it('should call fetch with correct request and invoke startPolling on success', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({status: 'success'}),
      } as Response;
      fetchSpy.and.returnValue(Promise.resolve(mockResponse));
      spyOn(service, 'startPolling');

      const callbacks = {
        onMessage: jasmine.createSpy('onMessage'),
        onError: jasmine.createSpy('onError'),
        onClose: jasmine.createSpy('onClose'),
      };

      await service.sendMessage('session-123', 'Hello', 1, 10, callbacks);

      expect(fetchSpy).toHaveBeenCalled();
      expect(service.startPolling).toHaveBeenCalledWith(
        'session-123',
        callbacks,
      );
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('should handle non-ok fetch response and invoke callbacks.onError', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: () => Promise.resolve({detail: 'Bad Request'}),
        text: () => Promise.resolve('Bad Request'),
      } as Response;
      fetchSpy.and.returnValue(Promise.resolve(mockResponse));
      spyOn(service, 'startPolling');

      const callbacks = {
        onMessage: jasmine.createSpy('onMessage'),
        onError: jasmine.createSpy('onError'),
        onClose: jasmine.createSpy('onClose'),
      };

      await service.sendMessage('session-123', 'Hello', 1, 10, callbacks);

      expect(fetchSpy).toHaveBeenCalled();
      expect(service.startPolling).not.toHaveBeenCalled();
      expect(callbacks.onError).toHaveBeenCalled();
    });

    it('should handle network error or promise rejection and invoke callbacks.onError', async () => {
      fetchSpy.and.returnValue(Promise.reject(new Error('Network Error')));
      spyOn(service, 'startPolling');

      const callbacks = {
        onMessage: jasmine.createSpy('onMessage'),
        onError: jasmine.createSpy('onError'),
        onClose: jasmine.createSpy('onClose'),
      };

      await service.sendMessage('session-123', 'Hello', 1, 10, callbacks);

      expect(fetchSpy).toHaveBeenCalled();
      expect(service.startPolling).not.toHaveBeenCalled();
      expect(callbacks.onError).toHaveBeenCalledWith(jasmine.any(Error));
    });
  });

  describe('Polling lifecycle', () => {
    let fetchSpy: jasmine.Spy;

    beforeEach(() => {
      fetchSpy = spyOn(window, 'fetch');
    });

    it('should query poll url on interval ticks and parse line events', fakeAsync(() => {
      const mockPollResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            events: [
              'data: {"content": {"parts": [{"text": "Hello client"}]}}',
              'data: [DONE]',
            ],
          }),
      } as Response;
      fetchSpy.and.returnValue(Promise.resolve(mockPollResponse));

      const callbacks = {
        onMessage: jasmine.createSpy('onMessage'),
        onError: jasmine.createSpy('onError'),
        onClose: jasmine.createSpy('onClose'),
      };

      service.startPolling('session-123', callbacks);

      // Advance clock by 2500ms to trigger first tick
      tick(2500);

      // Flush microtasks for fetch resolution
      tick();

      expect(fetchSpy).toHaveBeenCalled();
      expect(callbacks.onMessage).toHaveBeenCalledWith({
        content: {parts: [{text: 'Hello client'}]},
      });
      expect(callbacks.onClose).toHaveBeenCalled();
      expect(service['activePollInterval']).toBeNull();
    }));

    it('should handle error block in polled data', fakeAsync(() => {
      const mockPollResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            events: ['data: {"error": "AI Agent crashed"}'],
          }),
      } as Response;
      fetchSpy.and.returnValue(Promise.resolve(mockPollResponse));

      const callbacks = {
        onMessage: jasmine.createSpy('onMessage'),
        onError: jasmine.createSpy('onError'),
        onClose: jasmine.createSpy('onClose'),
      };

      service.startPolling('session-123', callbacks);

      tick(2500);
      tick();

      expect(callbacks.onError).toHaveBeenCalledWith(jasmine.any(Error));
      expect(service['activePollInterval']).toBeNull();
    }));

    it('should fallback to plain text if polled data line is not JSON', fakeAsync(() => {
      const mockPollResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            events: ['data: simple plain text response'],
          }),
      } as Response;
      fetchSpy.and.returnValue(Promise.resolve(mockPollResponse));

      const callbacks = {
        onMessage: jasmine.createSpy('onMessage'),
        onError: jasmine.createSpy('onError'),
        onClose: jasmine.createSpy('onClose'),
      };

      service.startPolling('session-123', callbacks);

      tick(2500);
      tick();

      expect(callbacks.onMessage).toHaveBeenCalledWith({
        content: {
          parts: [{text: 'simple plain text response'}],
        },
      });
      service.stopPolling();
    }));

    it('should clear interval on stopPolling', () => {
      const callbacks = {};
      service.startPolling('session-123', callbacks);
      expect(service['activePollInterval']).not.toBeNull();

      service.stopPolling();
      expect(service['activePollInterval']).toBeNull();
    });
  });
});

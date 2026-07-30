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

import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import {ChatInterfaceComponent} from './chat-interface.component';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';
import {ActivatedRoute, Router} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {MatDialogModule, MatDialog} from '@angular/material/dialog';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';
import {MarkdownModule, MarkdownService} from 'ngx-markdown';
import {signal, CUSTOM_ELEMENTS_SCHEMA, Injector} from '@angular/core';
import {of, Subject, BehaviorSubject, throwError} from 'rxjs';
import {delay} from 'rxjs/operators';
import {AppInjector, setAppInjector} from '../../../app-injector';
import {NotificationService} from '../../../common/services/notification.service';
import {GalleryService} from '../../../gallery/gallery.service';
import {
  AgentChatService,
  SSECallbacks,
} from '../../services/agent-chat.service';
import {WorkspaceStateService} from '../../../services/workspace/workspace-state.service';
import {ProjectStateService} from '../../../services/project/project-state.service';
import {StoryboardService} from '../../../services/storyboard/storyboard.service';
import {TimelineStateService} from '../../services/timeline-state.service';

describe('ChatInterfaceComponent', () => {
  let component: ChatInterfaceComponent;
  let fixture: ComponentFixture<ChatInterfaceComponent>;
  let agentChatService: any;
  let sseCallbacks: any;
  let storyboardService: any;
  let queryParamsSubject: BehaviorSubject<any>;
  let router: any;

  beforeEach(async () => {
    const mockAgentChatService = {
      selectedSessionId: signal(null),
      currentStoryboard: signal(null),
      activeAgent: signal('director'),
      isGeneratingStoryboard: signal(false),
      isGeneratingVideo: signal(false),
      sessions: signal([]),
      chatMessages: signal([]),
      generateVideoRequest$: new Subject<void>(),
      videoGenerated$: new Subject<any>(),
      getSessions: jasmine.createSpy('getSessions').and.returnValue(of([])),
      getSessionDetail: jasmine
        .createSpy('getSessionDetail')
        .and.callFake((workspaceId: number, sessionId: string) => {
          const mockEvents = [
            {
              author: 'user',
              content: {
                parts: [{text: 'Hello, what is up?'}],
              },
            },
            {
              author: 'model',
              content: {
                parts: [
                  {text: 'I am here. [System Note: ignore this]'},
                  {
                    functionResponse: {
                      response: {
                        result: JSON.stringify({
                          asset: {
                            id: 'a1',
                            presignedThumbnailUrl: 'http://img.png',
                          },
                        }),
                      },
                    },
                  },
                ],
              },
            },
            {
              author: 'model',
              actions: {
                storyboard: {
                  scenes: [{id: 1, description: 'Brief Scene'}],
                },
              },
              content: {
                parts: [],
              },
            },
          ];
          return of({
            session: {id: sessionId || '123', events: mockEvents},
            storyboard: {id: 202, timeline_id: 42},
          });
        }),
      createSession: jasmine
        .createSpy('createSession')
        .and.returnValue(of({id: 'new-session'})),
      generateTitle: jasmine
        .createSpy('generateTitle')
        .and.returnValue(of({title: 'New Chat', summary: 'Summary'})),
      deleteSession: jasmine
        .createSpy('deleteSession')
        .and.returnValue(of(undefined)),
      sendMessage: jasmine
        .createSpy('sendMessage')
        .and.callFake(
          (
            sessionId: string,
            message: any,
            workspaceId: number | null,
            projectId: number | null,
            callbacks: any,
          ) => {
            sseCallbacks = callbacks;
          },
        ),
      stopPolling: jasmine.createSpy('stopPolling'),
      startPolling: jasmine
        .createSpy('startPolling')
        .and.callFake((sessionId: string, callbacks: any) => {
          sseCallbacks = callbacks;
        }),
    };

    let isFirstCall = true;
    const mockWorkspaceStateService = {
      getActiveWorkspaceId: jasmine
        .createSpy('getActiveWorkspaceId')
        .and.callFake(() => {
          if (isFirstCall) {
            isFirstCall = false;
            return null;
          }
          return 1;
        }),
      setActiveWorkspaceId: jasmine.createSpy('setActiveWorkspaceId'),
      activeWorkspaceId$: of(1),
    };

    const mockProjectStateService = {
      getActiveProjectId: jasmine
        .createSpy('getActiveProjectId')
        .and.returnValue(10),
      setActiveProjectId: jasmine.createSpy('setActiveProjectId'),
      activeProjectId$: of(10),
    };

    const mockStoryboardService = {
      getStoryboardForSession: jasmine
        .createSpy('getStoryboardForSession')
        .and.returnValue(of([])),
      getStoryboard: jasmine
        .createSpy('getStoryboard')
        .and.callFake((id: number) =>
          of({
            id,
            timeline_id: 42,
          }),
        ),
    };

    const mockTimelineStateService = {
      loadedTimelineId: signal<any>(undefined),
      timelineClips: signal<any>([]),
      transitions: signal<any>([]),
      transitionIn: signal<any>(null),
      transitionOut: signal<any>(null),
    };

    const mockGalleryService = {
      getMedia: jasmine.createSpy('getMedia').and.returnValue(
        of({
          presignedUrls: ['http://media-url'],
          presignedThumbnailUrls: ['http://thumb-url'],
        }),
      ),
      getAsset: jasmine.createSpy('getAsset').and.returnValue(
        of({
          presignedUrls: ['http://asset-url'],
          presignedThumbnailUrls: ['http://asset-thumb-url'],
        }),
      ),
    };

    queryParamsSubject = new BehaviorSubject<any>({});

    await TestBed.configureTestingModule({
      declarations: [ChatInterfaceComponent],
      imports: [
        HttpClientTestingModule,
        RouterTestingModule,
        FormsModule,
        MatDialogModule,
        MatSnackBarModule,
        MarkdownModule.forRoot(),
      ],
      providers: [
        {provide: AgentChatService, useValue: mockAgentChatService},
        {provide: WorkspaceStateService, useValue: mockWorkspaceStateService},
        {provide: ProjectStateService, useValue: mockProjectStateService},
        {provide: StoryboardService, useValue: mockStoryboardService},
        {provide: TimelineStateService, useValue: mockTimelineStateService},
        {provide: GalleryService, useValue: mockGalleryService},
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: queryParamsSubject.asObservable(),
          },
        },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatInterfaceComponent);
    component = fixture.componentInstance;
    agentChatService = TestBed.inject(AgentChatService);
    storyboardService = TestBed.inject(StoryboardService);
    router = TestBed.inject(Router);
    fixture.detectChanges();
    if (AppInjector) {
      if (jasmine.isSpy(AppInjector.get)) {
        (AppInjector.get as jasmine.Spy).and.callFake((token: any) => {
          if (token === NotificationService) {
            return TestBed.inject(NotificationService);
          }
          return undefined;
        });
      } else {
        spyOn(AppInjector, 'get').and.callFake((token: any) => {
          if (token === NotificationService) {
            return TestBed.inject(NotificationService);
          }
          return undefined;
        });
      }
    } else {
      setAppInjector(TestBed.inject(Injector));
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('markdown link renderer', () => {
    let linkRenderer: (arg1: any, arg2?: any, arg3?: any) => string;

    beforeEach(() => {
      linkRenderer = component['markdownService'].renderer.link;
    });

    it('should render safe relative links and resolve them against the window origin', () => {
      const result = linkRenderer(
        '/gallery/123',
        'Gallery Title',
        'Go to gallery',
      );
      const currentOrigin = window.location.origin;
      expect(result).toContain(`href="${currentOrigin}/gallery/123"`);
      expect(result).toContain('title="Gallery Title"');
      expect(result).toContain('>Go to gallery</a>');
    });

    it('should render same-origin absolute links', () => {
      const currentOrigin = window.location.origin;
      const result = linkRenderer(
        `${currentOrigin}/asset-detail/456`,
        'Asset Detail',
        'View Asset',
      );
      expect(result).toContain(`href="${currentOrigin}/asset-detail/456"`);
      expect(result).toContain('title="Asset Detail"');
      expect(result).toContain('>View Asset</a>');
    });

    it('should sanitize and render external absolute links as plain text', () => {
      const result = linkRenderer(
        'https://malicious.com/attack',
        'Attack',
        'Click Me',
      );
      expect(result).toBe('Click Me');
    });

    it('should sanitize javascript protocol links as plain text', () => {
      const result = linkRenderer('javascript:alert(1)', 'XSS', 'Click here');
      expect(result).toBe('Click here');
    });

    it('should sanitize javascript protocol links with leading spaces as plain text', () => {
      const result = linkRenderer(
        '   javascript:alert(1)  ',
        'XSS',
        'Click here',
      );
      expect(result).toBe('Click here');
    });

    it('should sanitize javascript links containing control characters (tabs, newlines, carriage returns) as plain text', () => {
      const resultTab = linkRenderer(
        'java\tscript:alert(1)',
        'XSS',
        'Click here',
      );
      expect(resultTab).toBe('Click here');

      const resultNewline = linkRenderer(
        'java\nscript:alert(2)',
        'XSS',
        'Click here',
      );
      expect(resultNewline).toBe('Click here');

      const resultCR = linkRenderer(
        'java\rscript:alert(3)',
        'XSS',
        'Click here',
      );
      expect(resultCR).toBe('Click here');
    });

    it('should render relative links with colons in query parameters or path', () => {
      const currentOrigin = window.location.origin;
      const resultQuery = linkRenderer(
        '/gallery/view?id=abc:123',
        'Gallery Query',
        'View query',
      );
      expect(resultQuery).toContain(
        `href="${currentOrigin}/gallery/view?id=abc:123"`,
      );

      const resultPath = linkRenderer(
        '/assets/color:blue',
        'Blue Assets',
        'Blue',
      );
      expect(resultPath).toContain(`href="${currentOrigin}/assets/color:blue"`);
    });

    it('should escape double quotes in the title attribute', () => {
      const result = linkRenderer(
        '/gallery/123',
        'A "cool" title',
        'Go to gallery',
      );
      expect(result).toContain('title="A &quot;cool&quot; title"');
    });
  });

  it('should initialize and load sessions', () => {
    expect(agentChatService.getSessions).toHaveBeenCalledWith(
      1,
      false,
      null,
      null,
      10,
    );
  });

  it('should start a new chat', () => {
    component.startNewChat();
    expect(component.currentSessionId).toBeNull();
    expect(agentChatService.selectedSessionId()).toBeNull();
    expect(agentChatService.currentStoryboard()).toBeNull();
  });

  it('should handle agent selection change', () => {
    component.onAgentChange('script_writer');
    expect(agentChatService.activeAgent()).toBe('script_writer');
  });

  it('should handle session selection change', () => {
    spyOn(component, 'loadChatMessages').and.callThrough();
    component.onSessionChange('session-789');
    expect(component.currentSessionId).toBe('session-789');
    expect(component.loadChatMessages).toHaveBeenCalledWith('session-789');
  });

  it('should handle delete chat session', () => {
    const mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    mockDialogRef.afterClosed.and.returnValue(of(true));
    spyOn(component['dialog'], 'open').and.returnValue(mockDialogRef);

    component.currentSessionId = 'session-123';
    component.deleteChat();

    expect(component['dialog'].open).toHaveBeenCalled();
    expect(agentChatService.deleteSession).toHaveBeenCalledWith(
      'session-123',
      1,
    );
    expect(component.currentSessionId).toBeNull();
  });

  it('should handle image selector dialog and append selected images', () => {
    const mockSelected = [
      {
        id: 'img1',
        name: 'img1.png',
        type: 'source_asset',
        url: 'http://test.png',
      },
    ];
    const mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    mockDialogRef.afterClosed.and.returnValue(of(mockSelected));
    spyOn(component['dialog'], 'open').and.returnValue(mockDialogRef);

    component.openImageSelector();

    expect(component['dialog'].open).toHaveBeenCalled();
    expect(component.selectedImages()).toEqual(mockSelected as any);
  });

  it('should allow removing a selected image by index', () => {
    component.selectedImages.set([
      {id: 'img1', name: 'img1.png'} as any,
      {id: 'img2', name: 'img2.png'} as any,
    ]);

    component.removeSelectedImage(0);

    expect(component.selectedImages().length).toBe(1);
    expect((component.selectedImages()[0] as any).id).toBe('img2');
  });

  it('should toggle input expansion state', () => {
    const afterClosedSubject = new Subject<void>();
    spyOn(component['dialog'], 'open').and.returnValue({
      afterClosed: () => afterClosedSubject.asObservable(),
      close: () => {},
    } as any);

    component.isInputExpanded.set(false);
    component.toggleInputExpand();
    expect(component.isInputExpanded()).toBeTrue();

    component.toggleInputExpand();
    expect(component.isInputExpanded()).toBeFalse();
  });

  it('should handle keydown Enter to send message without shift key', () => {
    spyOn(component, 'submitChat').and.callThrough();
    const event = new KeyboardEvent('keydown', {key: 'Enter', shiftKey: false});
    spyOn(event, 'preventDefault');

    component.onKeyDown(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.submitChat).toHaveBeenCalled();
  });

  it('should not send message on Enter if shift key is pressed', () => {
    spyOn(component, 'submitChat');
    const event = new KeyboardEvent('keydown', {key: 'Enter', shiftKey: true});

    component.onKeyDown(event);

    expect(component.submitChat).not.toHaveBeenCalled();
  });

  it('should create a session on sendChatMessage if currentSessionId is null', () => {
    component.currentSessionId = null;
    spyOn<any>(component, 'executeSendMessage');

    component.sendChatMessage('hello');

    expect(agentChatService.createSession).toHaveBeenCalledWith(
      1,
      10,
      'New Chat',
    );
    expect(component.currentSessionId).toBe('new-session' as any);
    expect(component['executeSendMessage']).toHaveBeenCalledWith('hello');
  });

  it('should parse and extract storyboards from JSON block in parseAndExtractJSONs', () => {
    const textWithJson =
      'Some chat response\n```json\n{"scenes": [{"id": 1, "description": "Scene 1"}]}\n```';
    const result = component['parseAndExtractJSONs'](textWithJson);

    expect(result.storyboards.length).toBe(1);
    expect((result.storyboards[0].scenes[0] as any).description).toBe(
      'Scene 1',
    );
    expect(result.cleanText).toBe('Some chat response');
  });

  it('should parse and extract timeline clips from JSON block in parseAndExtractJSONs', () => {
    const textWithTimeline =
      'Timeline response\n```json\n{"clips": [{"id": "c1"}], "assets": []}\n```';
    const result = component['parseAndExtractJSONs'](textWithTimeline);

    expect(result.timelines.length).toBe(1);
    expect((result.timelines[0] as any).clips[0].id).toBe('c1');
    expect(result.cleanText).toBe('Timeline response');
  });

  it('should process SSE stream events onMessage, onError and onClose', () => {
    component.currentSessionId = 'session-123';
    component.selectedImages.set([]);
    component.sendChatMessage('hello');

    expect(agentChatService.sendMessage).toHaveBeenCalled();
    expect(sseCallbacks).toBeDefined();

    // Test text message chunk
    sseCallbacks.onMessage({
      content: {
        parts: [{text: 'Hello user! Here is your story.'}],
      },
    });
    expect(component.chatMessages().length).toBe(3);
    expect(component.chatMessages()[2].text).toBe(
      'Hello user! Here is your story.',
    );

    // Test function response with storyboard_id
    sseCallbacks.onMessage({
      content: {
        parts: [
          {
            functionResponse: {
              response: {
                result: JSON.stringify({storyboard_id: 101}),
              },
            },
          },
        ],
      },
    });
    expect(storyboardService.getStoryboard).toHaveBeenCalledWith(101);
    expect(agentChatService.currentStoryboard()).toEqual({
      id: 101,
      timeline_id: 42,
    } as any);

    // Test error
    spyOn(console, 'error');
    sseCallbacks.onError('some error');
    expect(console.error).toHaveBeenCalled();

    // Test onClose
    sseCallbacks.onClose();
    expect(storyboardService.getStoryboardForSession).toHaveBeenCalled();
  });

  it('should open image src in window.open onMessageClick', () => {
    spyOn(window, 'open');
    const mockImg = document.createElement('img');
    mockImg.setAttribute('src', 'http://example.com/test.jpg');
    const event = {
      target: mockImg,
      preventDefault: jasmine.createSpy('preventDefault'),
    } as any;

    component.onMessageClick(event);

    expect(window.open).toHaveBeenCalledWith(
      'http://example.com/test.jpg',
      '_blank',
    );
  });

  it('should open asset links in window.open onMessageClick and prevent default', () => {
    spyOn(window, 'open');
    const mockLink = document.createElement('a');
    mockLink.setAttribute(
      'href',
      'https://storage.googleapis.com/bucket/file.png',
    );
    const event = {
      target: mockLink,
      preventDefault: jasmine.createSpy('preventDefault'),
    } as any;

    component.onMessageClick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledWith(
      'https://storage.googleapis.com/bucket/file.png',
      '_blank',
    );
  });

  it('should return asset URL for MediaItemSelection with presignedThumbnailUrls', () => {
    const selection = {
      mediaItem: {
        presignedThumbnailUrls: ['http://thumb1.png'],
        presignedUrls: ['http://url1.png'],
      },
      selectedIndex: 0,
    };
    const url = component.getAssetUrl(selection as any);
    expect(url).toBe('http://thumb1.png');
  });

  it('should return asset URL for SourceAssetResponseDto with presignedThumbnailUrl', () => {
    const asset = {
      presignedThumbnailUrl: 'http://asset-thumb.png',
      id: 'a1',
    };
    const url = component.getAssetUrl(asset as any);
    expect(url).toBe('http://asset-thumb.png');
  });

  it('should fallback to backend download URL for SourceAssetResponseDto', () => {
    const asset = {
      id: 'a1',
    };
    const url = component.getAssetUrl(asset as any);
    expect(url).toContain('/assets/source-assets/a1/download');
  });

  it('should scroll to bottom in scrollToBottom if chatContainer exists', fakeAsync(() => {
    const mockElement = {scrollTop: 0, scrollHeight: 1500};
    component['chatContainer'] = {nativeElement: mockElement} as any;

    component['scrollToBottom']();
    tick(50);

    expect(mockElement.scrollTop).toBe(1500);
  }));

  it('should load session details on startup if session exists in workspace', () => {
    agentChatService.getSessions.and.returnValue(
      of([
        {
          id: 'session-456',
          state: {current_storyboard_id: 202},
        },
      ]),
    );

    (
      TestBed.inject(WorkspaceStateService).getActiveWorkspaceId as jasmine.Spy
    ).and.returnValue(1);
    (
      TestBed.inject(ProjectStateService).getActiveProjectId as jasmine.Spy
    ).and.returnValue(10);
    agentChatService.selectedSessionId.set('session-456');
    agentChatService.currentStoryboard.set({id: 202} as any);

    fixture.detectChanges();

    expect(agentChatService.getSessionDetail).toHaveBeenCalledWith(
      1,
      'session-456',
      202,
    );
  });

  it('should trigger sendChatMessage when generateVideoRequest$ emits', () => {
    spyOn(component, 'sendChatMessage');
    agentChatService.currentStoryboard.set({id: 888} as any);

    agentChatService.generateVideoRequest$.next();

    expect(component.sendChatMessage).toHaveBeenCalledWith(
      'Please generate the final video for storyboard ID 888.',
    );
  });

  it('should trigger sendChatMessage when generateVideoRequest$ emits and no storyboard id exists', () => {
    spyOn(component, 'sendChatMessage');
    agentChatService.currentStoryboard.set(null);

    agentChatService.generateVideoRequest$.next();

    expect(component.sendChatMessage).toHaveBeenCalledWith(
      "Please generate the final video matching this storyboard's approved layout.",
    );
  });

  it('should parse and extract assets from JSON block in parseAndExtractJSONs', () => {
    const textWithAsset =
      'Asset response\n```json\n{"asset": {"id": "a1", "url": "http://img.png"}}\n```';
    const result = component['parseAndExtractJSONs'](textWithAsset);

    expect(result.assets.length).toBe(1);
    expect(result.assets[0].id).toBe('a1');
    expect(result.cleanText).toBe('Asset response');
  });

  it('should parse pure JSON response in parseAndExtractJSONs when no code blocks exist', () => {
    const pureJson = '{"asset": {"id": "pure-a1"}}';
    const result = component['parseAndExtractJSONs'](pureJson);

    expect(result.assets.length).toBe(1);
    expect(result.assets[0].id).toBe('pure-a1');
    expect(result.cleanText).toBe('');
  });

  it('should extract JSON from boundary braces in parseAndExtractJSONs', () => {
    const boundaryJson =
      'Text before {"asset": {"id": "boundary-a1"}} Text after';
    const result = component['parseAndExtractJSONs'](boundaryJson);

    expect(result.assets.length).toBe(1);
    expect(result.assets[0].id).toBe('boundary-a1');
    expect(result.cleanText).toBe('Text before  Text after');
  });

  it('should perform deep search to extract storyboards in extractStoryboardData', () => {
    const nestedData = {
      wrapper: {
        inner: {
          scenes: [{id: 1, description: 'Nested Scene'}],
        },
      },
    };
    const result = component['extractStoryboardData'](nestedData);

    expect(result).toBeDefined();
    expect((result as any).scenes[0].id).toBe(1);
  });

  it('should set welcome message in addWelcomeMessage', () => {
    component.chatMessages.set([]);
    component.addWelcomeMessage();
    expect(component.chatMessages()[0].text).toContain('Izumi');
  });

  it('should map selected images to partsParams correctly in executeSendMessage', () => {
    component.currentSessionId = 'session-123';
    component.selectedImages.set([
      {
        mediaItem: {id: 10, mimeType: 'image/jpeg', base64Data: 'abc'},
        selectedIndex: 1,
      } as any,
      {
        id: 'a1',
        mimeType: 'image/png',
        base64Data: 'xyz',
      } as any,
    ]);

    component.sendChatMessage('hello');

    expect(agentChatService.sendMessage).toHaveBeenCalledWith(
      'session-123',
      [
        {text: 'hello'},
        {sourceMediaItem: {mediaItemId: 10, mediaIndex: 1, role: 'input'}},
        {sourceAssetId: 'a1'},
      ],
      1,
      10,
      jasmine.any(Object),
    );
    expect(component.selectedImages().length).toBe(0);
  });

  it('should handle actions.storyboard in SSE stream onMessage', () => {
    component.currentSessionId = 'session-123';
    component.sendChatMessage('hello');

    agentChatService.isGeneratingStoryboard.set(true);
    sseCallbacks.onMessage({
      actions: {storyboard: true},
    });

    expect(agentChatService.isGeneratingStoryboard()).toBeFalse();
  });

  it('should strip system notes from message text in SSE stream onMessage', () => {
    component.currentSessionId = 'session-123';
    component.sendChatMessage('hello');

    // Send first chunk
    sseCallbacks.onMessage({
      content: {
        parts: [{text: 'Actual text here '}],
      },
    });

    // Send second chunk with system note
    sseCallbacks.onMessage({
      content: {
        parts: [{text: '[System Note: ignore this info]'}],
      },
    });

    expect(component.chatMessages()[2].text).toBe('Actual text here');
  });

  it('should call viewAsset and onInputResize placeholders without error', () => {
    expect(() => {
      component.viewAsset('asset-1');
      const mockTextarea = document.createElement('textarea');
      mockTextarea.value = 'hello';
      component.onInputResize({target: mockTextarea} as any);
    }).not.toThrow();
  });

  it('should handle error when preloading sessions fails', () => {
    spyOn(console, 'error');
    agentChatService.getSessions.and.returnValue(
      throwError(() => new Error('Get Sessions error')),
    );

    (
      TestBed.inject(WorkspaceStateService).getActiveWorkspaceId as jasmine.Spy
    ).and.returnValue(1);
    (
      TestBed.inject(ProjectStateService).getActiveProjectId as jasmine.Spy
    ).and.returnValue(20);
    agentChatService.selectedSessionId.set('session-error-test');

    fixture.detectChanges();

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle error when getSessionDetail fails', () => {
    spyOn(console, 'error');
    agentChatService.getSessions.and.returnValue(
      of([
        {
          id: 'session-456',
          state: {current_storyboard_id: 202},
        },
      ]),
    );
    agentChatService.getSessionDetail.and.returnValue(
      throwError(() => new Error('Get Detail error')),
    );

    (
      TestBed.inject(WorkspaceStateService).getActiveWorkspaceId as jasmine.Spy
    ).and.returnValue(1);
    (
      TestBed.inject(ProjectStateService).getActiveProjectId as jasmine.Spy
    ).and.returnValue(10);
    agentChatService.selectedSessionId.set('session-456');
    agentChatService.currentStoryboard.set({id: 202} as any);

    fixture.detectChanges();

    expect(console.error).toHaveBeenCalled();
  });

  it('should map sessions to label and tooltip correctly in dropdownOptions', () => {
    component.sessions.set([
      {id: 's1', name: 'Topic 1 title', lastUpdateTime: 1780000000},
      {id: 's2', name: 'Topic 2 string title', lastUpdateTime: 1780100000},
      {id: 's3', name: '', lastUpdateTime: 1780200000},
    ]);

    const formatted = component.dropdownOptions();

    expect(formatted.length).toBe(3);
    expect(formatted[0].label).toBe('Topic 1 title');
    expect(formatted[1].label).toBe('Topic 2 string title');
    expect(formatted[2].label).toContain('- Chat');
  });

  it('should format URL and open window on viewAsset', () => {
    spyOn(window, 'open');

    component.viewAsset('source_asset:123');
    expect(window.open).toHaveBeenCalledWith('/asset-detail/123', '_blank');

    component.viewAsset('media_item:456');
    expect(window.open).toHaveBeenCalledWith('/gallery/456', '_blank');

    component.viewAsset('simple-asset');
    expect(window.open).toHaveBeenCalledWith('/gallery/simple-asset', '_blank');
  });

  it('should call deleteSession and clear session state on deleteChat', () => {
    spyOn(component['dialog'], 'open').and.returnValue({
      afterClosed: () => of(true),
    } as any);
    component.currentSessionId = 'session-123';
    component.sessions.set([
      {id: 'session-123', lastUpdateTime: 123},
      {id: 'session-other', lastUpdateTime: 456},
    ]);

    component.deleteChat();

    expect(agentChatService.deleteSession).toHaveBeenCalledWith(
      'session-123',
      1,
    );
    expect(component.currentSessionId).toBe('session-other');
  });

  it('should clear states on startNewChat', () => {
    component.currentSessionId = 'session-123';

    component.startNewChat();

    expect(component.currentSessionId).toBeNull();
    expect(agentChatService.selectedSessionId()).toBeNull();
    expect(component.chatMessages().length).toBe(1);
  });

  it('should log error when deleteSession fails', () => {
    spyOn(console, 'error');
    spyOn(component['dialog'], 'open').and.returnValue({
      afterClosed: () => of(true),
    } as any);
    agentChatService.deleteSession.and.returnValue(
      throwError(() => new Error('Delete failed')),
    );
    component.currentSessionId = 'session-123';

    component.deleteChat();

    expect(console.error).toHaveBeenCalled();
  });

  it('should handle error when createSession fails', () => {
    spyOn(console, 'error');
    agentChatService.createSession.and.returnValue(
      throwError(() => new Error('Create session failed')),
    );
    component.currentSessionId = null;

    component.sendChatMessage('hello');

    expect(console.error).toHaveBeenCalled();
    expect(component.isTyping()).toBeFalse();
  });

  it('should generate a topic title and use it to create session on first message', () => {
    component.currentSessionId = null;
    agentChatService.generateTitle.and.returnValue(
      of({title: 'Generated Title', summary: 'Generated Summary'}),
    );
    agentChatService.createSession.and.returnValue(
      of({id: 'new-session', name: 'Generated Title'}),
    );

    component.sendChatMessage('hello');

    expect(agentChatService.generateTitle).toHaveBeenCalledWith('hello');
    expect(agentChatService.createSession).toHaveBeenCalledWith(
      1,
      jasmine.any(Number),
      'Generated Title',
    );
  });

  it('should fallback to default session name if generateTitle fails', () => {
    spyOn(console, 'error');
    component.currentSessionId = null;
    agentChatService.generateTitle.and.returnValue(
      throwError(() => new Error('Title generation failed')),
    );
    agentChatService.createSession.and.returnValue(
      of({id: 'new-session', name: 'New Session'}),
    );

    component.sendChatMessage('hello');

    expect(console.error).toHaveBeenCalled();
    expect(agentChatService.createSession).toHaveBeenCalledWith(
      1,
      jasmine.any(Number),
      'New Session',
    );
  });

  it('should load default session when sessionId is not provided and sessions exist', () => {
    agentChatService.getSessions.and.returnValue(
      of([{id: 'latest-session-id', lastUpdateTime: 123}]),
    );

    (
      TestBed.inject(WorkspaceStateService).getActiveWorkspaceId as jasmine.Spy
    ).and.returnValue(1);
    (
      TestBed.inject(ProjectStateService).getActiveProjectId as jasmine.Spy
    ).and.returnValue(20);
    agentChatService.selectedSessionId.set(null);
    agentChatService.currentStoryboard.set(null);

    component.loadChatSessions();
    fixture.detectChanges();

    expect(agentChatService.getSessionDetail).toHaveBeenCalledWith(
      1,
      'latest-session-id',
      undefined,
    );
  });

  it('should clear storyboard and add welcome message if loaded session storyboard is null', () => {
    agentChatService.getSessionDetail.and.returnValue(
      of({
        session: {id: 'session-no-sb', events: []},
        storyboard: null,
      }),
    );

    (
      TestBed.inject(WorkspaceStateService).getActiveWorkspaceId as jasmine.Spy
    ).and.returnValue(1);
    (
      TestBed.inject(ProjectStateService).getActiveProjectId as jasmine.Spy
    ).and.returnValue(10);
    agentChatService.selectedSessionId.set('session-no-sb');

    fixture.detectChanges();

    expect(agentChatService.currentStoryboard()).toBeNull();
    expect(component.chatMessages().length).toBe(1);
    expect(component.chatMessages()[0].sender).toBe('agent');
  });

  it('should load matching session if storyboardId is provided', () => {
    agentChatService.getSessions.and.returnValue(
      of([
        {
          id: 's1',
          lastUpdateTime: 123,
          state: {current_storyboard_id: 202},
        },
      ]),
    );
    agentChatService.getSessionDetail.and.returnValue(
      of({
        session: {id: 's1', events: []},
        storyboard: {id: 202, timeline_id: 42, workspace_id: 1},
      }),
    );

    (
      TestBed.inject(WorkspaceStateService).getActiveWorkspaceId as jasmine.Spy
    ).and.returnValue(1);
    (
      TestBed.inject(ProjectStateService).getActiveProjectId as jasmine.Spy
    ).and.returnValue(10);
    agentChatService.selectedSessionId.set(null);
    agentChatService.currentStoryboard.set({id: 202} as any);

    fixture.detectChanges();

    expect(agentChatService.getSessionDetail).toHaveBeenCalledWith(
      1,
      's1',
      202,
    );
  });

  it('should fallback to default session if selectedSessionId is not in workspace sessions', () => {
    agentChatService.getSessions.and.returnValue(
      of([{id: 's1', lastUpdateTime: 123}]),
    );

    (
      TestBed.inject(WorkspaceStateService).getActiveWorkspaceId as jasmine.Spy
    ).and.returnValue(1);
    (
      TestBed.inject(ProjectStateService).getActiveProjectId as jasmine.Spy
    ).and.returnValue(20);
    agentChatService.selectedSessionId.set('invalid-session-id');

    fixture.detectChanges();

    expect(agentChatService.getSessionDetail).toHaveBeenCalledWith(
      1,
      's1',
      undefined,
    );
  });

  it('should parse JSON block inside text chunks in SSE stream onMessage', () => {
    component.currentSessionId = 'session-123';
    component.sendChatMessage('hello');

    sseCallbacks.onMessage({
      content: {
        parts: [{text: 'Some text before {\n "asset": { "id": "a1" }\n}'}],
      },
    });

    expect(component.chatMessages().length).toBeGreaterThan(2);
  });

  it('should extract storyboard data when format has clips, assets, and scenes', () => {
    const data = {
      clips: [{id: 1, assetId: 'a1'}],
      assets: {a1: {url: 'http://img.png'}},
    };
    expect(component['extractStoryboardData'](data)).toBeNull();

    const dataWithScenes = {
      ...data,
      scenes: [{id: 1, description: 'nested scene'}],
    };
    expect(component['extractStoryboardData'](dataWithScenes)).toBeTruthy();
  });

  it('should process video asset JSON block on onClose in SSE stream', () => {
    spyOn(agentChatService.videoGenerated$, 'next');
    component.currentSessionId = 'session-123';
    component.sendChatMessage('hello');

    sseCallbacks.onMessage({
      content: {
        parts: [
          {
            text: 'Here is your video: {"asset": {"id": 999, "type": "video", "url": "http://example.com/video.mp4"}}',
          },
        ],
      },
    });

    sseCallbacks.onClose();

    expect(agentChatService.videoGenerated$.next).toHaveBeenCalledWith(
      jasmine.objectContaining({id: 999, type: 'video'}),
    );
  });

  it('should not broadcast non-video assets on onClose in SSE stream', () => {
    spyOn(agentChatService.videoGenerated$, 'next');
    component.currentSessionId = 'session-123';
    component.sendChatMessage('hello');

    sseCallbacks.onMessage({
      content: {
        parts: [
          {
            text: 'Here is your image: {"asset": {"id": 100, "type": "image", "url": "http://example.com/img.png"}}',
          },
        ],
      },
    });

    sseCallbacks.onClose();

    expect(agentChatService.videoGenerated$.next).not.toHaveBeenCalledWith(
      jasmine.objectContaining({type: 'image'}),
    );
  });

  it('should detect storyboard ID tag, fetch the storyboard, and set it on currentStoryboard', () => {
    component.currentSessionId = 'session-123';
    storyboardService.getStoryboard.and.returnValue(
      of({id: 123, timeline_id: 42, scenes: []} as any),
    );

    component['checkForStoryboardId'](
      'Here is your storyboard [ID: storyboard_123]',
    );

    expect(storyboardService.getStoryboard).toHaveBeenCalledWith(123);
    expect(agentChatService.currentStoryboard()).toEqual(
      jasmine.objectContaining({id: 123, timeline_id: 42}),
    );
  });

  describe('isToolResponse', () => {
    it('should return false if event is null or undefined', () => {
      expect(component['isToolResponse'](null)).toBeFalse();
      expect(component['isToolResponse'](undefined)).toBeFalse();
    });

    it('should return false if parts is not an array', () => {
      const event = {
        content: {
          parts: 'not-an-array',
        },
      };
      expect(component['isToolResponse'](event)).toBeFalse();
    });

    it('should return false if rawParts is not an array', () => {
      const event = {
        raw_event: {
          content: {
            parts: 'not-an-array',
          },
        },
      };
      expect(component['isToolResponse'](event)).toBeFalse();
    });

    it('should return false if parts or rawParts array contains null or undefined elements', () => {
      const event = {
        content: {
          parts: [null, undefined],
        },
      };
      expect(component['isToolResponse'](event)).toBeFalse();
    });

    it('should return true if content.parts has functionResponse', () => {
      const event = {
        content: {
          parts: [{functionResponse: {}}],
        },
      };
      expect(component['isToolResponse'](event)).toBeTrue();
    });

    it('should return true if raw_event.content.parts has tool_response', () => {
      const event = {
        raw_event: {
          content: {
            parts: [{tool_response: {}}],
          },
        },
      };
      expect(component['isToolResponse'](event)).toBeTrue();
    });
  });

  describe('Polling lifecycle', () => {
    it('should call stopPolling on destroy', () => {
      component.ngOnDestroy();
      expect(agentChatService.stopPolling).toHaveBeenCalled();
    });

    it('should call stopPolling on startNewChat', () => {
      component.startNewChat();
      expect(agentChatService.stopPolling).toHaveBeenCalled();
    });

    it('should call stopPolling on loadChatMessages', () => {
      component.loadChatMessages('session-123');
      expect(agentChatService.stopPolling).toHaveBeenCalled();
    });

    it('should call stopPolling on onAgentChange', () => {
      component.onAgentChange('script_writer');
      expect(agentChatService.stopPolling).toHaveBeenCalled();
    });
  });

  describe('Session Detail & Stream Error Paths', () => {
    it('should trigger programmatic workspace switch if storyboard workspace does not match current', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      agentChatService.selectedSessionId.set('session-123');

      const mockResponse = {
        session: {id: 'session-123', events: []},
        storyboard: {id: 202, workspace_id: 2, timeline_id: 42},
      };
      agentChatService.getSessionDetail.and.returnValue(
        of(mockResponse as any),
      );

      component['loadSessionDetail'](1, 10, 'session-123', 202);

      expect(workspaceState.setActiveWorkspaceId).toHaveBeenCalledWith(2);
      expect(component['isProgrammaticWorkspaceSwitch']).toBeTrue();
    });

    it('should handle error when preloading workspace state in loadSessionDetail', () => {
      const errorObj = {status: 500, message: 'Internal Server Error'};
      agentChatService.getSessionDetail.and.returnValue(
        throwError(() => errorObj),
      );
      agentChatService.selectedSessionId.set('session-123');
      spyOn(console, 'error');

      component['loadSessionDetail'](1, 10, 'session-123', 202);

      expect(console.error).toHaveBeenCalled();
      expect(component.isLoadingHistory()).toBeFalse();
    });

    it('should handle status 503 error when loading chat messages', () => {
      const errorObj = {status: 503, message: 'Service Unavailable'};
      agentChatService.getSessionDetail.and.returnValue(
        throwError(() => errorObj),
      );
      spyOn(console, 'error');

      component.loadChatMessages('session-123');

      expect(component.agentUnavailable()).toBeTrue();
      expect(component.isLoadingHistory()).toBeFalse();
    });

    it('should handle status 503 error in SSE stream onError', () => {
      component.currentSessionId = 'session-123';
      component.sendChatMessage('hello');

      spyOn(console, 'warn');
      sseCallbacks.onError({status: 503, message: 'Service Unavailable'});

      expect(component.agentUnavailable()).toBeTrue();
      expect(component.isTyping()).toBeFalse();
    });

    it('should handle other error in SSE stream onError', () => {
      const notificationService = TestBed.inject(NotificationService) as any;
      spyOn(notificationService, 'show');
      component.currentSessionId = 'session-123';
      component.sendChatMessage('hello');

      sseCallbacks.onError({status: 500, message: 'Internal Server Error'});

      expect(component.agentUnavailable()).toBeFalse();
      expect(component.isTyping()).toBeFalse();
      expect(notificationService.show).toHaveBeenCalled();
    });
  });

  describe('Storyboard Session Sync Effect', () => {
    it('should sync selectedSessionId if storyboard session_id changes and is different', () => {
      component.currentSessionId = 'session-123';
      agentChatService.selectedSessionId.set('session-123');

      agentChatService.currentStoryboard.set({
        id: 202,
        session_id: 'session-999',
        timeline_id: 42,
      } as any);
      fixture.detectChanges();

      expect(agentChatService.selectedSessionId()).toBe('session-999');
    });
  });

  describe('Resolve Message Images Effect', () => {
    let galleryService: any;

    beforeEach(() => {
      galleryService = TestBed.inject(GalleryService);
    });

    it('should resolve presigned urls for media items', () => {
      const mockMedia = {
        presignedUrls: ['http://media-url'],
        presignedThumbnailUrls: ['http://thumb-url'],
      };
      galleryService.getMedia.and.returnValue(of(mockMedia));

      component.chatMessages.set([
        {
          sender: 'user',
          text: 'Hello',
          images: [
            {
              mediaItem: {
                id: 456,
              },
            },
          ],
        },
      ]);
      fixture.detectChanges();

      expect(galleryService.getMedia).toHaveBeenCalledWith(456);
      const messages = component.chatMessages();
      expect(messages[0].images[0].mediaItem.presignedUrls).toEqual([
        'http://media-url',
      ]);
    });

    it('should resolve presigned urls for source assets', () => {
      const mockAsset = {
        presignedUrls: ['http://asset-url'],
        presignedThumbnailUrls: ['http://asset-thumb-url'],
      };
      galleryService.getAsset.and.returnValue(of(mockAsset));

      component.chatMessages.set([
        {
          sender: 'user',
          text: 'Hello',
          images: [
            {
              id: 789,
            },
          ],
        },
      ]);
      fixture.detectChanges();

      expect(galleryService.getAsset).toHaveBeenCalledWith(789);
      const messages = component.chatMessages();
      expect(messages[0].images[0].presignedUrl).toBe('http://asset-url');
    });

    it('should clean up resolvingAssetIds on media resolve error', () => {
      galleryService.getMedia.and.returnValue(
        throwError(() => new Error('Failed')),
      );
      spyOn(console, 'error');

      component.chatMessages.set([
        {
          sender: 'user',
          text: 'Hello',
          images: [
            {
              mediaItem: {
                id: 456,
              },
            },
          ],
        },
      ]);
      fixture.detectChanges();

      expect(console.error).toHaveBeenCalled();
      expect(component['resolvingAssetIds'].has('456')).toBeFalse();
    });

    it('should clean up resolvingAssetIds on asset resolve error', () => {
      galleryService.getAsset.and.returnValue(
        throwError(() => new Error('Failed')),
      );
      spyOn(console, 'error');

      component.chatMessages.set([
        {
          sender: 'user',
          text: 'Hello',
          images: [
            {
              id: 789,
            },
          ],
        },
      ]);
      fixture.detectChanges();

      expect(console.error).toHaveBeenCalled();
      expect(component['resolvingAssetIds'].has('789')).toBeFalse();
    });
  });

  describe('Additional Chat Interface Coverage Tests', () => {
    it('should get activeAgent via currentAgent getter', () => {
      agentChatService.activeAgent.set('director');
      expect(component.currentAgent).toBe('director');
    });

    it('should format links using markdownService.renderer.link', () => {
      const markdownService = TestBed.inject(MarkdownService);

      const result1 = (markdownService.renderer.link as any)({
        href: 'http://test',
        title: 'My Title',
        text: 'Click Here',
      });
      expect(result1).toContain('href="http://test"');
      expect(result1).toContain('title="My Title"');
      expect(result1).toContain('Click Here');

      const result2 = markdownService.renderer.link(
        'http://test2',
        'My Title 2',
        'Click Here 2',
      );
      expect(result2).toContain('href="http://test2"');
      expect(result2).toContain('title="My Title 2"');
      expect(result2).toContain('Click Here 2');
    });

    it('should reset chat and timeline when workspace or project changes non-programmatically', () => {
      const timelineState = TestBed.inject(TimelineStateService);
      timelineState.loadedTimelineId.set(123);
      component['lastWorkspaceId'] = 1;
      component['lastProjectId'] = 10;
      component['isProgrammaticWorkspaceSwitch'] = false;

      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(2);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);
      agentChatService.selectedSessionId.set('session-123');

      component.loadChatSessions();

      expect(timelineState.loadedTimelineId()).toBeUndefined();
      expect(component.currentSessionId).toBeNull();
    });

    it('should consume and reset isProgrammaticWorkspaceSwitch when workspace changes programmatically', () => {
      const timelineState = TestBed.inject(TimelineStateService);
      timelineState.loadedTimelineId.set(123);
      component['lastWorkspaceId'] = 1;
      component['lastProjectId'] = 10;
      component['isProgrammaticWorkspaceSwitch'] = true;

      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(2);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);
      agentChatService.selectedSessionId.set('session-123');

      component.loadChatSessions();

      expect(component['isProgrammaticWorkspaceSwitch']).toBeFalse();
      expect(timelineState.loadedTimelineId()).toBe(123);
    });

    it('should handle session switch to null/new chat inside loadChatSessions', () => {
      component['lastLoadedProjectId'] = 10;
      component['lastLoadedWorkspaceId'] = 1;
      component['lastLoadedSessionId'] = 'session-123';

      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      agentChatService.selectedSessionId.set(null);
      agentChatService.currentStoryboard.set(null);

      spyOn(component, 'startNewChat');

      component.loadChatSessions();

      expect(component.isLoadingHistory()).toBeFalse();
      expect(component.startNewChat).toHaveBeenCalled();
    });

    it('should handle explicit new chat when session history exists', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      agentChatService.selectedSessionId.set(null);
      agentChatService.currentStoryboard.set(null);

      component.sessions.set([
        {
          id: 'session-1',
          name: 'Session 1',
        } as any,
      ]);

      component.loadChatSessions();

      expect(component.isLoadingHistory()).toBeFalse();
    });

    it('should handle loadSessionDetail where storyboard is present but session is not', () => {
      const mockResponse = {
        session: null,
        storyboard: {id: 202, workspace_id: 1, timeline_id: 42},
      };
      agentChatService.getSessionDetail.and.returnValue(
        of(mockResponse as any),
      );
      agentChatService.selectedSessionId.set('session-123');

      component['loadSessionDetail'](1, 10, 'session-123', 202);

      expect(component.currentSessionId).toBeNull();
      expect(agentChatService.selectedSessionId()).toBeNull();
    });

    it('should call startNewChat if getSessionDetail response has neither session nor storyboard', () => {
      const mockResponse = {
        session: null,
        storyboard: null,
      };
      agentChatService.getSessionDetail.and.returnValue(
        of(mockResponse as any),
      );
      agentChatService.selectedSessionId.set('session-123');
      spyOn(component, 'startNewChat');

      component['loadSessionDetail'](1, 10, 'session-123', 202);

      expect(component.startNewChat).toHaveBeenCalled();
    });
  });

  describe('mapEventsToMessages parsing details', () => {
    it('should parse source_asset and media_item tags from System Note', () => {
      const mockEvents = [
        {
          author: 'model',
          content: {
            role: 'model',
            parts: [
              {
                text: 'Here is an asset: [System Note: <creative_studio_asset id="123" type="source_asset" />]',
              },
              {
                text: 'Here is a media item: [System Note: <creative_studio_asset id="456" type="media_item" />]',
              },
            ],
          },
        },
      ];

      const mapped = component['mapEventsToMessages'](mockEvents);

      expect(mapped[0].images).toEqual([
        {id: 123},
        {
          mediaItem: {
            id: 456,
          },
        },
      ]);
    });

    it('should handle functionResponse with clips and assets', () => {
      spyOn(agentChatService.videoGenerated$, 'next');
      const mockEvents = [
        {
          author: 'model',
          content: {
            parts: [
              {
                functionResponse: {
                  response: {
                    result: JSON.stringify({
                      clips: [{id: 1}],
                      assets: [{id: 2}],
                    }),
                  },
                },
              },
            ],
          },
        },
      ];

      const mapped = component['mapEventsToMessages'](mockEvents);

      expect(agentChatService.videoGenerated$.next).toHaveBeenCalledWith(
        jasmine.objectContaining({
          clips: [{id: 1}],
          assets: [{id: 2}],
        }),
      );
    });

    it('should parse storyboard actions and extract storyboard data', () => {
      const mockEvents = [
        {
          author: 'model',
          actions: {
            storyboard: {
              scenes: [{id: 1, description: 'Test Scene'}],
            },
          },
          content: {
            parts: [],
          },
        },
      ];

      const mapped = component['mapEventsToMessages'](mockEvents);

      expect(mapped[0].storyboard).toEqual(
        jasmine.objectContaining({
          scenes: [{id: 1, description: 'Test Scene'}],
        }),
      );
    });
  });

  describe('setupCallbacks SSE stream details', () => {
    beforeEach(() => {
      component.currentSessionId = 'session-123';
      component.sendChatMessage('hello');
    });

    it('should parse JSON block start in onMessage text parts', () => {
      sseCallbacks.onMessage({
        id: 'inv-1',
        content: {
          parts: [{text: 'Preamble text {\n "scenes": []'}],
        },
      });

      const messages = component.chatMessages();
      expect(messages.length).toBe(4);
      expect(messages[2].text).toBe('Preamble text ');
      expect(messages[3].text).toBe('{\n "scenes": []');
      expect(messages[3].isHidden).toBeTrue();
    });

    it('should append to last hidden message when in json block', () => {
      sseCallbacks.onMessage({
        id: 'inv-1',
        content: {
          parts: [{text: '{\n'}],
        },
      });

      sseCallbacks.onMessage({
        id: 'inv-1',
        content: {
          parts: [{text: '"campaign_name": "Test Campaign"'}],
        },
      });

      const messages = component.chatMessages();
      expect(messages[messages.length - 1].text).toBe(
        '{\n"campaign_name": "Test Campaign"',
      );
    });

    it('should handle functionResponse for video asset and trigger workbench broadcast', () => {
      spyOn(agentChatService.videoGenerated$, 'next');

      sseCallbacks.onMessage({
        id: 'inv-1',
        content: {
          parts: [
            {
              functionResponse: {
                response: {
                  result: JSON.stringify({
                    asset: {
                      id: 'vid-123',
                      type: 'video',
                    },
                  }),
                },
              },
            },
          ],
        },
      });

      const messages = component.chatMessages();
      expect(messages[messages.length - 1].asset).toEqual({
        id: 'vid-123',
        type: 'video',
      });
      expect(agentChatService.videoGenerated$.next).toHaveBeenCalledWith(
        jasmine.objectContaining({id: 'vid-123', type: 'video'}),
      );
    });

    it('should handle functionResponse for storyboard_id, fetch storyboard and reset timeline', () => {
      (storyboardService.getStoryboard as jasmine.Spy).and.returnValue(
        of({
          id: 202,
          timeline_id: 42,
        }),
      );
      const timelineState = TestBed.inject(TimelineStateService);
      timelineState.loadedTimelineId.set(123);

      sseCallbacks.onMessage({
        id: 'inv-1',
        content: {
          parts: [
            {
              functionResponse: {
                response: {
                  result: JSON.stringify({
                    storyboard_id: 202,
                  }),
                },
              },
            },
          ],
        },
      });

      expect(storyboardService.getStoryboard).toHaveBeenCalledWith(202);
      expect(timelineState.loadedTimelineId()).toBeUndefined();
      expect(agentChatService.currentStoryboard()).toEqual(
        jasmine.objectContaining({id: 202, timeline_id: 42}),
      );
    });

    it('should handle onClose, parsing assets and fetching storyboard for session', () => {
      (
        storyboardService.getStoryboardForSession as jasmine.Spy
      ).and.returnValue(
        of([
          {
            id: 303,
            timeline_id: 12,
          },
        ]),
      );

      const timelineState = TestBed.inject(TimelineStateService);
      timelineState.loadedTimelineId.set(123);

      sseCallbacks.onMessage({
        id: 'inv-1',
        content: {
          parts: [
            {
              text: 'Generation complete: ```json\n{"asset": {"id": "v-123", "type": "video"}}\n```',
            },
          ],
        },
      });

      sseCallbacks.onClose();

      expect(timelineState.loadedTimelineId()).toBeUndefined();
      expect(agentChatService.currentStoryboard()).toEqual(
        jasmine.objectContaining({id: 303, timeline_id: 12}),
      );
      expect(storyboardService.getStoryboardForSession).toHaveBeenCalledWith(
        1,
        'session-123',
      );
    });
    it('should handle onClose when storyboard fetch returns error', () => {
      (
        storyboardService.getStoryboardForSession as jasmine.Spy
      ).and.returnValue(throwError(() => new Error('Storyboard error')));
      spyOn(console, 'error');

      sseCallbacks.onClose();

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle onClose when storyboard has no timeline_id', () => {
      spyOn(agentChatService.videoGenerated$, 'next');
      (
        storyboardService.getStoryboardForSession as jasmine.Spy
      ).and.returnValue(
        of([
          {
            id: 303,
            timeline_id: null,
          },
        ]),
      );

      const timelineState = TestBed.inject(TimelineStateService);
      timelineState.loadedTimelineId.set(123);

      sseCallbacks.onClose();

      expect(timelineState.loadedTimelineId()).toBe(123);
      expect(agentChatService.videoGenerated$.next).not.toHaveBeenCalledWith(
        true,
      );
    });

    it('should handle onClose when storyboard list is empty', () => {
      spyOn(agentChatService.videoGenerated$, 'next');
      (
        storyboardService.getStoryboardForSession as jasmine.Spy
      ).and.returnValue(of([]));

      sseCallbacks.onClose();

      expect(agentChatService.videoGenerated$.next).toHaveBeenCalledWith(true);
    });

    it('should handle functionResponse for storyboard_id error when fetching storyboard', () => {
      (storyboardService.getStoryboard as jasmine.Spy).and.returnValue(
        throwError(() => new Error('Storyboard load failed')),
      );
      spyOn(console, 'error');

      sseCallbacks.onMessage({
        id: 'inv-1',
        content: {
          parts: [
            {
              functionResponse: {
                response: {
                  result: JSON.stringify({
                    storyboard_id: 202,
                  }),
                },
              },
            },
          ],
        },
      });

      expect(console.error).toHaveBeenCalled();
    });

    it('should call videoGenerated.next(true) in onClose if currentSessionId is missing', () => {
      spyOn(agentChatService.videoGenerated$, 'next');
      component.currentSessionId = null;

      sseCallbacks.onClose();

      expect(agentChatService.videoGenerated$.next).toHaveBeenCalledWith(true);
    });

    it('should handle functionResponse with clips and assets in setupCallbacks', () => {
      spyOn(agentChatService.videoGenerated$, 'next');

      sseCallbacks.onMessage({
        id: 'inv-1',
        content: {
          parts: [
            {
              functionResponse: {
                response: {
                  result: JSON.stringify({
                    clips: [{id: 1}],
                    assets: [{id: 2}],
                  }),
                },
              },
            },
          ],
        },
      });

      expect(component.isTyping()).toBeFalse();
      expect(agentChatService.videoGenerated$.next).toHaveBeenCalledWith(
        jasmine.objectContaining({
          clips: [{id: 1}],
          assets: [{id: 2}],
        }),
      );
    });

    it('should set isGeneratingStoryboard and isTyping to false onMessage with actions.storyboard', () => {
      component.isTyping.set(true);
      agentChatService.isGeneratingStoryboard.set(true);

      sseCallbacks.onMessage({
        actions: {
          storyboard: {scenes: []},
        },
      });

      expect(component.isTyping()).toBeFalse();
      expect(agentChatService.isGeneratingStoryboard()).toBeFalse();
    });
  });

  describe('loadChatSessions error and parameter checks', () => {
    it('should return early in loadChatSessions if active workspace ID is not set', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(
        null,
      );
      (agentChatService.getSessions as jasmine.Spy).calls.reset();

      component.loadChatSessions();

      expect(agentChatService.getSessions).not.toHaveBeenCalled();
    });

    it('should handle preload state failure with non-503 status', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      agentChatService.getSessions.and.returnValue(
        throwError(() => ({status: 500, message: 'Internal Server Error'})),
      );
      component.loadChatSessions();

      expect(component.agentUnavailable()).toBeFalse();
    });

    it('should call resumePolling and startPolling if session state is RUNNING', () => {
      const mockResponse = {
        session: {
          id: 'session-123',
          state: {
            status: 'RUNNING',
          },
          events: [
            {
              author: 'user',
              content: {
                parts: [{text: 'Hello'}],
              },
            },
          ],
        },
        storyboard: null,
      };
      agentChatService.getSessionDetail.and.returnValue(
        of(mockResponse as any),
      );
      agentChatService.selectedSessionId.set('session-123');

      component['loadSessionDetail'](1, 10, 'session-123', null);

      expect(component.isTyping()).toBeTrue();
      expect(agentChatService.startPolling).toHaveBeenCalledWith(
        'session-123',
        jasmine.any(Object),
      );
    });

    it('should return early in loadChatSessions if explicit new chat', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      component.sessions.set([{id: 'session-1', name: 'Session 1'}]);
      component.currentSessionId = null;

      (agentChatService.getSessions as jasmine.Spy).calls.reset();

      component['lastLoadedProjectId'] = null;
      component['lastLoadedWorkspaceId'] = null;
      component.loadChatSessions();

      expect(agentChatService.getSessions).not.toHaveBeenCalled();
      expect(component.isLoadingHistory()).toBeFalse();
    });

    it('should handle preload state failure with 503 status in getSessions', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      agentChatService.getSessions.and.returnValue(
        throwError(() => ({status: 503, message: 'Service Unavailable'})),
      );
      component['lastLoadedProjectId'] = null;
      component['lastLoadedWorkspaceId'] = null;
      component.loadChatSessions();

      expect(component.agentUnavailable()).toBeTrue();
    });

    it('should return early in getSessions subscribe if active workspace changes during fetch', fakeAsync(() => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      agentChatService.getSessions.and.returnValue(
        of([
          {
            id: 'session-1',
            title: 'Session 1',
            workspace_id: 1,
            project_id: 10,
          },
        ]).pipe(delay(100)),
      );

      component['lastLoadedProjectId'] = null;
      component['lastLoadedWorkspaceId'] = null;
      component.loadChatSessions();

      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(2);

      tick(100);

      expect(component.sessions()).toEqual([]);
    }));

    it('should load default session if requested session does not exist in workspace, but workspace has other sessions', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      agentChatService.selectedSessionId.set('session-requested');

      const mockSessions = [{id: 'session-default', name: 'Newest Session'}];
      agentChatService.getSessions.and.returnValue(of(mockSessions));
      spyOn(component as any, 'loadSessionDetail');

      component['lastLoadedProjectId'] = null;
      component['lastLoadedWorkspaceId'] = null;
      component.loadChatSessions();

      expect(component['loadSessionDetail']).toHaveBeenCalledWith(
        1,
        10,
        'session-default',
        null,
      );
    });

    it('should start new chat if requested session does not exist in workspace, and workspace has no other sessions', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      agentChatService.selectedSessionId.set('session-requested');

      agentChatService.getSessions.and.returnValue(of([]));
      spyOn(component, 'startNewChat');

      component['lastLoadedProjectId'] = null;
      component['lastLoadedWorkspaceId'] = null;
      component.loadChatSessions();

      expect(component.isLoadingHistory()).toBeFalse();
      expect(component.startNewChat).toHaveBeenCalled();
    });
  });

  describe('loadSessionDetail error handling', () => {
    it('should handle getSessionDetail error and reset state', () => {
      agentChatService.getSessionDetail.and.returnValue(
        throwError(() => new Error('Failed to load session details')),
      );
      spyOn(component as any, 'resetLastLoaded').and.callThrough();

      component['loadSessionDetail'](1, 10, 'session-123', null);

      expect(component.isLoadingHistory()).toBeFalse();
      expect(component['resetLastLoaded']).toHaveBeenCalled();
    });

    it('should add welcome message if loaded session detail has no messages', () => {
      const mockResponse = {
        session: {
          id: 'session-123',
          events: [],
        },
        storyboard: null,
      };
      agentChatService.getSessionDetail.and.returnValue(
        of(mockResponse as any),
      );
      agentChatService.selectedSessionId.set('session-123');

      spyOn(component, 'addWelcomeMessage').and.callThrough();

      component['loadSessionDetail'](1, 10, 'session-123', null);

      expect(component.addWelcomeMessage).toHaveBeenCalled();
      expect(component.chatMessages().length).toBeGreaterThan(0);
    });

    it('should reset session and add welcome message if response only contains storyboard', () => {
      const mockResponse = {
        session: null,
        storyboard: {id: 'storyboard-123', workspace_id: 1, scenes: []},
      };
      agentChatService.getSessionDetail.and.returnValue(
        of(mockResponse as any),
      );
      agentChatService.selectedSessionId.set('session-123');

      spyOn(component, 'addWelcomeMessage').and.callThrough();

      component['loadSessionDetail'](1, 10, 'session-123', null);

      expect(component.currentSessionId).toBeNull();
      expect(component.addWelcomeMessage).toHaveBeenCalled();
    });
  });

  describe('viewAsset', () => {
    beforeEach(() => {
      spyOn(window, 'open');
    });

    it('should open gallery route by default', () => {
      component.viewAsset('asset-123');
      expect(window.open).toHaveBeenCalledWith('/gallery/asset-123', '_blank');
    });

    it('should open asset-detail route for source_asset type', () => {
      component.viewAsset('source_asset:123');
      expect(window.open).toHaveBeenCalledWith('/asset-detail/123', '_blank');
    });

    it('should open gallery route for media_item type', () => {
      component.viewAsset('media_item:456');
      expect(window.open).toHaveBeenCalledWith('/gallery/456', '_blank');
    });
  });

  describe('deleteChat', () => {
    let mockDialog: any;
    let mockDialogRef: any;

    beforeEach(() => {
      mockDialogRef = {
        afterClosed: jasmine.createSpy('afterClosed').and.returnValue(of(true)),
      };
      mockDialog = TestBed.inject(MatDialog);
      spyOn(mockDialog, 'open').and.returnValue(mockDialogRef);
    });

    it('should open dialog and delete session if confirmed', () => {
      component.currentSessionId = 'session-123';
      agentChatService.deleteSession.and.returnValue(of(null));
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);

      spyOn(component, 'startNewChat');

      component.deleteChat();

      expect(mockDialog.open).toHaveBeenCalled();
      expect(agentChatService.deleteSession).toHaveBeenCalledWith(
        'session-123',
        1,
      );
      expect(component.startNewChat).toHaveBeenCalled();
    });

    it('should do nothing if dialog is cancelled', () => {
      component.currentSessionId = 'session-123';
      mockDialogRef.afterClosed.and.returnValue(of(false));

      component.deleteChat();

      expect(mockDialog.open).toHaveBeenCalled();
      expect(agentChatService.deleteSession).not.toHaveBeenCalled();
    });

    it('should return early if currentSessionId is not set', () => {
      component.currentSessionId = null;

      component.deleteChat();

      expect(mockDialog.open).not.toHaveBeenCalled();
    });
  });

  describe('onAgentChange & onSessionChange', () => {
    it('should update activeAgent and reload sessions onAgentChange', () => {
      spyOn(component, 'loadChatSessions');
      component.onAgentChange('agent-456');

      expect(agentChatService.activeAgent()).toBe('agent-456');
      expect(component.currentSessionId).toBeNull();
      expect(component.loadChatSessions).toHaveBeenCalled();
    });

    it('should load messages if session changes', () => {
      spyOn(component, 'loadChatMessages');
      component.currentSessionId = 'session-1';
      component.onSessionChange('session-2');

      expect(component.currentSessionId).toBe('session-2');
      expect(component.loadChatMessages).toHaveBeenCalledWith('session-2');
    });
  });

  describe('sendChatMessage title generation and session creation errors', () => {
    beforeEach(() => {
      component.currentSessionId = null;
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);
    });

    it('should fall back to default session name if generateTitle fails and createSession succeeds', () => {
      agentChatService.generateTitle.and.returnValue(
        throwError(() => new Error('Title error')),
      );
      agentChatService.createSession.and.returnValue(
        of({
          id: 'session-default',
          title: 'New Session',
          workspace_id: 1,
          project_id: 10,
        }),
      );
      spyOn(component as any, 'executeSendMessage');

      component.sendChatMessage('test message');

      expect(agentChatService.createSession).toHaveBeenCalledWith(
        1,
        10,
        'New Session',
      );
      expect((component as any).executeSendMessage).toHaveBeenCalledWith(
        'test message',
      );
    });

    it('should handle error when createSession fails after generateTitle succeeds', () => {
      agentChatService.generateTitle.and.returnValue(
        of({title: 'Generated Title'}),
      );
      agentChatService.createSession.and.returnValue(
        throwError(() => new Error('Session creation error')),
      );
      spyOn(console, 'error');

      component.sendChatMessage('test message');

      expect(component.isTyping()).toBeFalse();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle error when createSession fails after generateTitle fails', () => {
      agentChatService.generateTitle.and.returnValue(
        throwError(() => new Error('Title error')),
      );
      agentChatService.createSession.and.returnValue(
        throwError(() => new Error('Session creation error')),
      );

      component.sendChatMessage('test message');

      expect(component.isTyping()).toBeFalse();
    });
  });

  describe('hasPendingToolCall, isToolResponse, and detectActiveToolCall branches', () => {
    it('should return false for hasPendingToolCall and isToolResponse if event is null', () => {
      expect(component['hasPendingToolCall'](null)).toBeFalse();
      expect(component['isToolResponse'](null)).toBeFalse();
    });

    it('should detect functionCall variants in hasPendingToolCall', () => {
      expect(
        component['hasPendingToolCall']({
          content: {parts: [{functionCall: {}}]},
        }),
      ).toBeTrue();
      expect(
        component['hasPendingToolCall']({
          content: {parts: [{function_call: {}}]},
        }),
      ).toBeTrue();
      expect(
        component['hasPendingToolCall']({content: {parts: [{toolCall: {}}]}}),
      ).toBeTrue();
      expect(
        component['hasPendingToolCall']({content: {parts: [{tool_call: {}}]}}),
      ).toBeTrue();
    });

    it('should detect functionCall variants in raw_event hasPendingToolCall', () => {
      expect(
        component['hasPendingToolCall']({
          raw_event: {content: {parts: [{functionCall: {}}]}},
        }),
      ).toBeTrue();
      expect(
        component['hasPendingToolCall']({
          raw_event: {content: {parts: [{function_call: {}}]}},
        }),
      ).toBeTrue();
      expect(
        component['hasPendingToolCall']({
          raw_event: {content: {parts: [{toolCall: {}}]}},
        }),
      ).toBeTrue();
      expect(
        component['hasPendingToolCall']({
          raw_event: {content: {parts: [{tool_call: {}}]}},
        }),
      ).toBeTrue();
    });

    it('should return false if no functionCall variants in hasPendingToolCall', () => {
      expect(
        component['hasPendingToolCall']({content: {parts: [{text: 'hello'}]}}),
      ).toBeFalse();
    });

    it('should detect functionResponse variants in isToolResponse', () => {
      expect(
        component['isToolResponse']({
          content: {parts: [{functionResponse: {}}]},
        }),
      ).toBeTrue();
      expect(
        component['isToolResponse']({
          content: {parts: [{function_response: {}}]},
        }),
      ).toBeTrue();
      expect(
        component['isToolResponse']({content: {parts: [{toolResponse: {}}]}}),
      ).toBeTrue();
      expect(
        component['isToolResponse']({content: {parts: [{tool_response: {}}]}}),
      ).toBeTrue();
    });

    it('should detect functionResponse variants in raw_event isToolResponse', () => {
      expect(
        component['isToolResponse']({
          raw_event: {content: {parts: [{functionResponse: {}}]}},
        }),
      ).toBeTrue();
      expect(
        component['isToolResponse']({
          raw_event: {content: {parts: [{function_response: {}}]}},
        }),
      ).toBeTrue();
      expect(
        component['isToolResponse']({
          raw_event: {content: {parts: [{toolResponse: {}}]}},
        }),
      ).toBeTrue();
      expect(
        component['isToolResponse']({
          raw_event: {content: {parts: [{tool_response: {}}]}},
        }),
      ).toBeTrue();
    });

    it('should return early in detectActiveToolCall if data is null', () => {
      expect(() => component['detectActiveToolCall'](null)).not.toThrow();
    });

    it('should set isGeneratingStoryboard if functionCall contains storyboard or timeline name', () => {
      component['detectActiveToolCall']({
        content: {parts: [{functionCall: {name: 'generate_storyboard'}}]},
      });
      expect(agentChatService.isGeneratingStoryboard()).toBeTrue();

      agentChatService.isGeneratingStoryboard.set(false);
      component['detectActiveToolCall']({
        content: {parts: [{functionCall: {name: 'render_timeline'}}]},
      });
      expect(agentChatService.isGeneratingStoryboard()).toBeTrue();
    });

    it('should set isGeneratingVideo if functionCall contains video, render or stitch name', () => {
      component['detectActiveToolCall']({
        content: {parts: [{functionCall: {name: 'generate_video'}}]},
      });
      expect(agentChatService.isGeneratingVideo()).toBeTrue();

      agentChatService.isGeneratingVideo.set(false);
      component['detectActiveToolCall']({
        content: {parts: [{functionCall: {name: 'render_scene'}}]},
      });
      expect(agentChatService.isGeneratingVideo()).toBeTrue();

      agentChatService.isGeneratingVideo.set(false);
      component['detectActiveToolCall']({
        content: {parts: [{functionCall: {name: 'stitch_clips'}}]},
      });
      expect(agentChatService.isGeneratingVideo()).toBeTrue();
    });

    it('should return early in checkAndResumePolling if lastUpdateTime is older than 20 minutes', () => {
      spyOn(component as any, 'resumePolling');
      const oldTime = Date.now() / 1000 - 1500;
      const mockRes = {
        session: {
          id: 'session-old',
          lastUpdateTime: oldTime,
          events: [
            {
              author: 'user',
              content: {
                parts: [{text: 'hello'}],
              },
            },
          ],
        },
      };

      component.checkAndResumePolling(mockRes as any);

      expect(component['resumePolling']).not.toHaveBeenCalled();
    });

    it('should call detectActiveToolCall in checkAndResumePolling if last event has pending tool call', () => {
      spyOn(component as any, 'detectActiveToolCall');
      spyOn(component as any, 'resumePolling');
      const mockRes = {
        session: {
          id: 'session-tool',
          events: [
            {
              author: 'model',
              content: {
                parts: [{functionCall: {name: 'generate_storyboard'}}],
              },
            },
          ],
        },
      };

      component.checkAndResumePolling(mockRes as any);

      expect(component['detectActiveToolCall']).toHaveBeenCalled();
      expect(component['resumePolling']).toHaveBeenCalledWith('session-tool');
    });
  });

  describe('mapEventsToMessages additional branches', () => {
    it('should map event actions.storyboard to storyboard metadata', () => {
      const mockStoryboard = {
        id: 123,
        scenes: [{id: 1, description: 'Test Scene'}],
      };
      spyOn(component as any, 'extractStoryboardData').and.returnValue(
        mockStoryboard,
      );

      const events = [
        {
          author: 'model',
          actions: {
            storyboard: {scenes: [{id: 1, description: 'Test Scene'}]},
          },
          content: {parts: []},
        },
      ];

      const mapped = component['mapEventsToMessages'](events);

      expect(mapped[0].storyboard).toEqual(mockStoryboard);
    });
  });

  describe('executeSendMessage additional callbacks coverage', () => {
    it('should handle actions.storyboard inside executeSendMessage onMessage callback', () => {
      component.currentSessionId = 'session-123';
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      component.sendChatMessage('hello test message');

      expect(agentChatService.sendMessage).toHaveBeenCalled();

      component.isTyping.set(true);
      agentChatService.isGeneratingStoryboard.set(true);
      agentChatService.isGeneratingVideo.set(true);

      sseCallbacks.onMessage({
        actions: {
          storyboard: {scenes: []},
        },
      });

      expect(component.isTyping()).toBeFalse();
      expect(agentChatService.isGeneratingStoryboard()).toBeFalse();
      expect(agentChatService.isGeneratingVideo()).toBeFalse();
    });

    it('should return early in sendChatMessage if text is empty and no images are selected', () => {
      (agentChatService.sendMessage as jasmine.Spy).calls.reset();
      component.sendChatMessage('');
      expect(agentChatService.sendMessage).not.toHaveBeenCalled();

      component.sendChatMessage('   ');
      expect(agentChatService.sendMessage).not.toHaveBeenCalled();
    });

    it('should handle json blocks in streamed messages', () => {
      component.currentSessionId = 'session-123';
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      component.sendChatMessage('hello');

      sseCallbacks.onMessage({
        content: {
          parts: [{text: 'Here is some text {\n"key": "value"}'}],
        },
      });

      sseCallbacks.onMessage({
        content: {
          parts: [{text: '}'}],
        },
      });

      expect(component.chatMessages().length).toBeGreaterThan(0);
    });
  });

  describe('loadChatMessages error handling', () => {
    it('should handle getSessionDetail 503 error in loadChatMessages', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      agentChatService.getSessionDetail.and.returnValue(
        throwError(() => ({status: 503, message: 'Service Unavailable'})),
      );

      component.loadChatMessages('session-123');

      expect(component.agentUnavailable()).toBeTrue();
      expect(component.isLoadingHistory()).toBeFalse();
    });

    it('should handle getSessionDetail non-503 error in loadChatMessages', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      agentChatService.getSessionDetail.and.returnValue(
        throwError(() => ({status: 500, message: 'Internal Server Error'})),
      );

      component.loadChatMessages('session-123');

      expect(component.agentUnavailable()).toBeFalse();
      expect(component.isLoadingHistory()).toBeFalse();
    });
  });

  describe('setupCallbacks coverage', () => {
    it('should invoke onError with 503 status and set agentUnavailable', () => {
      const callbacks = component['setupCallbacks']();
      component.isTyping.set(true);

      callbacks.onError!({status: 503, message: 'Service Unavailable'});

      expect(component.agentUnavailable()).toBeTrue();
      expect(component.isTyping()).toBeFalse();
    });

    it('should invoke onError with non-503 status', () => {
      const callbacks = component['setupCallbacks']();
      component.isTyping.set(true);

      callbacks.onError!({status: 500, message: 'Internal error'});

      expect(component.agentUnavailable()).toBeFalse();
      expect(component.isTyping()).toBeFalse();
    });

    it('should invoke onClose callback and reset generating states', () => {
      const callbacks = component['setupCallbacks']();
      component.isTyping.set(true);
      agentChatService.isGeneratingStoryboard.set(true);
      agentChatService.isGeneratingVideo.set(true);

      callbacks.onClose!();

      expect(component.isTyping()).toBeFalse();
      expect(agentChatService.isGeneratingStoryboard()).toBeFalse();
      expect(agentChatService.isGeneratingVideo()).toBeFalse();
    });

    describe('onMessage callback', () => {
      let callbacks: SSECallbacks<any>;

      beforeEach(() => {
        callbacks = component['setupCallbacks']();
        component.chatMessages.set([]);
        component.isTyping.set(true);
      });

      it('should detect active tool call and handle actions.storyboard', () => {
        spyOn(component as any, 'detectActiveToolCall');
        callbacks.onMessage!({
          actions: {storyboard: true},
        });
        expect(component['detectActiveToolCall']).toHaveBeenCalled();
        expect(component.isTyping()).toBeFalse();
        expect(agentChatService.isGeneratingStoryboard()).toBeFalse();
        expect(agentChatService.isGeneratingVideo()).toBeFalse();
      });

      it('should handle new regular text chunk and update messages', () => {
        callbacks.onMessage!({
          id: 'inv-1',
          content: {
            parts: [{text: 'Hello part 1'}],
          },
        });
        let messages = component.chatMessages();
        expect(messages.length).toBe(1);
        expect(messages[0].sender).toBe('agent');
        expect(messages[0].text).toBe('Hello part 1');

        // Second chunk from same invocation should append
        callbacks.onMessage!({
          id: 'inv-1',
          content: {
            parts: [{text: ' part 2'}],
          },
        });
        messages = component.chatMessages();
        expect(messages.length).toBe(1);
        expect(messages[0].text).toBe('Hello part 1 part 2');

        // New invocation ID should create a new message
        callbacks.onMessage!({
          id: 'inv-2',
          content: {
            parts: [{text: 'New message'}],
          },
        });
        messages = component.chatMessages();
        expect(messages.length).toBe(2);
        expect(messages[1].text).toBe('New message');
      });

      it('should handle JSON chunks and mark them as hidden', () => {
        callbacks.onMessage!({
          id: 'inv-1',
          content: {
            parts: [{text: '{\n"scenes": []}'}],
          },
        });
        const messages = component.chatMessages();
        expect(messages.length).toBe(1);
        expect(messages[0].isHidden).toBeTrue();
        expect(messages[0].text).toBe('{\n"scenes": []}');
      });

      it('should process functionResponse containing asset and call videoGenerated next if it is a video', () => {
        spyOn(agentChatService.videoGenerated$, 'next');
        callbacks.onMessage!({
          content: {
            parts: [
              {
                functionResponse: {
                  response: {
                    result: JSON.stringify({
                      asset: {id: 456, type: 'video'},
                    }),
                  },
                },
              },
            ],
          },
        });
        const messages = component.chatMessages();
        expect(messages.length).toBe(1);
        expect(messages[0].asset).toEqual({id: 456, type: 'video'});
        expect(agentChatService.videoGenerated$.next).toHaveBeenCalledWith({
          id: 456,
          type: 'video',
        });
      });

      it('should process functionResponse containing storyboard_id and fetch it', () => {
        (storyboardService.getStoryboard as jasmine.Spy).and.returnValue(
          of({id: 789, title: 'Fetched SB'}),
        );
        callbacks.onMessage!({
          content: {
            parts: [
              {
                functionResponse: {
                  response: {
                    result: JSON.stringify({
                      storyboard_id: 789,
                    }),
                  },
                },
              },
            ],
          },
        });
        expect(storyboardService.getStoryboard).toHaveBeenCalledWith(789);
        expect(agentChatService.currentStoryboard()).toEqual(
          jasmine.objectContaining({id: 789}),
        );
      });
    });
  });

  describe('loadChatMessages success paths', () => {
    it('should set currentStoryboard if present in loadChatMessages success response', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      const mockResponse = {
        session: {
          id: 'session-123',
          events: [],
        },
        storyboard: {id: 'storyboard-123', workspace_id: 1, scenes: []},
      };
      agentChatService.getSessionDetail.and.returnValue(
        of(mockResponse as any),
      );

      component.loadChatMessages('session-123');

      expect(agentChatService.currentStoryboard()).toEqual(
        mockResponse.storyboard as any,
      );
      expect(component.isLoadingHistory()).toBeFalse();
    });

    it('should clear storyboard if not present in loadChatMessages success response', () => {
      const workspaceState = TestBed.inject(WorkspaceStateService);
      (workspaceState.getActiveWorkspaceId as jasmine.Spy).and.returnValue(1);
      const projectState = TestBed.inject(ProjectStateService);
      (projectState.getActiveProjectId as jasmine.Spy).and.returnValue(10);

      const mockResponse = {
        session: {
          id: 'session-123',
          events: [],
        },
        storyboard: null,
      };
      agentChatService.getSessionDetail.and.returnValue(
        of(mockResponse as any),
      );
      agentChatService.currentStoryboard.set({
        id: 'existing-storyboard',
      } as any);

      component.loadChatMessages('session-123');

      expect(agentChatService.currentStoryboard()).toBeNull();
      expect(component.isLoadingHistory()).toBeFalse();
    });
  });
});

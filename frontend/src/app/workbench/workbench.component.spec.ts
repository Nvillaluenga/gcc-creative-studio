/**
 * Copyright 2025 Google LLC
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
import {WorkbenchComponent} from './workbench.component';
import {HttpClient} from '@angular/common/http';
import {HttpClientTestingModule} from '@angular/common/http/testing';
import {RouterTestingModule} from '@angular/router/testing';
import {MatDialogModule} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {signal, CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {Subject, of} from 'rxjs';
import {AgentChatService} from './services/agent-chat.service';
import {TimelineStateService} from './services/timeline-state.service';
import {PlayheadSyncService} from './services/playhead-sync.service';

import {
  TimelineDTO,
  MediaAsset,
  TransitionType,
} from '../common/models/workbench.model';
import {MediaItemSelection} from '../common/components/image-selector/image-selector.component';
import {StoryboardService} from '../services/storyboard/storyboard.service';
import {WorkbenchService} from './workbench.service';
import {SourceAssetService} from '../common/services/source-asset.service';
import {GalleryService} from '../gallery/gallery.service';
import {ProjectStateService} from '../services/project/project-state.service';
import {ProjectService} from '../services/project/project.service';
import {WorkspaceStateService} from '../services/workspace/workspace-state.service';

describe('WorkbenchComponent', () => {
  let component: WorkbenchComponent;
  let fixture: ComponentFixture<WorkbenchComponent>;
  let mockQueryParams: Subject<any>;
  let mockActivatedRoute: any;

  beforeEach(async () => {
    const mockAgentChatService = {
      currentStoryboard: signal<any>(null),
      selectedSessionId: signal<any>(null),
      chatMessages: signal<any[]>([]),
    };

    const mockMatSnackBar = {
      open: jasmine.createSpy('open').and.returnValue({
        onAction: () => of(),
      }),
    };

    mockQueryParams = new Subject<any>();
    mockActivatedRoute = {
      queryParams: mockQueryParams.asObservable(),
      snapshot: {
        queryParams: {},
      },
    };

    await TestBed.configureTestingModule({
      declarations: [WorkbenchComponent],
      imports: [HttpClientTestingModule, RouterTestingModule, MatDialogModule],
      providers: [
        {provide: AgentChatService, useValue: mockAgentChatService},
        {provide: MatSnackBar, useValue: mockMatSnackBar},
        {provide: ActivatedRoute, useValue: mockActivatedRoute},
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkbenchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should select a clip', () => {
    const stateService = TestBed.inject(TimelineStateService);
    component.selectClip('clip1', new MouseEvent('click'));
    expect(stateService.selectedClipId()).toBe('clip1');
  });

  it('should add asset to timeline', () => {
    const stateService = TestBed.inject(TimelineStateService);
    const asset: MediaAsset = {
      id: 'a1',
      name: 'Test',
      type: 'video',
      url: 'test.mp4',
      safeUrl: '',
      duration: 10,
    };

    component.addToTimeline(asset);

    const clips = stateService.timelineClips();
    expect(clips.length).toBeGreaterThan(0);
    expect(clips[0].assetId).toBe('a1');
  });

  it('should delete selected clip', () => {
    const stateService = TestBed.inject(TimelineStateService);
    const clip = {
      id: 'clip1',
      assetId: 'a1',
      startTime: 0,
      duration: 10,
      offset: 0,
      trackIndex: 0,
      color: 'red',
    };
    stateService.timelineClips.set([clip]);
    stateService.selectedClipId.set('clip1');

    component.deleteSelectedClip();

    expect(stateService.timelineClips()).toEqual([]);
    expect(stateService.selectedClipId()).toBeNull();
  });

  it('should split selected clip', () => {
    const stateService = TestBed.inject(TimelineStateService);
    const clip = {
      id: 'clip1',
      assetId: 'a1',
      startTime: 0,
      duration: 10,
      offset: 0,
      trackIndex: 0,
      color: 'red',
    };
    stateService.timelineClips.set([clip]);
    stateService.selectedClipId.set('clip1');
    stateService.currentTime.set(5);

    component.splitSelectedClip();

    const clips = stateService.timelineClips();
    expect(clips.length).toBe(2);

    const c1 = clips.find(c => c.id === 'clip1');
    expect(c1?.duration).toBe(5);

    const c2 = clips.find(c => c.id !== 'clip1');
    expect(c2?.duration).toBe(5);
    expect(c2?.startTime).toBe(5);
  });

  it('should handle file selection', () => {
    const stateService = TestBed.inject(TimelineStateService);
    spyOn(window.URL, 'createObjectURL').and.returnValue('blob:test');

    const file = new File([''], 'test.mp4', {type: 'video/mp4'});
    const event = {target: {files: [file]}} as unknown as Event;

    component.onFileSelected(event);

    const assets = stateService.assets();
    expect(assets.length).toBe(1);
    expect(assets[0].name).toBe('test.mp4');
  });

  it('should open media selector dialog', () => {
    const mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    mockDialogRef.afterClosed.and.returnValue(of(null));
    spyOn(component['dialog'], 'open').and.returnValue(mockDialogRef);

    component.openMediaSelector();

    expect(component['dialog'].open).toHaveBeenCalled();
  });

  it('should process cloud media result', () => {
    const stateService = TestBed.inject(TimelineStateService);
    const mockResult: MediaItemSelection = {
      mediaItem: {
        id: 1,
        prompt: 'Cloud Media',
        mimeType: 'video/mp4',
        presignedUrls: ['test.mp4'],
        presignedThumbnailUrls: ['thumb.jpg'],
        gcsUris: [],
      },
      selectedIndex: 0,
    };

    component['processCloudMediaResult'](mockResult as MediaItemSelection);

    const assets = stateService.assets();
    expect(assets.length).toBe(1);
    expect(assets[0].name).toBe('Cloud Media');
  });

  it('should process generated data and position audio using video_clip_index', () => {
    const stateService = TestBed.inject(TimelineStateService);
    const mockData: TimelineDTO = {
      timeline_id: 2,
      workspace_id: 1,
      title: 'Timeline',
      video_clips: [
        {
          asset_ref: {id: 1, type: 'media_item'},
          trim: {offset_seconds: 0, duration_seconds: 5},
          presigned_url: 'video1.mp4',
          volume: 1.0,
          speed: 1.0,
        },
        {
          asset_ref: {id: 3, type: 'media_item'},
          trim: {offset_seconds: 0, duration_seconds: 10},
          presigned_url: 'video2.mp4',
          volume: 1.0,
          speed: 1.0,
        },
      ],
      audio_clips: [
        {
          asset_ref: {id: 2, type: 'media_item'},
          start_at: {video_clip_index: 1, offset_seconds: 2},
          trim: {offset_seconds: 0, duration_seconds: 10},
          presigned_url: 'audio1.mp3',
          volume: 1.0,
        },
      ],
    };

    component.processGeneratedData(mockData);

    const assets = stateService.assets();
    expect(assets.length).toBe(3);

    const clips = stateService.timelineClips();
    expect(clips.length).toBe(3);
    // Since refreshTimelineLayout is called at the end of processGeneratedData,
    // it will re-order/layout video clips sequentially.
    // video clip 0 starts at 0.
    // video clip 1 starts at 5.
    const vClips = clips.filter(c => c.trackIndex === 0);
    expect(vClips[0].startTime).toBe(0);
    expect(vClips[1].startTime).toBe(5);

    const aClips = clips.filter(c => c.trackIndex > 0);
    expect(aClips[0].startTime).toBe(7); // video_clip_index 1 starts at 5s + offset 2s = 7s
  });

  describe('Metadata Extraction', () => {
    let stateService: TimelineStateService;
    let mockVideo: any;
    let mockAudio: any;
    let mockCanvas: any;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);

      mockVideo = {
        preload: '',
        crossOrigin: '',
        src: '',
        onloadedmetadata: null,
        onseeked: null,
        duration: 20,
        currentTime: 0,
      };
      mockAudio = {
        crossOrigin: '',
        muted: false,
        volume: 1,
        autoplay: true,
        src: '',
        onloadedmetadata: null,
        onerror: null,
        duration: 15,
      };
      mockCanvas = {
        width: 0,
        height: 0,
        getContext: jasmine
          .createSpy('getContext')
          .and.returnValue({drawImage: jasmine.createSpy('drawImage')}),
        toDataURL: jasmine
          .createSpy('toDataURL')
          .and.returnValue('data:image/jpeg;base64,test'),
      };

      spyOn(document, 'createElement').and.callFake((tagName: string) => {
        if (tagName === 'video') return mockVideo;
        if (tagName === 'audio') return mockAudio;
        if (tagName === 'canvas') return mockCanvas;
        return document.createElement(tagName);
      });
    });

    it('should update duration on video loadedmetadata', () => {
      const asset: MediaAsset = {
        id: 'a1',
        name: 'Test',
        type: 'video',
        url: 'test.mp4',
        safeUrl: '',
        duration: 0,
      };
      stateService.assets.set([asset]);

      component['extractVideoMetadataFromUrl'](asset);
      mockVideo.onloadedmetadata();

      const updatedAsset = stateService.assets().find(a => a.id === 'a1');
      expect(updatedAsset?.duration).toBe(20);
    });

    it('should update thumbnail on video seeked', () => {
      const asset: MediaAsset = {
        id: 'a1',
        name: 'Test',
        type: 'video',
        url: 'test.mp4',
        safeUrl: '',
        duration: 20,
      };
      stateService.assets.set([asset]);

      component['extractVideoMetadataFromUrl'](asset);
      mockVideo.onseeked();

      const updatedAsset = stateService.assets().find(a => a.id === 'a1');
      expect(updatedAsset?.thumbnail).toBe('data:image/jpeg;base64,test');
    });

    it('should update duration on audio loadedmetadata', () => {
      const asset: MediaAsset = {
        id: 'a1',
        name: 'Test',
        type: 'audio',
        url: 'test.mp3',
        safeUrl: '',
        duration: 0,
      };
      stateService.assets.set([asset]);

      component['extractAudioMetadataFromUrl'](asset);
      mockAudio.onloadedmetadata();

      const updatedAsset = stateService.assets().find(a => a.id === 'a1');
      expect(updatedAsset?.duration).toBe(15);
    });

    it('should fallback duration on audio error', () => {
      const asset: MediaAsset = {
        id: 'a1',
        name: 'Test',
        type: 'audio',
        url: 'test.mp3',
        safeUrl: '',
        duration: 0,
      };
      stateService.assets.set([asset]);

      component['extractAudioMetadataFromUrl'](asset);
      mockAudio.onerror({});

      const updatedAsset = stateService.assets().find(a => a.id === 'a1');
      expect(updatedAsset?.duration).toBe(10);
    });

    it('should extract video metadata', () => {
      const asset: MediaAsset = {
        id: 'a1',
        name: 'Test',
        type: 'video',
        url: 'test.mp4',
        safeUrl: '',
        duration: 0,
      };
      stateService.assets.set([asset]);

      component.extractVideoMetadata(asset);

      expect(mockVideo.src).toBe('test.mp4');

      mockVideo.onloadedmetadata();
      let updatedAsset = stateService.assets().find(a => a.id === 'a1');
      expect(updatedAsset?.duration).toBe(20);

      mockVideo.onseeked();
      updatedAsset = stateService.assets().find(a => a.id === 'a1');
      expect(updatedAsset?.thumbnail).toBe('data:image/jpeg;base64,test');
    });

    it('should extract audio metadata', () => {
      const asset: MediaAsset = {
        id: 'a1',
        name: 'Test',
        type: 'audio',
        url: 'test.mp3',
        safeUrl: '',
        duration: 0,
      };
      stateService.assets.set([asset]);

      component.extractAudioMetadata(asset);

      expect(mockAudio.src).toBe('test.mp3');

      mockAudio.onloadedmetadata();
      const updatedAsset = stateService.assets().find(a => a.id === 'a1');
      expect(updatedAsset?.duration).toBe(15);
    });
  });

  describe('Auto-Save Logic', () => {
    let storyboardService: StoryboardService;
    let agentChatService: AgentChatService;
    let stateService: TimelineStateService;
    let workbenchService: WorkbenchService;

    beforeEach(() => {
      storyboardService = TestBed.inject(StoryboardService);
      agentChatService = TestBed.inject(AgentChatService);
      stateService = TestBed.inject(TimelineStateService);
      workbenchService = TestBed.inject(WorkbenchService);
    });

    it('should set status to Saving... in triggerAutoSave', () => {
      stateService.loadedTimelineId.set(2);
      component.triggerAutoSave();
      expect(component.lastSavedText()).toBe('Saving...');
      expect(component['hasPendingSave']).toBeTrue();
    });

    it('should cancel previous in-flight save request when a new save is triggered', () => {
      const mockStoryboard = {id: 1, timeline_id: 2};
      agentChatService.currentStoryboard.set(mockStoryboard as any);
      stateService.timelineClips.set([]);

      spyOn(workbenchService, 'updateTimeline').and.returnValue(
        new Subject<any>(),
      );

      component.saveTimeline();

      const firstSubscription = component['activeSaveSubscription'];
      expect(firstSubscription).toBeDefined();
      spyOn(firstSubscription!, 'unsubscribe').and.callThrough();

      component.saveTimeline();

      expect(firstSubscription!.unsubscribe).toHaveBeenCalled();
    });

    it('should trigger saveTimeline on ngOnDestroy if hasPendingSave is true', () => {
      spyOn(component, 'saveTimeline');
      component['hasPendingSave'] = true;

      component.ngOnDestroy();

      expect(component.saveTimeline).toHaveBeenCalled();
    });

    it('should not trigger saveTimeline on ngOnDestroy if hasPendingSave is false', () => {
      spyOn(component, 'saveTimeline');
      component['hasPendingSave'] = false;

      component.ngOnDestroy();

      expect(component.saveTimeline).not.toHaveBeenCalled();
    });

    it('should call updateTimeline and update lastSavedText on saveTimeline success', () => {
      const mockStoryboard = {id: 1, timeline_id: 2};
      agentChatService.currentStoryboard.set(mockStoryboard as any);
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'a1',
          startTime: 0,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
          mediaItemId: 1219,
        },
      ]);

      const mockResponse = {
        timeline_id: 2,
        title: 'Timeline Updated',
        video_clips: [
          {
            id: 1,
            asset_ref: {id: 1219, type: 'media_item'},
            trim: {offset_seconds: 0, duration_seconds: 5},
          },
        ],
        audio_clips: [],
      };
      spyOn(workbenchService, 'updateTimeline').and.returnValue(
        of(mockResponse as any),
      );

      component.saveTimeline();

      expect(workbenchService.updateTimeline).toHaveBeenCalledWith(2, {
        timeline_id: 2,
        storyboard_id: 1,
        project_id: undefined,
        session_id: undefined,
        workspace_id: 1,
        title: 'Timeline',
        video_clips: [
          {
            asset_ref: {id: 1219, type: 'media_item'},
            trim: {offset_seconds: 0, duration_seconds: 5},
            first_frame_asset_ref: null,
            last_frame_asset_ref: null,
            placeholder: null,
            volume: 1.0,
            speed: 1.0,
          },
        ],
        audio_clips: [],
        transitions: [],
        transition_in: undefined,
        transition_out: undefined,
      });
      expect(component.lastSavedText()).toBe('Saved');
    });
  });

  describe('downloadVideo', () => {
    let agentChatService: AgentChatService;
    let workbenchService: WorkbenchService;
    let sourceAssetService: SourceAssetService;
    let http: HttpClient;

    beforeEach(() => {
      agentChatService = TestBed.inject(AgentChatService);
      workbenchService = TestBed.inject(WorkbenchService);
      sourceAssetService = TestBed.inject(SourceAssetService);
      http = TestBed.inject(HttpClient);
    });

    it('should not call renderVideo if storyboard is null', () => {
      agentChatService.currentStoryboard.set(null);
      spyOn(workbenchService, 'renderVideo');

      component.downloadVideo();

      expect(workbenchService.renderVideo).not.toHaveBeenCalled();
    });

    it('should not call renderVideo if storyboard.timeline_id is null', () => {
      agentChatService.currentStoryboard.set({id: 1} as any);
      spyOn(workbenchService, 'renderVideo');

      component.downloadVideo();

      expect(workbenchService.renderVideo).not.toHaveBeenCalled();
    });

    it('should call renderVideo and then getAsset to trigger file download', fakeAsync(() => {
      const stateService = TestBed.inject(TimelineStateService);
      stateService.loadedTimelineId.set(2);

      const mockStoryboard = {id: 1, timeline_id: 2};
      agentChatService.currentStoryboard.set(mockStoryboard as any);

      const renderResponse: any = {
        id: 10,
      };

      const mediaResponse: any = {
        id: 10,
        status: 'COMPLETED',
        presignedUrls: ['http://example.com/download-video.mp4'],
      };

      spyOn(workbenchService, 'renderVideo').and.returnValue(
        of(renderResponse),
      );

      const galleryService = TestBed.inject(GalleryService);
      spyOn(galleryService, 'getMedia').and.returnValue(of(mediaResponse));

      const mockBlob = new Blob(['mock binary'], {type: 'video/mp4'});
      spyOn(http, 'get').and.returnValue(of(mockBlob));
      spyOn(window.URL, 'createObjectURL').and.returnValue('blob:mock-url');
      spyOn(window.URL, 'revokeObjectURL');

      const mockAnchor = jasmine.createSpyObj('HTMLAnchorElement', ['click']);
      spyOn(document, 'createElement').and.returnValue(mockAnchor);
      spyOn(document.body, 'appendChild');
      spyOn(document.body, 'removeChild');

      component.downloadVideo();
      tick(2000); // Advance time for the interval

      expect(workbenchService.renderVideo).toHaveBeenCalledWith({
        timeline_id: 2,
      });
      expect(galleryService.getMedia).toHaveBeenCalledWith(10);
      expect(http.get).toHaveBeenCalledWith(
        'http://example.com/download-video.mp4',
        {responseType: 'blob'} as any,
      );
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.href).toBe('blob:mock-url');
      // expect(mockAnchor.download).toBe('video_rendered.mp4'); // Filename is dynamic now
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(component.isDownloading()).toBeFalse();
    }));

    it('should call saveTimeline first if hasPendingSave is true before rendering', fakeAsync(() => {
      const stateService = TestBed.inject(TimelineStateService);
      stateService.loadedTimelineId.set(2);

      const mockStoryboard = {id: 1, timeline_id: 2};
      agentChatService.currentStoryboard.set(mockStoryboard as any);

      component['hasPendingSave'] = true;

      const renderResponse: any = {
        id: 10,
      };

      const mediaResponse: any = {
        id: 10,
        status: 'COMPLETED',
        presignedUrls: ['http://example.com/download-video.mp4'],
      };

      spyOn(component, 'saveTimeline').and.returnValue(of({} as any));
      spyOn(workbenchService, 'renderVideo').and.returnValue(
        of(renderResponse),
      );

      const galleryService = TestBed.inject(GalleryService);
      spyOn(galleryService, 'getMedia').and.returnValue(of(mediaResponse));

      const mockBlob = new Blob(['mock binary'], {type: 'video/mp4'});
      spyOn(http, 'get').and.returnValue(of(mockBlob));
      spyOn(window.URL, 'createObjectURL').and.returnValue('blob:mock-url2');
      spyOn(window.URL, 'revokeObjectURL');

      const mockAnchor = jasmine.createSpyObj('HTMLAnchorElement', ['click']);
      spyOn(document, 'createElement').and.returnValue(mockAnchor);
      spyOn(document.body, 'appendChild');
      spyOn(document.body, 'removeChild');

      component.downloadVideo();
      tick(2000); // Advance time for the interval

      expect(component.saveTimeline).toHaveBeenCalled();
      expect(workbenchService.renderVideo).toHaveBeenCalledWith({
        timeline_id: 2,
      });
      expect(galleryService.getMedia).toHaveBeenCalledWith(10);
      expect(http.get).toHaveBeenCalledWith(
        'http://example.com/download-video.mp4',
        {responseType: 'blob'} as any,
      );
      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockAnchor.href).toBe('blob:mock-url2');
      // expect(mockAnchor.download).toBe('video_rendered.mp4');
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(component.isDownloading()).toBeFalse();
    }));
  });

  describe('togglePlay', () => {
    let stateService: TimelineStateService;
    let playbackService: PlayheadSyncService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
      playbackService = TestBed.inject(PlayheadSyncService);
      spyOn(playbackService, 'runGameLoop');
      spyOn(playbackService, 'stopLoop');
    });

    it('should pause playback if currently playing', () => {
      stateService.isPlaying.set(true);

      component.togglePlay();

      expect(stateService.isPlaying()).toBeFalse();
      expect(playbackService.stopLoop).toHaveBeenCalled();
    });

    it('should start playback if currently paused', () => {
      stateService.isPlaying.set(false);

      component.togglePlay();

      expect(stateService.isPlaying()).toBeTrue();
      expect(playbackService.runGameLoop).toHaveBeenCalled();
    });

    it('should set activeToolButton to null when starting play and agent view is active with timeline content', () => {
      stateService.isPlaying.set(false);
      component.activeToolButton.set('agent');
      stateService.timelineClips.set([{id: 'clip1'} as any]);

      component.togglePlay();

      expect(component.activeToolButton()).toBeNull();
      expect(stateService.isPlaying()).toBeTrue();
    });

    it('should keep activeToolButton as agent when starting play and agent view is active but timeline is empty', () => {
      stateService.isPlaying.set(false);
      component.activeToolButton.set('agent');
      stateService.timelineClips.set([]);

      component.togglePlay();

      expect(component.activeToolButton()).toBe('agent');
      expect(stateService.isPlaying()).toBeTrue();
    });
  });

  describe('Storyboard Loading Effect', () => {
    let agentChatService: AgentChatService;
    let stateService: TimelineStateService;
    let workbenchService: WorkbenchService;

    beforeEach(() => {
      agentChatService = TestBed.inject(AgentChatService);
      stateService = TestBed.inject(TimelineStateService);
      workbenchService = TestBed.inject(WorkbenchService);
    });

    it('should fetch timeline when currentStoryboard is updated with a new timeline_id', fakeAsync(() => {
      const mockTimeline: TimelineDTO = {
        timeline_id: 42,
        storyboard_id: 1,
        workspace_id: 1,
        title: 'Mock Timeline',
        video_clips: [],
        audio_clips: [],
      };

      spyOn(workbenchService, 'getTimeline').and.returnValue(of(mockTimeline));
      spyOn(component, 'processGeneratedData').and.callThrough();

      stateService.loadedTimelineId.set(undefined);

      agentChatService.currentStoryboard.set({
        id: 1,
        timeline_id: 42,
        scenes: [],
      } as any);

      // Trigger effect execution
      fixture.detectChanges();
      tick();

      expect(workbenchService.getTimeline).toHaveBeenCalledWith(42);
      expect(component.processGeneratedData).toHaveBeenCalledWith(mockTimeline);
      expect(stateService.loadedTimelineId()).toBe(42);
      expect(component.lastSavedText()).toBe('Saved');
    }));

    it('should not fetch timeline if loadedTimelineId already matches storyboard.timeline_id', fakeAsync(() => {
      spyOn(workbenchService, 'getTimeline').and.callThrough();

      stateService.loadedTimelineId.set(42);
      fixture.detectChanges();
      tick();

      (workbenchService.getTimeline as jasmine.Spy).calls.reset();

      agentChatService.currentStoryboard.set({
        id: 1,
        timeline_id: 42,
        scenes: [],
      } as any);

      fixture.detectChanges();
      tick();

      expect(workbenchService.getTimeline).not.toHaveBeenCalled();
    }));

    it('should clear timeline state if storyboard is null - when coming from the agent state', fakeAsync(() => {
      agentChatService.currentStoryboard.set({id: 1, timeline_id: 42} as any);
      fixture.detectChanges();
      tick();

      stateService.timelineClips.set([{id: 'c1'} as any]);
      expect(stateService.timelineClips().length).toBe(1);

      agentChatService.currentStoryboard.set(null);
      stateService.loadedTimelineId.set(undefined);
      fixture.detectChanges();
      tick();

      expect(stateService.timelineClips()).toEqual([]);
      expect(stateService.loadedTimelineId()).toBeUndefined();
    }));
  });

  it('should pause timeline and stop loop when activeToolButton is set to agent', () => {
    const stateService = TestBed.inject(TimelineStateService);
    const playbackService = TestBed.inject(PlayheadSyncService);
    spyOn(playbackService, 'stopLoop').and.callThrough();

    stateService.isPlaying.set(true);
    component.activeToolButton.set(null);
    fixture.detectChanges();

    component.activeToolButton.set('agent');
    fixture.detectChanges();

    expect(stateService.isPlaying()).toBeFalse();
    expect(playbackService.stopLoop).toHaveBeenCalled();
  });

  describe('Track Management & Visibility', () => {
    it('should toggle video visibility', () => {
      expect(component.isVideoHidden()).toBeFalse();
      component.toggleVideoVisibility();
      expect(component.isVideoHidden()).toBeTrue();
      component.toggleVideoVisibility();
      expect(component.isVideoHidden()).toBeFalse();
    });

    it('should toggle track lock status', () => {
      expect(component.isTrackLocked(1)).toBeFalse();
      component.toggleTrackLock(1);
      expect(component.isTrackLocked(1)).toBeTrue();
      component.toggleTrackLock(1);
      expect(component.isTrackLocked(1)).toBeFalse();
    });

    it('should toggle track mute status', () => {
      expect(component.isTrackMuted(2)).toBeFalse();
      component.toggleTrackMute(2);
      expect(component.isTrackMuted(2)).toBeTrue();
      component.toggleTrackMute(2);
      expect(component.isTrackMuted(2)).toBeFalse();
    });

    it('should close agent view', () => {
      component.activeToolButton.set('agent');
      component.onCloseAgentView();
      expect(component.activeToolButton()).toBeNull();
    });
  });

  describe('Media Asset Helpers', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
      stateService.assets.set([
        {
          id: 'v1',
          name: 'Video 1',
          type: 'video',
          url: '',
          safeUrl: '',
          duration: 10,
          thumbnail: 'thumb1.jpg',
        },
        {
          id: 'a1',
          name: 'Audio 1',
          type: 'audio',
          url: '',
          safeUrl: '',
          duration: 5,
        },
      ]);
    });

    it('should get asset thumbnail', () => {
      expect(component.getAssetThumbnail('v1')).toBe('thumb1.jpg');
      expect(component.getAssetThumbnail('a1')).toBeUndefined();
    });

    it('should get asset name', () => {
      expect(component.getAssetName('v1')).toBe('Video 1');
      expect(component.getAssetName('unknown')).toBe('Clip');
    });

    it('should check if asset is video', () => {
      expect(component.isAssetVideo('v1')).toBeTrue();
      expect(component.isAssetVideo('a1')).toBeFalse();
    });

    it('should clear thumbnail on error', () => {
      const asset = stateService.assets()[0];
      component.onThumbnailError(asset);
      expect(component.getAssetThumbnail('v1')).toBeUndefined();
    });
  });

  describe('Transition Changes', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 10,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
        {
          id: 'c2',
          assetId: 'v2',
          startTime: 10,
          duration: 10,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);
      spyOn(component, 'saveTimeline').and.returnValue(of(null));
    });

    it('should set transitionIn', () => {
      component.onTransitionChange({
        role: 'in',
        type: TransitionType.FADE,
        duration_seconds: 1.5,
      });
      expect(stateService.transitionIn()).toEqual({
        type: TransitionType.FADE,
        duration_seconds: 1.5,
      });
    });

    it('should set transitionOut', () => {
      component.onTransitionChange({
        role: 'out',
        type: TransitionType.WIPE_LEFT,
        duration_seconds: 2.0,
      });
      expect(stateService.transitionOut()).toEqual({
        type: TransitionType.WIPE_LEFT,
        duration_seconds: 2.0,
      });
    });

    it('should set middle transition', () => {
      component.onTransitionChange({
        role: 'middle',
        index: 0,
        type: TransitionType.FADE,
        duration_seconds: 1.0,
      });
      expect(stateService.transitions()[0]).toEqual({
        type: TransitionType.FADE,
        duration_seconds: 1.0,
      });
      const clips = stateService.timelineClips();
      expect(clips[0].transition_to_next_type).toBe(TransitionType.FADE);
      expect(clips[0].transition_to_next_duration).toBe(1.0);
    });
  });

  describe('Trimming and Dragging State Triggers', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
      stateService.isPlaying.set(true);
    });

    it('should initialize trim state and pause playback', () => {
      const clip = {
        id: 'c1',
        assetId: 'v1',
        startTime: 0,
        duration: 10,
        offset: 0,
        trackIndex: 0,
        color: 'blue',
      };
      const event = new MouseEvent('mousedown');
      component.startTrim(event, clip, 'end');

      expect(stateService.isPlaying()).toBeFalse();
      expect(component.trimState).toEqual({
        active: true,
        clipId: 'c1',
        type: 'end',
        startX: event.clientX,
        initialStart: 0,
        initialDur: 10,
        initialOffset: 0,
      });
    });

    it('should initialize drag state and pause playback', () => {
      const clip = {
        id: 'c1',
        assetId: 'v1',
        startTime: 0,
        duration: 10,
        offset: 0,
        trackIndex: 0,
        color: 'blue',
      };
      const event = new MouseEvent('mousedown');
      component.startDrag(event, clip);

      expect(stateService.isPlaying()).toBeFalse();
      expect(component.dragState).toEqual({
        active: true,
        clipId: 'c1',
        startX: event.clientX,
        initialStartTime: 0,
      });
    });

    it('should end trim', () => {
      component.trimState = {
        active: true,
        clipId: 'c1',
        type: 'end',
        startX: 0,
        initialStart: 0,
        initialDur: 10,
        initialOffset: 0,
        hasMoved: true,
      };
      spyOn(component, 'refreshTimelineLayout');
      spyOn(component, 'triggerAutoSave');

      component.onTrimEnd();

      expect(component.refreshTimelineLayout).toHaveBeenCalled();
      expect(component.triggerAutoSave).toHaveBeenCalled();
      expect(component.trimState).toBeNull();
    });

    it('should end drag', () => {
      component.dragState = {
        active: true,
        clipId: 'c1',
        startX: 0,
        initialStartTime: 0,
        hasMoved: true,
      };
      spyOn(component, 'triggerAutoSave');

      const stateService = TestBed.inject(TimelineStateService);
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 10,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);

      component.onDragEnd();

      expect(component.dragState).toBeNull();
      expect(component.triggerAutoSave).toHaveBeenCalled();
    });
  });

  describe('Utilities', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
    });

    it('should format time correctly', () => {
      expect(component.formatTime(0)).toBe('00:00:00:00');
      expect(component.formatTime(3661.5)).toBe('01:01:01:15');
    });

    it('should toggle tool button', () => {
      component.activeToolButton.set(null);
      component.toggleToolButton('gallery');
      expect(component.activeToolButton()).toBe('gallery');
      component.toggleToolButton('gallery');
      expect(component.activeToolButton()).toBeNull();
      component.toggleToolButton('audio');
      expect(component.activeToolButton()).toBe('audio');
    });

    it('should get thumbnail sequence length', () => {
      stateService.pixelsPerSecond.set(20);
      expect(component.getThumbnailsSequence(10)).toEqual([1, 2, 3]);
    });

    it('should get last video clip end time', () => {
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
        {
          id: 'c2',
          assetId: 'v2',
          startTime: 5,
          duration: 12,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
        {
          id: 'a1',
          assetId: 'a1',
          startTime: 2,
          duration: 10,
          offset: 0,
          trackIndex: 1,
          color: 'green',
        },
      ]);
      expect(component.getLastVideoClipEndTime()).toBe(17);
    });

    it('should get visual clip left offset', () => {
      stateService.pixelsPerSecond.set(10);
      const clips = [
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
        {
          id: 'c2',
          assetId: 'v2',
          startTime: 5,
          duration: 12,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
        {
          id: 'a1',
          assetId: 'a1',
          startTime: 3,
          duration: 10,
          offset: 0,
          trackIndex: 1,
          color: 'green',
        },
      ];
      stateService.timelineClips.set(clips);

      expect(component.getVisualClipLeft(clips[2])).toBe(32);
      expect(component.getVisualClipLeft(clips[0])).toBe(2);
      expect(component.getVisualClipLeft(clips[1])).toBe(52);
    });

    it('should get visual transition left offset', () => {
      stateService.pixelsPerSecond.set(10);
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
        {
          id: 'c2',
          assetId: 'v2',
          startTime: 5,
          duration: 10,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);
      expect(component.getVisualTransitionLeft(0)).toBe(38);
      expect(component.getVisualTransitionLeft(1)).toBe(0);
    });

    it('should get visual total duration', () => {
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
        {
          id: 'c2',
          assetId: 'v2',
          startTime: 5,
          duration: 12,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);
      expect(component.getVisualTotalDuration()).toBe(17);
    });
  });

  describe('OnInit Route Query Parameter Syncing', () => {
    let mockRouter: any;
    let mockHttp: HttpClient;

    beforeEach(() => {
      mockRouter = TestBed.inject(Router);
      mockHttp = TestBed.inject(HttpClient);
    });

    it('should sync active project when query parameter projectId changes', () => {
      const mockProject = {
        id: 123,
        workspace_id: 1,
        timeline_id: 456,
        session_id: 'sess-abc',
        storyboard_id: 789,
      };

      spyOn(mockHttp, 'get').and.returnValue(of(mockProject));
      spyOn(mockRouter, 'navigate').and.returnValue(Promise.resolve(true));

      // Emit new query parameters
      mockQueryParams.next({projectId: '123'});

      expect(mockHttp.get).toHaveBeenCalledWith('/api/projects/123');
      const stateService = TestBed.inject(TimelineStateService);
      const projectState = TestBed.inject(ProjectStateService);
      const agentChat = TestBed.inject(AgentChatService);

      expect(stateService.loadedTimelineId()).toBe(456);
      expect(agentChat.selectedSessionId()).toBe('sess-abc');
      expect(agentChat.currentStoryboard()).toEqual({id: 789});
      expect(projectState.getActiveProjectId()).toBe(123);
      expect(component.currentProjectId()).toBe(123);
    });
  });

  describe('Adding & Deleting from Timeline', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
      stateService.currentTime.set(5.0);
      spyOn(component, 'triggerAutoSave');
    });

    it('should add video asset and synced audio to timeline', () => {
      const asset: MediaAsset = {
        id: 'v1',
        name: 'Video 1',
        type: 'video',
        url: 'v1.mp4',
        safeUrl: '',
        duration: 10,
        mediaItemId: 101,
      };

      component.addToTimeline(asset);

      const clips = stateService.timelineClips();
      expect(clips.length).toBe(2);
      expect(clips[0].trackIndex).toBe(0);
      expect(clips[0].assetId).toBe('v1');
      expect(clips[0].duration).toBe(10);
      expect(clips[0].startTime).toBe(0);

      expect(clips[1].trackIndex).toBe(1);
      expect(clips[1].assetId).toBe('v1');
      expect(clips[1].duration).toBe(10);
      expect(clips[1].startTime).toBe(0);
    });

    it('should add audio asset at playhead on first available track', () => {
      const asset: MediaAsset = {
        id: 'a1',
        name: 'Audio 1',
        type: 'audio',
        url: 'a1.mp3',
        safeUrl: '',
        duration: 8,
        mediaItemId: 102,
      };

      stateService.timelineClips.set([
        {
          id: 'c_existing',
          assetId: 'other',
          startTime: 2,
          duration: 5,
          offset: 0,
          trackIndex: 1,
          color: 'green',
        },
      ]);

      component.addToTimeline(asset);

      const clips = stateService.timelineClips();
      expect(clips.length).toBe(2);
      const newClip = clips.find(c => c.id !== 'c_existing')!;
      expect(newClip.startTime).toBe(5);
      expect(newClip.trackIndex).toBe(2);
    });

    it('should delete asset and all related clips', () => {
      const asset: MediaAsset = {
        id: 'v1',
        name: 'Video 1',
        type: 'video',
        url: 'v1.mp4',
        safeUrl: '',
        duration: 10,
      };
      stateService.assets.set([asset]);
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 10,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
        {
          id: 'c2',
          assetId: 'other',
          startTime: 0,
          duration: 5,
          offset: 0,
          trackIndex: 1,
          color: 'green',
        },
      ]);
      stateService.selectedClipId.set('c1');

      const event = new MouseEvent('click');
      component.deleteAsset(asset, event);

      expect(stateService.assets()).toEqual([]);
      expect(stateService.timelineClips().length).toBe(1);
      expect(stateService.timelineClips()[0].id).toBe('c2');
      expect(stateService.selectedClipId()).toBeNull();
    });
  });

  describe('Overlap Resolution & Layout', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
      spyOn(component, 'triggerAutoSave');
    });

    it('should ripple video clips sequentially without gaps', () => {
      stateService.timelineClips.set([
        {
          id: 'v1',
          assetId: 'v1',
          startTime: 2.0,
          duration: 5.0,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
        {
          id: 'v2',
          assetId: 'v2',
          startTime: 10.0,
          duration: 8.0,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);

      component['resolveOverlaps']('v1');

      const clips = stateService.timelineClips();
      expect(clips.find(c => c.id === 'v1')!.startTime).toBe(0);
      expect(clips.find(c => c.id === 'v2')!.startTime).toBe(5.0);
    });

    it('should gravity audio clip on track resolution', () => {
      stateService.timelineClips.set([
        {
          id: 'a1',
          assetId: 'a1',
          startTime: 2.0,
          duration: 5.0,
          offset: 0,
          trackIndex: 1,
          color: 'green',
        },
        {
          id: 'a2',
          assetId: 'a2',
          startTime: 3.0,
          duration: 5.0,
          offset: 0,
          trackIndex: 1,
          color: 'green',
        },
      ]);

      component['resolveOverlaps']('a2');

      expect(
        stateService.timelineClips().find(c => c.id === 'a2')!.trackIndex,
      ).toBe(2);
    });
  });

  describe('Trimming & Dragging Operations', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
      stateService.assets.set([
        {
          id: 'v1',
          name: 'Video 1',
          type: 'video',
          url: 'v1.mp4',
          safeUrl: '',
          duration: 15.0,
        },
      ]);
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 10.0,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);
      stateService.pixelsPerSecond.set(10);
    });

    it('should trim end of clip on move', () => {
      component.trimState = {
        active: true,
        clipId: 'c1',
        type: 'end',
        startX: 100,
        initialStart: 0,
        initialDur: 10.0,
        initialOffset: 0,
      };

      const event = {clientX: 120} as MouseEvent;
      component.onTrimMove(event);

      expect(stateService.timelineClips()[0].duration).toBe(12.0);
      expect(stateService.timelineClips()[0].offset).toBe(0);
    });

    it('should trim start of clip on move', () => {
      component.trimState = {
        active: true,
        clipId: 'c1',
        type: 'start',
        startX: 100,
        initialStart: 0,
        initialDur: 10.0,
        initialOffset: 2.0,
      };

      const event = {clientX: 120} as MouseEvent;
      component.onTrimMove(event);

      expect(stateService.timelineClips()[0].duration).toBe(8.0);
      expect(stateService.timelineClips()[0].offset).toBe(4.0);
    });

    it('should drag and move clip startTime', () => {
      component.dragState = {
        active: true,
        clipId: 'c1',
        startX: 100,
        initialStartTime: 5.0,
      };

      const event = {clientX: 80} as MouseEvent;
      component.onDragMove(event);

      expect(stateService.timelineClips()[0].startTime).toBe(3.0);
    });

    it('should snap drag startTime to 0', () => {
      component.dragState = {
        active: true,
        clipId: 'c1',
        startX: 100,
        initialStartTime: 1.0,
      };

      const event = {clientX: 92} as MouseEvent;
      component.onDragMove(event);

      expect(stateService.timelineClips()[0].startTime).toBe(0);
    });
  });

  describe('Route Param Syncing - Storyboard, Timeline, Session ID', () => {
    let mockRouter: any;
    let mockHttp: HttpClient;
    let projectState: any;
    let stateService: TimelineStateService;
    let agentChat: AgentChatService;
    let workspaceState: WorkspaceStateService;
    let projectService: ProjectService;

    beforeEach(() => {
      mockRouter = TestBed.inject(Router);
      mockHttp = TestBed.inject(HttpClient);
      projectState = TestBed.inject(ProjectStateService);
      stateService = TestBed.inject(TimelineStateService);
      agentChat = TestBed.inject(AgentChatService);
      workspaceState = TestBed.inject(WorkspaceStateService);
      projectService = TestBed.inject(ProjectService);
      spyOn(mockRouter, 'navigate').and.returnValue(Promise.resolve(true));
    });

    it('should sync when storyboardId is in query params', () => {
      const mockProject = {
        id: 12,
        workspace_id: 1,
        timeline_id: 34,
        session_id: 'sess-story',
        storyboard_id: 56,
      };
      spyOn(mockHttp, 'get').and.returnValue(of(mockProject));

      mockQueryParams.next({storyboardId: '56'});

      expect(mockHttp.get).toHaveBeenCalledWith(
        '/api/projects/any?storyboard_id=56',
      );
      expect(component.currentProjectId()).toBe(12);
      expect(stateService.loadedTimelineId()).toBe(34);
      expect(agentChat.selectedSessionId()).toBe('sess-story');
      expect(agentChat.currentStoryboard()).toEqual({id: 56});
    });

    it('should sync when timelineId is in query params', () => {
      const mockProject = {
        id: 15,
        workspace_id: 1,
        timeline_id: 35,
        session_id: 'sess-timeline',
        storyboard_id: 57,
      };
      spyOn(mockHttp, 'get').and.returnValue(of(mockProject));

      mockQueryParams.next({timelineId: '35'});

      expect(mockHttp.get).toHaveBeenCalledWith(
        '/api/projects/any?timeline_id=35',
      );
      expect(component.currentProjectId()).toBe(15);
      expect(stateService.loadedTimelineId()).toBe(35);
    });

    it('should sync when sessionId is in query params', () => {
      const mockProject = {
        id: 16,
        workspace_id: 1,
        timeline_id: 36,
        session_id: 'sess-123',
        storyboard_id: 58,
      };
      spyOn(mockHttp, 'get').and.returnValue(of(mockProject));

      mockQueryParams.next({sessionId: 'sess-123'});

      expect(mockHttp.get).toHaveBeenCalledWith(
        '/api/projects/any?session_id=sess-123',
      );
      expect(component.currentProjectId()).toBe(16);
    });

    it('should verify project on load when no params are in URL but project ID is active', () => {
      spyOn(projectState, 'getActiveProjectId').and.returnValue(123);
      spyOn(workspaceState, 'getActiveWorkspaceId').and.returnValue(1);

      const mockProject = {
        id: 123,
        workspace_id: 1,
        name: 'Project Active',
      };
      spyOn(projectService, 'getProject').and.returnValue(
        of(mockProject as any),
      );

      mockQueryParams.next({});

      expect(projectService.getProject).toHaveBeenCalledWith(123);
      expect(mockRouter.navigate).toHaveBeenCalledWith([], jasmine.any(Object));
    });

    it('should clear active project on load if project workspace does not match active workspace', () => {
      spyOn(projectState, 'getActiveProjectId').and.returnValue(123);
      spyOn(workspaceState, 'getActiveWorkspaceId').and.returnValue(2);
      spyOn(projectState, 'setActiveProjectId');

      const mockProject = {
        id: 123,
        workspace_id: 1,
        name: 'Project Active',
      };
      spyOn(projectService, 'getProject').and.returnValue(
        of(mockProject as any),
      );

      mockQueryParams.next({});

      expect(projectState.setActiveProjectId).toHaveBeenCalledWith(null);
    });
  });

  describe('Source Asset & File Selection Branching', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
    });

    it('should process cloud media result for SourceAssetResponseDto', () => {
      const mockResult = {
        id: 456,
        originalFilename: 'source.mp3',
        mimeType: 'audio/mp3',
        presignedUrl: 'source_presigned.mp3',
        workspace_id: 1,
      };

      component['processCloudMediaResult'](mockResult as any);

      const assets = stateService.assets();
      expect(assets.length).toBe(1);
      expect(assets[0].name).toBe('source.mp3');
      expect(assets[0].type).toBe('audio');
    });

    it('should handle audio file selection', () => {
      spyOn(window.URL, 'createObjectURL').and.returnValue('blob:audio-test');

      const file = new File([''], 'audio.mp3', {type: 'audio/mp3'});
      const event = {target: {files: [file]}} as unknown as Event;

      component.onFileSelected(event);

      const assets = stateService.assets();
      expect(assets.length).toBe(1);
      expect(assets[0].name).toBe('audio.mp3');
      expect(assets[0].type).toBe('audio');
    });
  });

  describe('canSplit checks', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
    });

    it('should return false if no clip is selected', () => {
      stateService.selectedClipId.set(null);
      expect(component.canSplit()).toBeFalse();
    });

    it('should return false if selected clip is not found', () => {
      stateService.selectedClipId.set('nonexistent');
      stateService.timelineClips.set([]);
      expect(component.canSplit()).toBeFalse();
    });

    it('should return false if currentTime is outside split boundary', () => {
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 10.0,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);
      stateService.selectedClipId.set('c1');

      stateService.currentTime.set(0.05);
      expect(component.canSplit()).toBeFalse();

      stateService.currentTime.set(9.95);
      expect(component.canSplit()).toBeFalse();
    });

    it('should return true if currentTime is inside split boundary', () => {
      stateService.timelineClips.set([
        {
          id: 'c1',
          assetId: 'v1',
          startTime: 0,
          duration: 10.0,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);
      stateService.selectedClipId.set('c1');

      stateService.currentTime.set(5.0);
      expect(component.canSplit()).toBeTrue();
    });
  });

  describe('Scrubbing State & Actions', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
      stateService.isPlaying.set(true);
      stateService.timelineClips.set([
        {
          id: 'c_dur',
          assetId: 'v1',
          startTime: 0,
          duration: 30.0,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);
      stateService.pixelsPerSecond.set(10);
    });

    it('should start scrubbing and pause playback', () => {
      const event = new MouseEvent('mousedown', {clientX: 100});
      component.onScrubStart(event);

      expect(stateService.isPlaying()).toBeFalse();
      expect(component.scrubState).toEqual({
        active: true,
        startX: 100,
        initialTime: stateService.currentTime(),
      });
    });

    it('should move playhead currentTime during scrub', () => {
      component.scrubState = {
        active: true,
        startX: 100,
        initialTime: 10.0,
      };

      const event = {clientX: 150} as MouseEvent;
      component.onScrubMove(event);

      expect(stateService.currentTime()).toBe(15.0);
    });

    it('should end scrubbing', () => {
      component.scrubState = {active: true, startX: 100, initialTime: 10.0};
      component.onScrubEnd();
      expect(component.scrubState).toBeNull();
    });
  });

  describe('selectedClipIndex', () => {
    it('should return -1 if no clip is selected', () => {
      const stateService = TestBed.inject(TimelineStateService);
      stateService.selectedClipId.set(null);
      expect(component.selectedClipIndex()).toBe(-1);
    });

    it('should return index of selected video clip', () => {
      const stateService = TestBed.inject(TimelineStateService);
      stateService.timelineClips.set([
        {
          id: 'clip-1',
          assetId: 'a1',
          startTime: 0,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'red',
        },
        {
          id: 'clip-2',
          assetId: 'a2',
          startTime: 5,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);
      stateService.selectedClipId.set('clip-2');
      expect(component.selectedClipIndex()).toBe(1);
    });
  });

  describe('activeVideoSrc', () => {
    it('should return empty string if there is no active video clip', () => {
      const stateService = TestBed.inject(TimelineStateService);
      stateService.timelineClips.set([]);
      stateService.currentTime.set(0);
      expect(component.activeVideoSrc()).toBe('');
    });

    it('should return the safeUrl of the active video clip asset', () => {
      const stateService = TestBed.inject(TimelineStateService);
      stateService.assets.set([
        {
          id: 'a1',
          name: 'Video',
          url: 'video.mp4',
          safeUrl: 'safe-video.mp4',
          type: 'video',
        } as any,
      ]);
      stateService.timelineClips.set([
        {
          id: 'clip-1',
          assetId: 'a1',
          startTime: 0,
          duration: 10,
          offset: 0,
          trackIndex: 0,
          color: 'red',
        },
      ]);
      stateService.currentTime.set(5);

      expect(component.activeVideoSrc()).toBe('safe-video.mp4');
    });
  });

  describe('onVideoMetadataLoaded', () => {
    it('should calculate and set videoAspectRatio aspect ratio correctly', () => {
      const mockVideo = {
        videoWidth: 1920,
        videoHeight: 1080,
      } as any;
      const mockEvent = {
        target: mockVideo,
      } as any;

      component.onVideoMetadataLoaded(mockEvent);

      expect(component.videoAspectRatio()).toBe((1920 / 1080).toString());
    });

    it('should not set videoAspectRatio if target properties are missing or zero', () => {
      component.videoAspectRatio.set('16/9');
      const mockVideo = {
        videoWidth: 0,
        videoHeight: 1080,
      } as any;
      const mockEvent = {
        target: mockVideo,
      } as any;

      component.onVideoMetadataLoaded(mockEvent);

      expect(component.videoAspectRatio()).toBe('16/9');
    });
  });

  describe('getRandomHeight', () => {
    it('should calculate deterministic heights based on seed', () => {
      expect(component.getRandomHeight(0)).toBe(60);
      expect(component.getRandomHeight(Math.PI / 2)).toBeCloseTo(100, 5);
      expect(component.getRandomHeight(-Math.PI / 2)).toBeCloseTo(20, 5);
    });
  });

  describe('onDummyScroll', () => {
    it('should update timelineState scrollOffset and timeRuler scrollLeft', () => {
      const stateService = TestBed.inject(TimelineStateService);

      const mockTimeRuler = jasmine.createSpyObj('TimeRulerComponent', [
        'setScrollLeft',
      ]);
      component.timeRuler = mockTimeRuler;

      const mockEvent = {
        target: {
          scrollLeft: 120,
        },
      } as unknown as Event;

      component.onDummyScroll(mockEvent);

      expect(stateService.scrollOffset()).toBe(120);
      expect(mockTimeRuler.setScrollLeft).toHaveBeenCalledWith(120);
    });
  });

  describe('onTimelineMouseDown', () => {
    let stateService: TimelineStateService;

    beforeEach(() => {
      stateService = TestBed.inject(TimelineStateService);
      stateService.pixelsPerSecond.set(10);
      component.dragState = null;
    });

    it('should return early if dragState is active', () => {
      component.dragState = {
        active: true,
        clipId: 'c1',
        startX: 100,
        initialStartTime: 10,
      };
      spyOn(stateService.currentTime, 'set');

      const mockEvent = new MouseEvent('mousedown');
      component.onTimelineMouseDown(mockEvent);

      expect(stateService.currentTime.set).not.toHaveBeenCalled();
    });

    it('should use offsetX and currentTarget scrollLeft when target === currentTarget', () => {
      const mockElement = {
        scrollLeft: 50,
      } as unknown as HTMLElement;

      const mockEvent = {
        target: mockElement,
        currentTarget: mockElement,
        offsetX: 30,
        preventDefault: jasmine.createSpy('preventDefault'),
        stopPropagation: jasmine.createSpy('stopPropagation'),
      } as unknown as MouseEvent;

      spyOn(stateService.currentTime, 'set').and.callThrough();

      component.onTimelineMouseDown(mockEvent);

      expect(stateService.currentTime.set).toHaveBeenCalledWith(8);
    });

    it('should use clientX, scrollLeft and bounding rect when target !== currentTarget', () => {
      const parentElement = {
        scrollLeft: 40,
        getBoundingClientRect: () => ({left: 20}) as DOMRect,
      } as unknown as HTMLElement;

      const childElement = {} as unknown as HTMLElement;

      const mockEvent = {
        target: childElement,
        currentTarget: parentElement,
        clientX: 150,
        preventDefault: jasmine.createSpy('preventDefault'),
        stopPropagation: jasmine.createSpy('stopPropagation'),
      } as unknown as MouseEvent;

      spyOn(stateService.currentTime, 'set').and.callThrough();

      component.onTimelineMouseDown(mockEvent);

      expect(stateService.currentTime.set).toHaveBeenCalledWith(17);
    });

    it('should center timeline view and update dummyScrollContainer scrollLeft', () => {
      const mockElement = {
        scrollLeft: 0,
        clientWidth: 200,
      } as unknown as HTMLElement;

      const mockEvent = {
        target: mockElement,
        currentTarget: mockElement,
        offsetX: 150,
        preventDefault: jasmine.createSpy('preventDefault'),
        stopPropagation: jasmine.createSpy('stopPropagation'),
      } as unknown as MouseEvent;

      component.timelineContainer = {
        nativeElement: mockElement,
      } as any;

      const dummyScrollEl = {
        scrollLeft: 0,
      } as unknown as HTMLElement;
      component.dummyScrollContainer = {
        nativeElement: dummyScrollEl,
      } as any;

      component.onTimelineMouseDown(mockEvent);

      expect(stateService.scrollOffset()).toBe(50);
      expect(dummyScrollEl.scrollLeft).toBe(50);
    });
  });
});

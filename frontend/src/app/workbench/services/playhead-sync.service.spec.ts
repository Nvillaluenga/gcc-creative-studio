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
import {PlayheadSyncService} from './playhead-sync.service';
import {TimelineStateService} from './timeline-state.service';
import {Component} from '@angular/core';
import {TimeRulerComponent} from '../components/time-ruler/time-ruler.component';
import {TransitionType} from '../../common/models/workbench.model';

@Component({
  template: '',
  standalone: true,
})
class TestComponent {
  constructor(public service: PlayheadSyncService) {}
}

describe('PlayheadSyncService', () => {
  let service: PlayheadSyncService;
  let stateService: TimelineStateService;
  let fixture: ComponentFixture<TestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestComponent],
      providers: [PlayheadSyncService],
    }).compileComponents();

    fixture = TestBed.createComponent(TestComponent);
    service = fixture.componentInstance.service;
    stateService = TestBed.inject(TimelineStateService);

    const originalError = console.error;
    spyOn(console, 'error').and.callFake((...args) => {
      if (
        args[0] &&
        typeof args[0] === 'string' &&
        args[0].includes('[VideoSync] Play failed')
      ) {
        return;
      }
      originalError.apply(console, args);
    });

    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should register elements and update in loop', fakeAsync(() => {
    const mockRuler = jasmine.createSpyObj<TimeRulerComponent>(
      'TimeRulerComponent',
      ['setScrollLeft'],
    );
    const mockVideo1 = document.createElement('video');
    const mockVideo2 = document.createElement('video');
    Object.defineProperty(mockVideo1, 'readyState', {get: () => 4});
    Object.defineProperty(mockVideo2, 'readyState', {get: () => 4});

    const mockElements = {
      videos: [mockVideo1, mockVideo2],
      audios: [],
      timeline: document.createElement('div'),
      dummyScroll: document.createElement('div'),
      timeRuler: mockRuler,
    };

    stateService.timelineClips.set([
      {
        id: '1',
        assetId: 'a1',
        startTime: 0,
        duration: 60,
        offset: 0,
        trackIndex: 0,
        color: 'red',
      },
    ]);

    service.registerElements(mockElements);
    stateService.isPlaying.set(true);

    service.runGameLoop();

    tick(1000);

    expect(stateService.currentTime()).toBeGreaterThan(0);

    service.stopLoop();
  }));

  it('should play video in effect when isPlaying is true', fakeAsync(() => {
    const mockVideo1 = document.createElement('video');
    const mockVideo2 = document.createElement('video');
    spyOn(mockVideo1, 'play').and.callFake(() => {
      Object.defineProperty(mockVideo1, 'paused', {
        get: () => false,
        configurable: true,
      });
      return Promise.resolve();
    });
    spyOn(mockVideo2, 'play').and.callFake(() => {
      Object.defineProperty(mockVideo2, 'paused', {
        get: () => false,
        configurable: true,
      });
      return Promise.resolve();
    });
    Object.defineProperty(mockVideo1, 'readyState', {get: () => 4});
    Object.defineProperty(mockVideo2, 'readyState', {get: () => 4});

    const mockElements = {
      videos: [mockVideo1, mockVideo2],
      audios: [],
      timeline: document.createElement('div'),
      dummyScroll: document.createElement('div'),
      timeRuler: jasmine.createSpyObj<TimeRulerComponent>(
        'TimeRulerComponent',
        ['setScrollLeft'],
      ),
    };

    const mockClip = {
      id: '1',
      assetId: 'a1',
      startTime: 0,
      duration: 10,
      offset: 0,
      trackIndex: 0,
      color: 'red',
    };
    stateService.timelineClips.set([mockClip]);

    service.registerElements(mockElements);
    fixture.detectChanges(); // Trigger effects!

    stateService.isPlaying.set(true);
    service.syncPlayhead(0);
    fixture.detectChanges(); // Trigger effects again!

    expect(
      (mockVideo1.play as jasmine.Spy).calls.any() ||
        (mockVideo2.play as jasmine.Spy).calls.any(),
    ).toBeTrue();
  }));

  it('should pause video in effect when isPlaying is false', fakeAsync(() => {
    const mockVideo1 = document.createElement('video');
    const mockVideo2 = document.createElement('video');
    spyOn(mockVideo1, 'pause').and.callFake(() => {
      Object.defineProperty(mockVideo1, 'paused', {
        get: () => true,
        configurable: true,
      });
    });
    spyOn(mockVideo2, 'pause').and.callFake(() => {
      Object.defineProperty(mockVideo2, 'paused', {
        get: () => true,
        configurable: true,
      });
    });

    const mockElements = {
      videos: [mockVideo1, mockVideo2],
      audios: [],
      timeline: document.createElement('div'),
      dummyScroll: document.createElement('div'),
      timeRuler: jasmine.createSpyObj<TimeRulerComponent>(
        'TimeRulerComponent',
        ['setScrollLeft'],
      ),
    };

    const mockClip = {
      id: '1',
      assetId: 'a1',
      startTime: 0,
      duration: 10,
      offset: 0,
      trackIndex: 0,
      color: 'red',
    };
    stateService.timelineClips.set([mockClip]);

    service.registerElements(mockElements);

    // Start playing first (simulated)
    stateService.isPlaying.set(true);
    fixture.detectChanges();

    (mockVideo1.pause as jasmine.Spy).calls.reset();
    (mockVideo2.pause as jasmine.Spy).calls.reset();

    // Mock paused to be false on both (simulating that it was playing)
    Object.defineProperty(mockVideo1, 'paused', {
      get: () => false,
      configurable: true,
    });
    Object.defineProperty(mockVideo2, 'paused', {
      get: () => false,
      configurable: true,
    });

    // Now pause
    stateService.isPlaying.set(false);
    fixture.detectChanges();

    expect(
      (mockVideo1.pause as jasmine.Spy).calls.any() ||
        (mockVideo2.pause as jasmine.Spy).calls.any(),
    ).toBeTrue();
  }));

  it('should set isVideoLoading to true and pause playback in loop if readyState < 3 for the first clip', fakeAsync(() => {
    const mockRuler = jasmine.createSpyObj<TimeRulerComponent>(
      'TimeRulerComponent',
      ['setScrollLeft'],
    );
    const mockVideo1 = document.createElement('video');
    const mockVideo2 = document.createElement('video');
    // set readyState < 3
    Object.defineProperty(mockVideo1, 'readyState', {get: () => 1});
    Object.defineProperty(mockVideo2, 'readyState', {get: () => 4});

    const mockElements = {
      videos: [mockVideo1, mockVideo2],
      audios: [],
      timeline: document.createElement('div'),
      dummyScroll: document.createElement('div'),
      timeRuler: mockRuler,
    };

    stateService.timelineClips.set([
      {
        id: '1',
        assetId: 'a1',
        startTime: 0,
        duration: 10,
        offset: 0,
        trackIndex: 0,
        color: 'red',
      },
    ]);

    service.registerElements(mockElements);
    stateService.isPlaying.set(true);

    service.runGameLoop();

    tick(50); // run multiple frames

    expect(service.isVideoLoading()).toBeTrue();

    service.stopLoop();
  }));

  it('should stop playback and loop if active video element encounters an error', fakeAsync(() => {
    const mockRuler = jasmine.createSpyObj<TimeRulerComponent>(
      'TimeRulerComponent',
      ['setScrollLeft'],
    );
    const mockVideo1 = document.createElement('video');
    const mockVideo2 = document.createElement('video');
    // Mock the error property
    Object.defineProperty(mockVideo1, 'error', {get: () => ({}) as MediaError});

    const mockElements = {
      videos: [mockVideo1, mockVideo2],
      audios: [],
      timeline: document.createElement('div'),
      dummyScroll: document.createElement('div'),
      timeRuler: mockRuler,
    };

    stateService.timelineClips.set([
      {
        id: '1',
        assetId: 'a1',
        startTime: 0,
        duration: 10,
        offset: 0,
        trackIndex: 0,
        color: 'red',
      },
    ]);

    service.registerElements(mockElements);
    stateService.isPlaying.set(true);

    // Set recovery attempts to 3 to trigger the failure path immediately
    service['recoveryAttempts'].set(mockVideo1, 3);

    spyOn(service, 'stopLoop').and.callThrough();

    service.runGameLoop();

    tick(50);

    expect(stateService.isPlaying()).toBeFalse();
    expect(service.stopLoop).toHaveBeenCalled();
    expect(service.isVideoLoading()).toBeFalse();
  }));

  describe('Transition Sync Flow', () => {
    it('should set transition progress and classes for wipe_left transition', () => {
      const mockVideo1 = document.createElement('video');
      const mockVideo2 = document.createElement('video');
      Object.defineProperty(mockVideo1, 'readyState', {get: () => 4});
      Object.defineProperty(mockVideo2, 'readyState', {get: () => 4});

      const mockRuler = jasmine.createSpyObj<TimeRulerComponent>(
        'TimeRulerComponent',
        ['setScrollLeft'],
      );
      const mockElements = {
        videos: [mockVideo1, mockVideo2],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: mockRuler,
      };

      stateService.timelineClips.set([
        {
          id: 'clip-1',
          assetId: 'a1',
          startTime: 0,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'red',
          transition_to_next_type: TransitionType.WIPE_LEFT,
          transition_to_next_duration: 2,
        },
        {
          id: 'clip-2',
          assetId: 'a2',
          startTime: 4,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);

      service.registerElements(mockElements);

      stateService.isPlaying.set(true);
      service.syncPlayhead(4.5);

      expect(mockVideo1.classList.contains('transition-wipe_left')).toBeTrue();
      expect(mockVideo1.classList.contains('transition-outgoing')).toBeTrue();
      expect(mockVideo2.classList.contains('transition-wipe_left')).toBeTrue();
      expect(mockVideo2.classList.contains('transition-incoming')).toBeTrue();
    });
  });

  describe('Audio Sync Flow', () => {
    it('should sync audio current time and volume', () => {
      const mockAudio = document.createElement('audio');
      Object.defineProperty(mockAudio, 'src', {
        get: () => 'http://localhost/audio.mp3',
        configurable: true,
      });
      spyOn(mockAudio, 'play').and.returnValue(Promise.resolve());

      const mockElements = {
        videos: [],
        audios: [mockAudio],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

      stateService.timelineClips.set([
        {
          id: 'audio-1',
          assetId: 'audio-asset',
          startTime: 0,
          duration: 10,
          offset: 0,
          trackIndex: 1,
          color: 'green',
          volume: 0.8,
        },
      ]);

      service.registerElements(mockElements);
      stateService.isPlaying.set(true);

      service.syncPlayhead(2);

      expect(mockAudio.volume).toBe(0.8);
      expect(mockAudio.play).toHaveBeenCalled();
    });
  });

  describe('Game Loop Scroll & End Flow', () => {
    it('should auto-scroll timeline when playhead moves past center point', fakeAsync(() => {
      const mockRuler = jasmine.createSpyObj('TimeRuler', ['setScrollLeft']);
      const mockTimeline = document.createElement('div');
      Object.defineProperty(mockTimeline, 'clientWidth', {get: () => 1000});
      const mockDummyScroll = document.createElement('div');

      const mockElements = {
        videos: [],
        audios: [],
        timeline: mockTimeline,
        dummyScroll: mockDummyScroll,
        timeRuler: mockRuler,
      };

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
      stateService.isPlaying.set(true);
      stateService.pixelsPerSecond.set(100);
      stateService.currentTime.set(4);

      service.registerElements(mockElements);

      service.runGameLoop();
      tick(100);

      stateService.currentTime.set(6);
      tick(100);

      expect(stateService.scrollOffset()).toBeGreaterThan(0);
      expect(mockRuler.setScrollLeft).toHaveBeenCalled();

      service.stopLoop();
    }));

    it('should stop loop and reset state when reaching totalDuration', fakeAsync(() => {
      const mockRuler = jasmine.createSpyObj('TimeRuler', ['setScrollLeft']);
      const mockElements = {
        videos: [],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: mockRuler,
      };

      stateService.timelineClips.set([
        {
          id: 'clip-duration-5',
          assetId: 'a1',
          startTime: 0,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'red',
        },
      ]);
      stateService.isPlaying.set(true);
      stateService.currentTime.set(4.95);

      service.registerElements(mockElements);

      service.runGameLoop();
      tick(100);

      expect(stateService.isPlaying()).toBeFalse();
      expect(stateService.currentTime()).toBe(0);

      service.stopLoop();
    }));
  });

  describe('Normal Flow Active Video Setup', () => {
    it('should load video, listen to canplay and seeked events, and play if isPlaying is true', fakeAsync(() => {
      const mockVideo = document.createElement('video');
      mockVideo.classList.add('transition-outgoing');
      Object.defineProperty(mockVideo, 'readyState', {get: () => 4});

      spyOn(mockVideo, 'load').and.callThrough();
      spyOn(mockVideo, 'play').and.callFake(() => {
        Object.defineProperty(mockVideo, 'paused', {
          get: () => false,
          configurable: true,
        });
        return Promise.resolve();
      });

      const mockElements = {
        videos: [mockVideo],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

      const mockClip = {
        id: 'clip-1',
        assetId: 'a1',
        startTime: 0,
        duration: 10,
        offset: 0,
        trackIndex: 0,
        color: 'red',
        speed: 1.0,
      };

      stateService.timelineClips.set([mockClip]);
      service.registerElements(mockElements);
      stateService.isPlaying.set(true);

      service.syncPlayhead(1);

      expect(mockVideo.load).toHaveBeenCalled();

      mockVideo.dispatchEvent(new Event('canplay'));
      mockVideo.dispatchEvent(new Event('seeked'));

      tick();

      expect(mockVideo.style.opacity).toBe('1');
    }));
  });

  describe('Transition Outgoing Freeze & Wipe Right', () => {
    it('should pause and freeze outgoing clip when currentTime is past its duration, and handle WIPE_RIGHT classes', () => {
      const mockVideo1 = document.createElement('video');
      const mockVideo2 = document.createElement('video');
      Object.defineProperty(mockVideo1, 'readyState', {get: () => 4});
      Object.defineProperty(mockVideo2, 'readyState', {get: () => 4});

      Object.defineProperty(mockVideo1, 'paused', {
        get: () => false,
        configurable: true,
      });

      spyOn(mockVideo1, 'pause').and.callFake(() => {
        Object.defineProperty(mockVideo1, 'paused', {
          get: () => true,
          configurable: true,
        });
      });

      const mockElements = {
        videos: [mockVideo1, mockVideo2],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

      stateService.timelineClips.set([
        {
          id: 'clip-1',
          assetId: 'a1',
          startTime: 0,
          duration: 4,
          offset: 0,
          trackIndex: 0,
          color: 'red',
          transition_to_next_type: TransitionType.WIPE_RIGHT,
          transition_to_next_duration: 2,
        },
        {
          id: 'clip-2',
          assetId: 'a2',
          startTime: 3,
          duration: 5,
          offset: 0,
          trackIndex: 0,
          color: 'blue',
        },
      ]);

      service.registerElements(mockElements);
      stateService.isPlaying.set(true);

      service.syncPlayhead(4.5);

      expect(mockVideo1.pause).toHaveBeenCalled();
      expect(mockVideo1.classList.contains('transition-wipe_right')).toBeTrue();
      expect(mockVideo2.classList.contains('transition-wipe_right')).toBeTrue();
    });
  });

  describe('Transition In & Transition Out Sync', () => {
    it('should handle transition_in flow', () => {
      const mockVideo = document.createElement('video');
      Object.defineProperty(mockVideo, 'readyState', {get: () => 4});

      const mockElements = {
        videos: [mockVideo],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

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
      stateService.transitionIn.set({
        type: TransitionType.FADE,
        duration_seconds: 2,
      });

      service.registerElements(mockElements);
      stateService.isPlaying.set(true);

      service.syncPlayhead(1);

      expect(mockVideo.classList.contains('transition-fade')).toBeTrue();
      expect(mockVideo.classList.contains('transition-incoming')).toBeTrue();
    });

    it('should handle transition_out flow', () => {
      const mockVideo = document.createElement('video');
      Object.defineProperty(mockVideo, 'readyState', {get: () => 4});

      const mockElements = {
        videos: [mockVideo],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

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
      stateService.transitionOut.set({
        type: TransitionType.FADE,
        duration_seconds: 2,
      });

      service.registerElements(mockElements);
      stateService.isPlaying.set(true);

      service.syncPlayhead(9);

      expect(mockVideo.classList.contains('transition-fade')).toBeTrue();
      expect(mockVideo.classList.contains('transition-outgoing')).toBeTrue();
    });
  });

  describe('initializeVideoSources', () => {
    it('should set video source and current time based on asset url', () => {
      const mockVideo = document.createElement('video');

      const mockElements = {
        videos: [mockVideo],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

      stateService.assets.set([
        {
          id: 'asset-1',
          name: 'Video Asset',
          url: 'http://localhost/video.mp4',
          type: 'video',
          presignedUrl: 'http://localhost/video.mp4',
        } as any,
      ]);

      stateService.timelineClips.set([
        {
          id: 'clip-1',
          assetId: 'asset-1',
          startTime: 0,
          duration: 5,
          offset: 2,
          trackIndex: 0,
          color: 'red',
        },
      ]);

      service.registerElements(mockElements);

      expect(mockVideo.src).toBe('http://localhost/video.mp4');
      expect(mockVideo.getAttribute('data-loaded-asset-id')).toBe('asset-1');
      expect(mockVideo.currentTime).toBe(2);
    });
  });

  describe('syncPlayhead without elements', () => {
    it('should return early if elements is null', () => {
      service['elements'].set(null);
      expect(() => service.syncPlayhead(1)).not.toThrow();
    });
  });

  describe('syncPlayhead onCanPlay handler', () => {
    it('should register canplay listener and trigger seek / play operations on canplay event', fakeAsync(() => {
      const mockVideo = document.createElement('video');
      mockVideo.classList.add('transition-outgoing');
      Object.defineProperty(mockVideo, 'readyState', {get: () => 4});

      spyOn(mockVideo, 'load').and.callThrough();
      spyOn(mockVideo, 'play').and.returnValue(Promise.resolve());
      spyOn(mockVideo, 'addEventListener').and.callThrough();
      spyOn(mockVideo, 'removeEventListener').and.callThrough();

      const mockElements = {
        videos: [mockVideo],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

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
      service.registerElements(mockElements);
      stateService.isPlaying.set(true);

      service.syncPlayhead(1);

      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        'canplay',
        jasmine.any(Function),
      );

      const canPlayHandler = (
        mockVideo.addEventListener as jasmine.Spy
      ).calls.argsFor(0)[1];
      canPlayHandler();

      expect(mockVideo.removeEventListener).toHaveBeenCalledWith(
        'canplay',
        canPlayHandler,
      );
      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        'seeked',
        jasmine.any(Function),
      );

      const seekedHandler = (
        mockVideo.addEventListener as jasmine.Spy
      ).calls.mostRecent().args[1];
      seekedHandler();

      expect(mockVideo.removeEventListener).toHaveBeenCalledWith(
        'seeked',
        seekedHandler,
      );
    }));
  });

  describe('runGameLoop onCanPlay recovery handler', () => {
    it('should register recovery canplay listener and trigger buffer seek on stall', fakeAsync(() => {
      const mockVideo = document.createElement('video');
      mockVideo.style.opacity = '1';
      Object.defineProperty(mockVideo, 'readyState', {get: () => 1});
      Object.defineProperty(mockVideo, 'error', {
        get: () => ({code: 4, message: 'MEDIA_ERR_SRC_NOT_SUPPORTED'}),
        configurable: true,
      });

      spyOn(mockVideo, 'addEventListener').and.callThrough();
      spyOn(mockVideo, 'removeEventListener').and.callThrough();
      spyOn(mockVideo, 'play').and.returnValue(Promise.resolve());

      const mockElements = {
        videos: [mockVideo],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

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
      service.registerElements(mockElements);
      stateService.isPlaying.set(true);
      stateService.currentTime.set(2);

      service.runGameLoop();
      tick(100);

      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        'canplay',
        jasmine.any(Function),
      );

      const canPlayHandler = (
        mockVideo.addEventListener as jasmine.Spy
      ).calls.argsFor(0)[1];
      canPlayHandler();

      expect(mockVideo.removeEventListener).toHaveBeenCalledWith(
        'canplay',
        canPlayHandler,
      );
      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        'seeked',
        jasmine.any(Function),
      );

      const seekedHandler = (
        mockVideo.addEventListener as jasmine.Spy
      ).calls.mostRecent().args[1];
      seekedHandler();

      expect(mockVideo.removeEventListener).toHaveBeenCalledWith(
        'seeked',
        seekedHandler,
      );

      service.stopLoop();
    }));
  });

  describe('safeSeek onSeeked handler', () => {
    it('should queue pending seeks and trigger them when previous seek completes', fakeAsync(() => {
      const mockVideo = document.createElement('video');

      spyOn(mockVideo, 'addEventListener').and.callThrough();
      spyOn(mockVideo, 'removeEventListener').and.callThrough();

      const mockElements = {
        videos: [mockVideo],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

      service.registerElements(mockElements);

      service['safeSeek'](mockVideo, 5);
      expect(mockVideo.currentTime).toBe(5);
      expect(mockVideo.addEventListener).toHaveBeenCalledWith(
        'seeked',
        jasmine.any(Function),
      );

      // Advance clock past 150ms throttle check
      tick(150);

      const firstSeekedHandler = (
        mockVideo.addEventListener as jasmine.Spy
      ).calls.mostRecent().args[1];

      Object.defineProperty(mockVideo, 'seeking', {
        get: () => true,
        configurable: true,
      });
      service['safeSeek'](mockVideo, 8);

      expect(service['pendingSeeks'].get(mockVideo)).toBe(8);

      Object.defineProperty(mockVideo, 'seeking', {
        get: () => false,
        configurable: true,
      });
      firstSeekedHandler();

      expect(mockVideo.removeEventListener).toHaveBeenCalledWith(
        'seeked',
        firstSeekedHandler,
      );
      expect(mockVideo.currentTime).toBe(8);
      expect(service['pendingSeeks'].has(mockVideo)).toBeFalse();
    }));
  });

  describe('runGameLoop onSeeked recovery handler', () => {
    it('should reset recovery attempts after 500ms successful play', fakeAsync(() => {
      const mockVideo = document.createElement('video');
      mockVideo.style.opacity = '1';
      Object.defineProperty(mockVideo, 'readyState', {get: () => 1});
      Object.defineProperty(mockVideo, 'error', {
        get: () => ({code: 4, message: 'MEDIA_ERR_SRC_NOT_SUPPORTED'}),
        configurable: true,
      });

      spyOn(mockVideo, 'addEventListener').and.callThrough();
      spyOn(mockVideo, 'play').and.callFake(() => {
        Object.defineProperty(mockVideo, 'paused', {
          get: () => false,
          configurable: true,
        });
        return Promise.resolve();
      });
      spyOn(mockVideo, 'pause').and.callFake(() => {
        Object.defineProperty(mockVideo, 'paused', {
          get: () => true,
          configurable: true,
        });
      });

      const mockElements = {
        videos: [mockVideo],
        audios: [],
        timeline: document.createElement('div'),
        dummyScroll: document.createElement('div'),
        timeRuler: jasmine.createSpyObj('TimeRuler', ['setScrollLeft']),
      };

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
      service.registerElements(mockElements);
      stateService.isPlaying.set(true);
      stateService.currentTime.set(2);

      service['recoveryAttempts'].set(mockVideo, 1);

      service.runGameLoop();
      tick(100);

      const canPlayHandler = (
        mockVideo.addEventListener as jasmine.Spy
      ).calls.argsFor(0)[1];
      canPlayHandler();

      const seekedHandler = (
        mockVideo.addEventListener as jasmine.Spy
      ).calls.argsFor(1)[1];

      Object.defineProperty(mockVideo, 'error', {
        get: () => null,
        configurable: true,
      });
      seekedHandler();

      expect(service['recoveryAttempts'].get(mockVideo)).toBe(2);

      tick(500);

      expect(service['recoveryAttempts'].get(mockVideo)).toBe(0);

      service.stopLoop();
    }));
  });
});

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

import {TestBed} from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {StoryboardService} from './storyboard.service';
import {environment} from '../../../environments/environment';
import {
  StoryboardResponse,
  StoryboardUpdate,
} from '../../common/models/workbench.model';

describe('StoryboardService', () => {
  let service: StoryboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [StoryboardService],
    });

    service = TestBed.inject(StoryboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('#getStoryboard', () => {
    it('should return a StoryboardResponse', () => {
      const dummyResponse: StoryboardResponse = {
        id: 123,
        workspace_id: 1,
        scenes: [],
      } as any;

      service.getStoryboard(123).subscribe(res => {
        expect(res).toEqual(dummyResponse);
      });

      const req = httpMock.expectOne(
        `${environment.backendURL}/storyboards/123`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(dummyResponse);
    });
  });

  describe('#getStoryboardForSession', () => {
    it('should return storyboards matching workspace and session', () => {
      const dummyResponse: StoryboardResponse[] = [
        {
          id: 123,
          workspace_id: 1,
          scenes: [],
        } as any,
      ];

      service.getStoryboardForSession(1, 'session-abc').subscribe(res => {
        expect(res).toEqual(dummyResponse);
      });

      const expectedUrl = `${environment.backendURL}/storyboards?workspace_id=1&session_id=session-abc`;
      const req = httpMock.expectOne(expectedUrl);
      expect(req.request.method).toBe('GET');
      req.flush(dummyResponse);
    });
  });

  describe('#updateStoryboard', () => {
    it('should update and return the updated StoryboardResponse', () => {
      const dummyResponse: StoryboardResponse = {
        id: 123,
        workspace_id: 1,
        scenes: [],
      } as any;
      const updateData: StoryboardUpdate = {
        scenes: [],
      } as any;

      service.updateStoryboard(123, updateData).subscribe(res => {
        expect(res).toEqual(dummyResponse);
      });

      const req = httpMock.expectOne(
        `${environment.backendURL}/storyboards/123`,
      );
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateData);
      req.flush(dummyResponse);
    });
  });
});
